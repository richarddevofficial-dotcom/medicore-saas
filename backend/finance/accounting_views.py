from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import (
    Count,
    DecimalField,
    F,
    Q,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from finance.accounting_permissions import (
    IsFinanceManager,
    IsFinanceUser,
)
from finance.accounting_serializers import (
    AccountCategorySerializer,
    ChartOfAccountSerializer,
    JournalEntryCreateSerializer,
    JournalEntryDetailSerializer,
    JournalEntryListSerializer,
    JournalPostSerializer,
    JournalReverseSerializer,
    JournalVoidSerializer,
)
from finance.models import (
    AccountCategory,
    ChartOfAccount,
    JournalEntry,
    JournalEntryLine,
)


ZERO = Decimal("0.00")
MONEY_FIELD = DecimalField(
    max_digits=18,
    decimal_places=2,
)


def get_request_hospital(request):
    """
    Resolve the active hospital from common MediCore request/user patterns.
    """

    request_hospital = getattr(request, "hospital", None)

    if request_hospital is not None:
        return request_hospital

    user = request.user

    user_hospital = getattr(user, "hospital", None)

    if user_hospital is not None:
        return user_hospital

    profile = getattr(user, "profile", None)

    if profile is not None:
        profile_hospital = getattr(profile, "hospital", None)

        if profile_hospital is not None:
            return profile_hospital

    employee = getattr(user, "employee", None)

    if employee is not None:
        employee_hospital = getattr(employee, "hospital", None)

        if employee_hospital is not None:
            return employee_hospital

    return None


def apply_hospital_scope(queryset, request):
    """
    Restrict ordinary users to their assigned hospital.
    Superusers may optionally filter using ?hospital=<uuid-or-id>.
    """

    hospital_param = request.query_params.get("hospital")
    user = request.user

    if user.is_superuser:
        if hospital_param:
            return queryset.filter(hospital_id=hospital_param)

        return queryset

    hospital = get_request_hospital(request)

    if hospital is None:
        return queryset.none()

    return queryset.filter(hospital=hospital)


def validate_requested_hospital(request, hospital):
    """
    Prevent users from submitting records for another hospital.
    """

    if request.user.is_superuser:
        return

    active_hospital = get_request_hospital(request)

    if active_hospital is None:
        raise PermissionDenied(
            "Your account is not assigned to a hospital."
        )

    if active_hospital.pk != hospital.pk:
        raise PermissionDenied(
            "You cannot create finance records for another hospital."
        )


def parse_date_param(request, name, default=None):
    raw_value = request.query_params.get(name)

    if not raw_value:
        return default

    try:
        return date.fromisoformat(raw_value)
    except ValueError as exc:
        raise ValidationError(
            {
                name: (
                    f"{name} must use YYYY-MM-DD format."
                )
            }
        ) from exc


def get_status_value(model, expected_name):
    """
    Find the real stored value for a status choice such as posted or void.
    """

    try:
        field = model._meta.get_field("status")
    except Exception:
        return expected_name

    expected_name = expected_name.lower()

    for value, label in field.flatchoices:
        if str(value).lower() == expected_name:
            return value

        if str(label).lower() == expected_name:
            return value

    return expected_name


def save_with_optional_user(instance, user, action_name):
    """
    Run model methods such as post(), reverse() or void() while supporting
    different method signatures.
    """

    method = getattr(instance, action_name, None)

    if not callable(method):
        return False

    attempts = (
        {"user": user},
        {"posted_by": user},
        {"performed_by": user},
        {},
    )

    last_type_error = None

    for kwargs in attempts:
        try:
            method(**kwargs)
            return True
        except TypeError as exc:
            last_type_error = exc
            continue

    if last_type_error:
        raise last_type_error

    return False


class HospitalScopedAccountingViewSet(viewsets.ModelViewSet):
    """
    Base ViewSet for hospital-owned accounting records.
    """

    permission_classes = (
        IsAuthenticated,
        IsFinanceUser,
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_hospital_scope(queryset, self.request)

    def perform_create(self, serializer):
        hospital = serializer.validated_data.get("hospital")

        if hospital is not None:
            validate_requested_hospital(
                self.request,
                hospital,
            )

        serializer.save()

    def perform_update(self, serializer):
        hospital = serializer.validated_data.get(
            "hospital",
            getattr(serializer.instance, "hospital", None),
        )

        if hospital is not None:
            validate_requested_hospital(
                self.request,
                hospital,
            )

        serializer.save()


class AccountCategoryViewSet(
    HospitalScopedAccountingViewSet
):
    serializer_class = AccountCategorySerializer
    queryset = AccountCategory.objects.all().order_by(
        "account_type",
        "code",
    )
    search_fields = (
        "name",
        "code",
        "description",
    )
    ordering_fields = (
        "code",
        "name",
        "account_type",
        "created_at",
    )
    filterset_fields = (
        "hospital",
        "account_type",
        "normal_balance",
        "is_active",
    )


class ChartOfAccountViewSet(
    HospitalScopedAccountingViewSet
):
    serializer_class = ChartOfAccountSerializer
    queryset = (
        ChartOfAccount.objects
        .select_related(
            "hospital",
            "category",
        )
        .all()
        .order_by("code")
    )
    search_fields = (
        "code",
        "name",
        "description",
    )
    ordering_fields = (
        "code",
        "name",
        "created_at",
    )
    filterset_fields = (
        "hospital",
        "category",
        "is_active",
    )

    @action(
        detail=False,
        methods=["get"],
        url_path="summary",
    )
    def summary(self, request):
        queryset = self.filter_queryset(
            self.get_queryset()
        )

        data = (
            queryset
            .values(
                "category__account_type",
                "category__normal_balance",
            )
            .annotate(
                account_count=Count("id"),
            )
            .order_by("category__account_type")
        )

        return Response(list(data))

    @action(
        detail=True,
        methods=["post"],
        url_path="activate",
        permission_classes=[
            IsAuthenticated,
            IsFinanceManager,
        ],
    )
    def activate(self, request, pk=None):
        account = self.get_object()
        account.is_active = True
        account.save(update_fields=["is_active"])

        return Response(
            self.get_serializer(account).data
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="deactivate",
        permission_classes=[
            IsAuthenticated,
            IsFinanceManager,
        ],
    )
    def deactivate(self, request, pk=None):
        account = self.get_object()

        has_lines = JournalEntryLine.objects.filter(
            account=account
        ).exists()

        if has_lines:
            account.is_active = False
            account.save(update_fields=["is_active"])

            return Response(
                {
                    "detail": (
                        "Account deactivated. It was not deleted "
                        "because journal lines already reference it."
                    ),
                    "account": self.get_serializer(account).data,
                }
            )

        account.is_active = False
        account.save(update_fields=["is_active"])

        return Response(
            self.get_serializer(account).data
        )

    def destroy(self, request, *args, **kwargs):
        account = self.get_object()

        if JournalEntryLine.objects.filter(
            account=account
        ).exists():
            return Response(
                {
                    "detail": (
                        "This account cannot be deleted because "
                        "journal entries reference it. Deactivate "
                        "the account instead."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        return super().destroy(
            request,
            *args,
            **kwargs,
        )


class JournalEntryViewSet(
    HospitalScopedAccountingViewSet
):
    queryset = (
        JournalEntry.objects
        .select_related("hospital")
        .prefetch_related(
            "lines",
            "lines__account",
            "lines__account__category",
        )
        .all()
        .order_by("-entry_date", "-created_at")
    )
    search_fields = (
        "reference",
        "description",
        "source_module",
        "source_id",
    )
    ordering_fields = (
        "entry_date",
        "created_at",
        "reference",
        "status",
    )
    filterset_fields = (
        "hospital",
        "status",
        "entry_type",
        "source_module",
    )
    http_method_names = (
        "get",
        "post",
        "head",
        "options",
    )

    def get_serializer_class(self):
        if self.action == "create":
            return JournalEntryCreateSerializer

        if self.action == "retrieve":
            return JournalEntryDetailSerializer

        return JournalEntryListSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        start_date = parse_date_param(
            self.request,
            "start_date",
        )
        end_date = parse_date_param(
            self.request,
            "end_date",
        )
        account_id = self.request.query_params.get(
            "account"
        )

        if start_date:
            queryset = queryset.filter(
                entry_date__gte=start_date
            )

        if end_date:
            queryset = queryset.filter(
                entry_date__lte=end_date
            )

        if account_id:
            queryset = queryset.filter(
                lines__account_id=account_id
            ).distinct()

        return queryset

    def perform_create(self, serializer):
        hospital = serializer.validated_data["hospital"]

        validate_requested_hospital(
            self.request,
            hospital,
        )

        serializer.save()

    @action(
        detail=True,
        methods=["post"],
        url_path="post",
        permission_classes=[
            IsAuthenticated,
            IsFinanceManager,
        ],
    )
    @transaction.atomic
    def post_journal(self, request, pk=None):
        journal = self.get_object()

        input_serializer = JournalPostSerializer(
            data=request.data
        )
        input_serializer.is_valid(
            raise_exception=True
        )

        posted_status = get_status_value(
            JournalEntry,
            "posted",
        )

        if str(journal.status).lower() == str(
            posted_status
        ).lower():
            return Response(
                {
                    "detail": (
                        "This journal entry is already posted."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        total_debit = journal.lines.aggregate(
            value=Coalesce(
                Sum("debit"),
                Value(ZERO),
                output_field=MONEY_FIELD,
            )
        )["value"]

        total_credit = journal.lines.aggregate(
            value=Coalesce(
                Sum("credit"),
                Value(ZERO),
                output_field=MONEY_FIELD,
            )
        )["value"]

        if total_debit <= ZERO:
            raise ValidationError(
                "The journal total must be greater than zero."
            )

        if total_debit != total_credit:
            raise ValidationError(
                {
                    "detail": (
                        "The journal is not balanced.",
                    ),
                    "total_debit": total_debit,
                    "total_credit": total_credit,
                }
            )

        try:
            method_ran = save_with_optional_user(
                journal,
                request.user,
                "post",
            )

            if not method_ran:
                journal.status = posted_status

                update_fields = ["status"]

                if hasattr(journal, "posted_at"):
                    journal.posted_at = timezone.now()
                    update_fields.append("posted_at")

                if hasattr(journal, "posted_by"):
                    journal.posted_by = request.user
                    update_fields.append("posted_by")

                journal.save(update_fields=update_fields)

        except DjangoValidationError as exc:
            raise ValidationError(
                getattr(
                    exc,
                    "message_dict",
                    getattr(exc, "messages", str(exc)),
                )
            ) from exc

        journal.refresh_from_db()

        return Response(
            JournalEntryDetailSerializer(
                journal,
                context={"request": request},
            ).data
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="void",
        permission_classes=[
            IsAuthenticated,
            IsFinanceManager,
        ],
    )
    @transaction.atomic
    def void_journal(self, request, pk=None):
        journal = self.get_object()

        input_serializer = JournalVoidSerializer(
            data=request.data
        )
        input_serializer.is_valid(
            raise_exception=True
        )

        reason = input_serializer.validated_data[
            "reason"
        ]
        void_status = get_status_value(
            JournalEntry,
            "void",
        )

        void_method = getattr(journal, "void", None)

        if callable(void_method):
            attempts = (
                {
                    "user": request.user,
                    "reason": reason,
                },
                {
                    "voided_by": request.user,
                    "reason": reason,
                },
                {"reason": reason},
                {},
            )

            completed = False

            for kwargs in attempts:
                try:
                    void_method(**kwargs)
                    completed = True
                    break
                except TypeError:
                    continue

            if not completed:
                raise ValidationError(
                    "Unable to call the journal void method."
                )
        else:
            journal.status = void_status
            update_fields = ["status"]

            if hasattr(journal, "void_reason"):
                journal.void_reason = reason
                update_fields.append("void_reason")

            if hasattr(journal, "voided_at"):
                journal.voided_at = timezone.now()
                update_fields.append("voided_at")

            if hasattr(journal, "voided_by"):
                journal.voided_by = request.user
                update_fields.append("voided_by")

            journal.save(update_fields=update_fields)

        journal.refresh_from_db()

        return Response(
            JournalEntryDetailSerializer(
                journal,
                context={"request": request},
            ).data
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="reverse",
        permission_classes=[
            IsAuthenticated,
            IsFinanceManager,
        ],
    )
    @transaction.atomic
    def reverse_journal(self, request, pk=None):
        original = self.get_object()

        serializer = JournalReverseSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        reversal_date = serializer.validated_data.get(
            "reversal_date",
            timezone.localdate(),
        )
        reason = serializer.validated_data.get(
            "reason",
            "",
        )
        void_original = serializer.validated_data.get(
            "void_original",
            False,
        )

        posted_status = get_status_value(
            JournalEntry,
            "posted",
        )

        if str(original.status).lower() != str(
            posted_status
        ).lower():
            raise ValidationError(
                "Only posted journal entries can be reversed."
            )

        existing_reversal = JournalEntry.objects.filter(
            hospital=original.hospital,
            source_module="journal_reversal",
            source_id=str(original.pk),
        ).first()

        if existing_reversal:
            return Response(
                {
                    "detail": (
                        "This journal entry has already been "
                        "reversed."
                    ),
                    "reversal": JournalEntryDetailSerializer(
                        existing_reversal,
                        context={"request": request},
                    ).data,
                },
                status=status.HTTP_409_CONFLICT,
            )

        reversal_kwargs = {
            "hospital": original.hospital,
            "entry_date": reversal_date,
            "entry_type": getattr(
                original,
                "entry_type",
                None,
            ),
            "reference": (
                f"REV-{original.reference}"
                if getattr(original, "reference", "")
                else f"REV-{original.pk}"
            ),
            "description": (
                f"Reversal of journal {original.pk}"
                + (f": {reason}" if reason else "")
            ),
            "source_module": "journal_reversal",
            "source_id": str(original.pk),
        }

        model_field_names = {
            field.name
            for field in JournalEntry._meta.fields
        }

        reversal_kwargs = {
            key: value
            for key, value in reversal_kwargs.items()
            if key in model_field_names
            and value is not None
        }

        if "status" in model_field_names:
            reversal_kwargs["status"] = posted_status

        if "created_by" in model_field_names:
            reversal_kwargs["created_by"] = request.user

        if "posted_by" in model_field_names:
            reversal_kwargs["posted_by"] = request.user

        if "posted_at" in model_field_names:
            reversal_kwargs["posted_at"] = timezone.now()

        reversal = JournalEntry.objects.create(
            **reversal_kwargs
        )

        reversal_lines = []

        for line in original.lines.all():
            line_kwargs = {
                "journal_entry": reversal,
                "account": line.account,
                "description": (
                    f"Reversal: {line.description}"
                    if getattr(line, "description", "")
                    else "Journal reversal"
                ),
                "debit": line.credit or ZERO,
                "credit": line.debit or ZERO,
            }

            reversal_lines.append(
                JournalEntryLine(**line_kwargs)
            )

        JournalEntryLine.objects.bulk_create(
            reversal_lines
        )

        if void_original:
            void_status = get_status_value(
                JournalEntry,
                "void",
            )
            original.status = void_status
            original.save(update_fields=["status"])

        return Response(
            JournalEntryDetailSerializer(
                reversal,
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class AccountingReportBaseView(APIView):
    permission_classes = (
        IsAuthenticated,
        IsFinanceUser,
    )

    def get_hospital(self, request):
        hospital_id = request.query_params.get(
            "hospital"
        )

        if request.user.is_superuser and hospital_id:
            from hospitals.models import Hospital

            return get_object_or_404(
                Hospital,
                pk=hospital_id,
            )

        hospital = get_request_hospital(request)

        if hospital is None:
            raise PermissionDenied(
                "Your account is not assigned to a hospital."
            )

        return hospital

    def get_date_range(self, request):
        start_date = parse_date_param(
            request,
            "start_date",
        )
        end_date = parse_date_param(
            request,
            "end_date",
            timezone.localdate(),
        )

        if start_date and end_date:
            if start_date > end_date:
                raise ValidationError(
                    {
                        "start_date": (
                            "Start date cannot be after end date."
                        )
                    }
                )

        return start_date, end_date

    def posted_lines(self, hospital):
        posted_status = get_status_value(
            JournalEntry,
            "posted",
        )

        return JournalEntryLine.objects.filter(
            journal_entry__hospital=hospital,
            journal_entry__status=posted_status,
        )


class TrialBalanceView(AccountingReportBaseView):
    def get(self, request):
        hospital = self.get_hospital(request)
        start_date, end_date = self.get_date_range(
            request
        )

        lines = self.posted_lines(hospital)

        if start_date:
            lines = lines.filter(
                journal_entry__entry_date__gte=start_date
            )

        if end_date:
            lines = lines.filter(
                journal_entry__entry_date__lte=end_date
            )

        rows = (
            lines
            .values(
                "account_id",
                "account__code",
                "account__name",
                "account__category__account_type",
                "account__category__normal_balance",
            )
            .annotate(
                total_debit=Coalesce(
                    Sum("debit"),
                    Value(ZERO),
                    output_field=MONEY_FIELD,
                ),
                total_credit=Coalesce(
                    Sum("credit"),
                    Value(ZERO),
                    output_field=MONEY_FIELD,
                ),
            )
            .order_by("account__code")
        )

        results = []
        grand_debit = ZERO
        grand_credit = ZERO

        for row in rows:
            debit = row["total_debit"] or ZERO
            credit = row["total_credit"] or ZERO
            balance = debit - credit

            grand_debit += debit
            grand_credit += credit

            results.append(
                {
                    **row,
                    "balance": balance,
                }
            )

        return Response(
            {
                "hospital": {
                    "id": hospital.pk,
                    "name": hospital.name,
                },
                "start_date": start_date,
                "end_date": end_date,
                "accounts": results,
                "totals": {
                    "debit": grand_debit,
                    "credit": grand_credit,
                    "difference": (
                        grand_debit - grand_credit
                    ),
                    "is_balanced": (
                        grand_debit == grand_credit
                    ),
                },
            }
        )


class GeneralLedgerView(AccountingReportBaseView):
    def get(self, request):
        hospital = self.get_hospital(request)
        start_date, end_date = self.get_date_range(
            request
        )
        account_id = request.query_params.get(
            "account"
        )
        account_code = request.query_params.get(
            "account_code"
        )

        accounts = ChartOfAccount.objects.filter(
            hospital=hospital
        )

        if account_id:
            account = get_object_or_404(
                accounts,
                pk=account_id,
            )
        elif account_code:
            account = get_object_or_404(
                accounts,
                code=account_code,
            )
        else:
            raise ValidationError(
                {
                    "account": (
                        "Provide account or account_code."
                    )
                }
            )

        lines = self.posted_lines(hospital).filter(
            account=account
        )

        opening_lines = lines

        if start_date:
            opening_lines = opening_lines.filter(
                journal_entry__entry_date__lt=start_date
            )
            lines = lines.filter(
                journal_entry__entry_date__gte=start_date
            )
        else:
            opening_lines = lines.none()

        if end_date:
            lines = lines.filter(
                journal_entry__entry_date__lte=end_date
            )

        opening = opening_lines.aggregate(
            debit=Coalesce(
                Sum("debit"),
                Value(ZERO),
                output_field=MONEY_FIELD,
            ),
            credit=Coalesce(
                Sum("credit"),
                Value(ZERO),
                output_field=MONEY_FIELD,
            ),
        )

        running_balance = (
            opening["debit"] - opening["credit"]
        )

        entries = []

        for line in lines.select_related(
            "journal_entry"
        ).order_by(
            "journal_entry__entry_date",
            "journal_entry__created_at",
            "pk",
        ):
            debit = line.debit or ZERO
            credit = line.credit or ZERO
            running_balance += debit - credit

            entries.append(
                {
                    "line_id": line.pk,
                    "journal_id": line.journal_entry_id,
                    "date": line.journal_entry.entry_date,
                    "reference": getattr(
                        line.journal_entry,
                        "reference",
                        "",
                    ),
                    "description": (
                        line.description
                        or line.journal_entry.description
                    ),
                    "debit": debit,
                    "credit": credit,
                    "balance": running_balance,
                }
            )

        return Response(
            {
                "hospital": {
                    "id": hospital.pk,
                    "name": hospital.name,
                },
                "account": {
                    "id": account.pk,
                    "code": account.code,
                    "name": account.name,
                    "category": account.category.name,
                    "account_type": (
                        account.category.account_type
                    ),
                },
                "start_date": start_date,
                "end_date": end_date,
                "opening_balance": (
                    opening["debit"]
                    - opening["credit"]
                ),
                "entries": entries,
                "closing_balance": running_balance,
            }
        )


class IncomeStatementView(AccountingReportBaseView):
    def get(self, request):
        hospital = self.get_hospital(request)
        start_date, end_date = self.get_date_range(
            request
        )

        lines = self.posted_lines(hospital)

        if start_date:
            lines = lines.filter(
                journal_entry__entry_date__gte=start_date
            )

        if end_date:
            lines = lines.filter(
                journal_entry__entry_date__lte=end_date
            )

        rows = (
            lines
            .filter(
                account__category__account_type__in=[
                    "revenue",
                    "income",
                    "expense",
                    "cost_of_sales",
                    "other_income",
                    "other_expense",
                ]
            )
            .values(
                "account_id",
                "account__code",
                "account__name",
                "account__category__account_type",
            )
            .annotate(
                debit=Coalesce(
                    Sum("debit"),
                    Value(ZERO),
                    output_field=MONEY_FIELD,
                ),
                credit=Coalesce(
                    Sum("credit"),
                    Value(ZERO),
                    output_field=MONEY_FIELD,
                ),
            )
            .order_by("account__code")
        )

        revenue = []
        expenses = []
        total_revenue = ZERO
        total_expenses = ZERO

        for row in rows:
            account_type = str(
                row[
                    "account__category__account_type"
                ]
            ).lower()

            debit = row["debit"] or ZERO
            credit = row["credit"] or ZERO

            if account_type in {
                "revenue",
                "income",
                "other_income",
            }:
                amount = credit - debit
                total_revenue += amount
                revenue.append(
                    {
                        **row,
                        "amount": amount,
                    }
                )
            else:
                amount = debit - credit
                total_expenses += amount
                expenses.append(
                    {
                        **row,
                        "amount": amount,
                    }
                )

        return Response(
            {
                "hospital": {
                    "id": hospital.pk,
                    "name": hospital.name,
                },
                "start_date": start_date,
                "end_date": end_date,
                "revenue": revenue,
                "expenses": expenses,
                "total_revenue": total_revenue,
                "total_expenses": total_expenses,
                "net_profit": (
                    total_revenue - total_expenses
                ),
            }
        )


class BalanceSheetView(AccountingReportBaseView):
    def get(self, request):
        hospital = self.get_hospital(request)
        end_date = parse_date_param(
            request,
            "end_date",
            timezone.localdate(),
        )

        lines = self.posted_lines(hospital).filter(
            journal_entry__entry_date__lte=end_date
        )

        rows = (
            lines
            .filter(
                account__category__account_type__in=[
                    "asset",
                    "liability",
                    "equity",
                ]
            )
            .values(
                "account_id",
                "account__code",
                "account__name",
                "account__category__account_type",
            )
            .annotate(
                debit=Coalesce(
                    Sum("debit"),
                    Value(ZERO),
                    output_field=MONEY_FIELD,
                ),
                credit=Coalesce(
                    Sum("credit"),
                    Value(ZERO),
                    output_field=MONEY_FIELD,
                ),
            )
            .order_by("account__code")
        )

        assets = []
        liabilities = []
        equity = []

        total_assets = ZERO
        total_liabilities = ZERO
        total_equity = ZERO

        for row in rows:
            account_type = str(
                row[
                    "account__category__account_type"
                ]
            ).lower()

            debit = row["debit"] or ZERO
            credit = row["credit"] or ZERO

            if account_type == "asset":
                amount = debit - credit
                total_assets += amount
                assets.append(
                    {
                        **row,
                        "amount": amount,
                    }
                )
            elif account_type == "liability":
                amount = credit - debit
                total_liabilities += amount
                liabilities.append(
                    {
                        **row,
                        "amount": amount,
                    }
                )
            elif account_type == "equity":
                amount = credit - debit
                total_equity += amount
                equity.append(
                    {
                        **row,
                        "amount": amount,
                    }
                )

        difference = total_assets - (
            total_liabilities + total_equity
        )

        return Response(
            {
                "hospital": {
                    "id": hospital.pk,
                    "name": hospital.name,
                },
                "end_date": end_date,
                "assets": assets,
                "liabilities": liabilities,
                "equity": equity,
                "totals": {
                    "assets": total_assets,
                    "liabilities": total_liabilities,
                    "equity": total_equity,
                    "liabilities_and_equity": (
                        total_liabilities + total_equity
                    ),
                    "difference": difference,
                    "is_balanced": difference == ZERO,
                },
            }
        )
