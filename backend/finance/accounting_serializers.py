from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from .models import (
    AccountCategory,
    ChartOfAccount,
    JournalEntry,
    JournalEntryLine,
)
from .services import (
    JournalLineData,
    create_journal_entry,
)


ZERO = Decimal("0.00")


class AccountCategorySerializer(serializers.ModelSerializer):
    """
    Serializer for account categories.
    """

    account_count = serializers.SerializerMethodField()

    class Meta:
        model = AccountCategory
        fields = "__all__"
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
        )

    def get_account_count(self, obj):
        related_names = (
            "accounts",
            "chart_of_accounts",
            "finance_accounts",
        )

        for related_name in related_names:
            related_manager = getattr(obj, related_name, None)

            if related_manager is not None:
                try:
                    return related_manager.count()
                except Exception:
                    continue

        return ChartOfAccount.objects.filter(
            category=obj
        ).count()

    def validate_name(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Category name is required."
            )

        return value

    def validate_code(self, value):
        value = value.strip().upper()

        if not value:
            raise serializers.ValidationError(
                "Category code is required."
            )

        return value

    def validate(self, attrs):
        hospital = attrs.get(
            "hospital",
            getattr(self.instance, "hospital", None),
        )
        name = attrs.get(
            "name",
            getattr(self.instance, "name", ""),
        )
        code = attrs.get(
            "code",
            getattr(self.instance, "code", ""),
        )

        if hospital and name:
            queryset = AccountCategory.objects.filter(
                hospital=hospital,
                name__iexact=name,
            )

            if self.instance:
                queryset = queryset.exclude(
                    pk=self.instance.pk
                )

            if queryset.exists():
                raise serializers.ValidationError(
                    {
                        "name": (
                            "An account category with this name "
                            "already exists for this hospital."
                        )
                    }
                )

        if hospital and code:
            queryset = AccountCategory.objects.filter(
                hospital=hospital,
                code__iexact=code,
            )

            if self.instance:
                queryset = queryset.exclude(
                    pk=self.instance.pk
                )

            if queryset.exists():
                raise serializers.ValidationError(
                    {
                        "code": (
                            "An account category with this code "
                            "already exists for this hospital."
                        )
                    }
                )

        return attrs


class ChartOfAccountSummarySerializer(
    serializers.ModelSerializer
):
    """
    Lightweight account serializer used inside journal lines.
    """

    category_name = serializers.CharField(
        source="category.name",
        read_only=True,
    )

    class Meta:
        model = ChartOfAccount
        fields = (
            "id",
            "code",
            "name",
            "category",
            "category_name",
            "is_active",
        )


class ChartOfAccountSerializer(serializers.ModelSerializer):
    """
    Full Chart of Account serializer.
    """

    category_name = serializers.CharField(
        source="category.name",
        read_only=True,
    )
    account_type = serializers.CharField(
        source="category.account_type",
        read_only=True,
    )
    normal_balance = serializers.CharField(
        source="category.normal_balance",
        read_only=True,
    )

    class Meta:
        model = ChartOfAccount
        fields = "__all__"
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
        )

    def validate_code(self, value):
        value = value.strip().upper()

        if not value:
            raise serializers.ValidationError(
                "Account code is required."
            )

        return value

    def validate_name(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Account name is required."
            )

        return value

    def validate(self, attrs):
        hospital = attrs.get(
            "hospital",
            getattr(self.instance, "hospital", None),
        )
        category = attrs.get(
            "category",
            getattr(self.instance, "category", None),
        )
        code = attrs.get(
            "code",
            getattr(self.instance, "code", ""),
        )
        name = attrs.get(
            "name",
            getattr(self.instance, "name", ""),
        )

        if hospital and category:
            if category.hospital_id != hospital.id:
                raise serializers.ValidationError(
                    {
                        "category": (
                            "The selected category belongs to "
                            "another hospital."
                        )
                    }
                )

        if hospital and code:
            queryset = ChartOfAccount.objects.filter(
                hospital=hospital,
                code__iexact=code,
            )

            if self.instance:
                queryset = queryset.exclude(
                    pk=self.instance.pk
                )

            if queryset.exists():
                raise serializers.ValidationError(
                    {
                        "code": (
                            "An account with this code already "
                            "exists for this hospital."
                        )
                    }
                )

        if hospital and name:
            queryset = ChartOfAccount.objects.filter(
                hospital=hospital,
                name__iexact=name,
            )

            if self.instance:
                queryset = queryset.exclude(
                    pk=self.instance.pk
                )

            if queryset.exists():
                raise serializers.ValidationError(
                    {
                        "name": (
                            "An account with this name already "
                            "exists for this hospital."
                        )
                    }
                )

        parent = attrs.get(
            "parent",
            getattr(self.instance, "parent", None),
        )

        if parent:
            if hospital and parent.hospital_id != hospital.id:
                raise serializers.ValidationError(
                    {
                        "parent": (
                            "The parent account belongs to "
                            "another hospital."
                        )
                    }
                )

            if self.instance and parent.pk == self.instance.pk:
                raise serializers.ValidationError(
                    {
                        "parent": (
                            "An account cannot be its own parent."
                        )
                    }
                )

        return attrs


class JournalEntryLineSerializer(
    serializers.ModelSerializer
):
    """
    Read serializer for journal entry lines.
    """

    account_details = ChartOfAccountSummarySerializer(
        source="account",
        read_only=True,
    )

    class Meta:
        model = JournalEntryLine
        fields = "__all__"
        read_only_fields = (
            "id",
            "journal_entry",
            "created_at",
            "updated_at",
        )


class JournalEntryLineWriteSerializer(
    serializers.Serializer
):
    """
    Input serializer for creating journal entry lines.
    """

    account = serializers.PrimaryKeyRelatedField(
        queryset=ChartOfAccount.objects.all(),
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
    )
    debit = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        required=False,
        default=ZERO,
        min_value=ZERO,
    )
    credit = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        required=False,
        default=ZERO,
        min_value=ZERO,
    )

    def validate(self, attrs):
        debit = attrs.get("debit", ZERO)
        credit = attrs.get("credit", ZERO)

        if debit == ZERO and credit == ZERO:
            raise serializers.ValidationError(
                "Enter either a debit or credit amount."
            )

        if debit > ZERO and credit > ZERO:
            raise serializers.ValidationError(
                "A line cannot contain both debit and credit."
            )

        return attrs


class JournalEntryListSerializer(
    serializers.ModelSerializer
):
    """
    Compact journal serializer for list endpoints.
    """

    total_debit = serializers.SerializerMethodField()
    total_credit = serializers.SerializerMethodField()
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = JournalEntry
        fields = "__all__"

    def get_total_debit(self, obj):
        if hasattr(obj, "calculated_total_debit"):
            return obj.calculated_total_debit

        return sum(
            (
                line.debit or ZERO
                for line in obj.lines.all()
            ),
            ZERO,
        )

    def get_total_credit(self, obj):
        if hasattr(obj, "calculated_total_credit"):
            return obj.calculated_total_credit

        return sum(
            (
                line.credit or ZERO
                for line in obj.lines.all()
            ),
            ZERO,
        )

    def get_line_count(self, obj):
        return obj.lines.count()


class JournalEntryDetailSerializer(
    serializers.ModelSerializer
):
    """
    Detailed read serializer with journal lines.
    """

    lines = JournalEntryLineSerializer(
        many=True,
        read_only=True,
    )
    total_debit = serializers.SerializerMethodField()
    total_credit = serializers.SerializerMethodField()
    is_balanced = serializers.SerializerMethodField()

    class Meta:
        model = JournalEntry
        fields = "__all__"

    def get_total_debit(self, obj):
        return sum(
            (
                line.debit or ZERO
                for line in obj.lines.all()
            ),
            ZERO,
        )

    def get_total_credit(self, obj):
        return sum(
            (
                line.credit or ZERO
                for line in obj.lines.all()
            ),
            ZERO,
        )

    def get_is_balanced(self, obj):
        return (
            self.get_total_debit(obj)
            == self.get_total_credit(obj)
        )


class JournalEntryCreateSerializer(
    serializers.ModelSerializer
):
    """
    Create balanced journal entries through finance.services.
    """

    lines = JournalEntryLineWriteSerializer(
        many=True,
        write_only=True,
    )
    post_immediately = serializers.BooleanField(
        write_only=True,
        required=False,
        default=False,
    )

    class Meta:
        model = JournalEntry
        fields = (
            "id",
            "hospital",
            "entry_date",
            "entry_type",
            "reference",
            "description",
            "source_module",
            "source_id",
            "lines",
            "post_immediately",
        )
        read_only_fields = ("id",)

    def validate_description(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Journal description is required."
            )

        return value

    def validate(self, attrs):
        hospital = attrs.get("hospital")
        lines = attrs.get("lines", [])

        if len(lines) < 2:
            raise serializers.ValidationError(
                {
                    "lines": (
                        "A journal entry must contain at "
                        "least two lines."
                    )
                }
            )

        total_debit = ZERO
        total_credit = ZERO

        for position, line in enumerate(lines, start=1):
            account = line["account"]

            if account.hospital_id != hospital.id:
                raise serializers.ValidationError(
                    {
                        "lines": (
                            f"Line {position}: account "
                            f"{account.code} belongs to another "
                            "hospital."
                        )
                    }
                )

            if not account.is_active:
                raise serializers.ValidationError(
                    {
                        "lines": (
                            f"Line {position}: account "
                            f"{account.code} is inactive."
                        )
                    }
                )

            total_debit += line.get("debit", ZERO)
            total_credit += line.get("credit", ZERO)

        if total_debit <= ZERO:
            raise serializers.ValidationError(
                {
                    "lines": (
                        "Journal total must be greater than zero."
                    )
                }
            )

        if total_debit != total_credit:
            raise serializers.ValidationError(
                {
                    "lines": (
                        "Journal entry is not balanced. "
                        f"Debit: {total_debit}; "
                        f"Credit: {total_credit}."
                    )
                }
            )

        source_module = attrs.get(
            "source_module",
            "",
        ).strip()
        source_id = str(
            attrs.get("source_id", "")
        ).strip()

        if source_module and source_id:
            duplicate = JournalEntry.objects.filter(
                hospital=hospital,
                source_module=source_module,
                source_id=source_id,
            )

            status_field = JournalEntry._meta.get_field(
                "status"
            )

            status_choices = {
                str(value).lower(): value
                for value, _label
                in status_field.flatchoices
            }

            void_status = status_choices.get("void")

            if void_status is not None:
                duplicate = duplicate.exclude(
                    status=void_status
                )

            if duplicate.exists():
                raise serializers.ValidationError(
                    {
                        "source_id": (
                            "A journal entry already exists for "
                            "this source transaction."
                        )
                    }
                )

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines")
        post_immediately = validated_data.pop(
            "post_immediately",
            False,
        )

        request = self.context.get("request")
        user = None

        if request and request.user.is_authenticated:
            user = request.user

        service_lines = [
            JournalLineData(
                account=line["account"],
                description=line.get(
                    "description",
                    "",
                ),
                debit=line.get("debit", ZERO),
                credit=line.get("credit", ZERO),
            )
            for line in lines
        ]

        try:
            return create_journal_entry(
                hospital=validated_data["hospital"],
                description=validated_data["description"],
                lines=service_lines,
                user=user,
                entry_date=validated_data.get(
                    "entry_date"
                ),
                entry_type=validated_data.get(
                    "entry_type",
                    JournalEntry.EntryType.GENERAL,
                ),
                reference=validated_data.get(
                    "reference",
                    "",
                ),
                source_module=validated_data.get(
                    "source_module",
                    "",
                ),
                source_id=validated_data.get(
                    "source_id",
                    "",
                ),
                post_immediately=post_immediately,
            )
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                raise serializers.ValidationError(
                    exc.message_dict
                ) from exc

            if hasattr(exc, "messages"):
                raise serializers.ValidationError(
                    exc.messages
                ) from exc

            raise serializers.ValidationError(
                str(exc)
            ) from exc

    def to_representation(self, instance):
        return JournalEntryDetailSerializer(
            instance,
            context=self.context,
        ).data


class JournalPostSerializer(serializers.Serializer):
    """
    Input serializer for posting a draft journal.
    """

    confirmation = serializers.BooleanField(
        required=True,
    )

    def validate_confirmation(self, value):
        if value is not True:
            raise serializers.ValidationError(
                "You must confirm journal posting."
            )

        return value


class JournalVoidSerializer(serializers.Serializer):
    """
    Input serializer for voiding a journal.
    """

    reason = serializers.CharField(
        required=True,
        allow_blank=False,
        min_length=3,
        max_length=500,
    )

    def validate_reason(self, value):
        return value.strip()


class JournalReverseSerializer(serializers.Serializer):
    """
    Input serializer for reversing a posted journal.
    """

    reversal_date = serializers.DateField(
        required=False,
    )
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
    )
    void_original = serializers.BooleanField(
        required=False,
        default=False,
    )

    def validate_reason(self, value):
        return value.strip()
