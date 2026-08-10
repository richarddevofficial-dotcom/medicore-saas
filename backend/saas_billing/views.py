from rest_framework.decorators import (
    api_view,
    permission_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.http import FileResponse

from config.audit_logger import AuditLogger
from .invoice_services import OpenInvoiceConflict, create_initial_invoice
from .models import (
    HospitalSubscription,
    Invoice,
    SubscriptionPlan,
)
from .serializers import SubscriptionPlanSerializer
from .services import get_subscription_access
from .plan_change_services import activate_plan_change
from .receipt_services import send_payment_receipt_email
from .subscription_services import renew_subscription


def get_user_hospital(user):
    staff_profile = getattr(
        user,
        "staff_profile",
        None,
    )

    if not staff_profile:
        return None

    return staff_profile.hospital


def serialize_invoice(invoice):
    return {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "invoice_type": invoice.invoice_type,
        "status": invoice.status,
        "currency": invoice.currency,
        "service_fee_amount": str(
            invoice.service_fee_amount
        ),
        "subscription_amount": str(
            invoice.subscription_amount
        ),
        "adjustment_amount": str(
            invoice.adjustment_amount
        ),
        "subtotal": str(invoice.subtotal),
        "tax_amount": str(invoice.tax_amount),
        "total_amount": str(
            invoice.total_amount
        ),
        "amount_paid": str(
            invoice.amount_paid
        ),
        "balance_due": str(
            invoice.balance_due
        ),
        "issued_at": (
            invoice.issued_at.isoformat()
            if invoice.issued_at
            else None
        ),
        "due_date": (
            invoice.due_date.isoformat()
            if invoice.due_date
            else None
        ),
        "description": invoice.description,
        "billing_cycle": (invoice.metadata or {}).get(
            "billing_cycle",
            HospitalSubscription.CYCLE_MONTHLY,
        ),
    }


@api_view(["GET"])
@permission_classes([AllowAny])
def public_subscription_plans(request):
    plans = SubscriptionPlan.objects.filter(
        is_active=True
    ).order_by(
        "display_order",
        "monthly_price",
    )

    return Response(
        SubscriptionPlanSerializer(
            plans,
            many=True,
        ).data
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def subscription_status(request):
    hospital = get_user_hospital(
        request.user
    )

    if not hospital:
        if request.user.is_superuser:
            return Response(
                {
                    "is_platform_super_admin": True,
                    "subscription_required": False,
                }
            )

        return Response(
            {
                "error": "Hospital account not found."
            },
            status=404,
        )

    try:
        subscription = (
            HospitalSubscription.objects
            .select_related(
                "plan",
                "hospital",
            )
            .get(hospital=hospital)
        )
    except HospitalSubscription.DoesNotExist:
        return Response(
            {
                "error": (
                    "Hospital subscription not configured."
                ),
                "subscription_required": True,
            },
            status=404,
        )

    access = get_subscription_access(
        subscription
    )

    return Response(
        {
            "hospital": {
                "id": hospital.id,
                "name": hospital.name,
                "slug": hospital.slug,
            },
            "subscription": {
                "id": subscription.id,
                "plan": subscription.plan.name,
                "plan_code": subscription.plan.code,
                "status": subscription.status,
                "currency": subscription.currency,
                "monthly_price": str(
                    subscription.current_monthly_price
                ),
                "six_month_price": str(
                    subscription.plan.six_month_price
                    if subscription.plan.six_month_price is not None
                    else subscription.plan.monthly_price * Decimal("6")
                ),
                "annual_price": str(
                    subscription.plan.annual_price
                    if subscription.plan.annual_price is not None
                    else subscription.plan.monthly_price * Decimal("12")
                ),
                "service_fee": str(
                    subscription.current_service_fee
                ),
                "service_fee_paid": (
                    subscription.service_fee_paid
                ),
                "trial_started_at": (
                    subscription
                    .trial_started_at
                    .isoformat()
                    if subscription.trial_started_at
                    else None
                ),
                "trial_ends_at": (
                    subscription
                    .trial_ends_at
                    .isoformat()
                    if subscription.trial_ends_at
                    else None
                ),
                "grace_period_ends_at": (
                    subscription
                    .grace_period_ends_at
                    .isoformat()
                    if subscription.grace_period_ends_at
                    else None
                ),
                "next_billing_date": (
                    subscription
                    .next_billing_date
                    .isoformat()
                    if subscription.next_billing_date
                    else None
                ),
                "trial_days_remaining": (
                    access[
                        "trial_days_remaining"
                    ]
                ),
                "grace_days_remaining": (
                    access[
                        "grace_days_remaining"
                    ]
                ),
                "full_access": (
                    access["full_access"]
                ),
                "billing_only": (
                    access["billing_only"]
                ),
            },
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_initial_invoice(request):
    hospital = get_user_hospital(
        request.user
    )

    if not hospital:
        return Response(
            {
                "error": (
                    "Hospital account not found."
                )
            },
            status=404,
        )

    staff_profile = getattr(
        request.user,
        "staff_profile",
        None,
    )

    if (
        not request.user.is_superuser
        and (
            not staff_profile
            or staff_profile.role != "admin"
        )
    ):
        return Response(
            {
                "error": (
                    "Only a hospital administrator "
                    "can create subscription invoices."
                )
            },
            status=403,
        )

    try:
        subscription = (
            HospitalSubscription.objects
            .select_related(
                "hospital",
                "plan",
            )
            .get(hospital=hospital)
        )
    except HospitalSubscription.DoesNotExist:
        return Response(
            {
                "error": (
                    "Hospital subscription not configured."
                )
            },
            status=404,
        )

    billing_cycle = str(
        request.data.get(
            "billing_cycle",
            HospitalSubscription.CYCLE_MONTHLY,
        )
    ).strip()
    valid_cycles = {
        choice[0]
        for choice in HospitalSubscription.BILLING_CYCLE_CHOICES
    }
    if billing_cycle not in valid_cycles:
        return Response(
            {"error": "Unsupported billing cycle."},
            status=400,
        )

    plan_code = str(request.data.get("plan_code", "")).strip().lower()
    target_plan = subscription.plan
    if plan_code:
        if plan_code not in {"basic", "pro", "enterprise"}:
            return Response(
                {"error": "Select Basic, Professional, or Enterprise."},
                status=400,
            )
        try:
            target_plan = SubscriptionPlan.objects.get(
                code=plan_code,
                is_active=True,
            )
        except SubscriptionPlan.DoesNotExist:
            return Response(
                {"error": "Subscription plan not found."},
                status=404,
            )

    try:
        if target_plan.id == subscription.plan_id:
            invoice, created = create_initial_invoice(
                subscription,
                billing_cycle=billing_cycle,
            )
        else:
            invoice, created = create_plan_change_invoice(
                subscription=subscription,
                target_plan=target_plan,
                billing_cycle=billing_cycle,
            )
    except PlanChangeError as error:
        return Response(
            {"error": str(error)},
            status=400,
        )
    except OpenInvoiceConflict as error:
        return Response(
            {"error": str(error)},
            status=409,
        )

    return Response(
        {
            "success": True,
            "created": created,
            "message": (
                "Invoice created successfully."
                if created
                else (
                    "An unpaid initial invoice "
                    "already exists."
                )
            ),
            "hospital": {
                "id": hospital.id,
                "name": hospital.name,
                "slug": hospital.slug,
            },
            "plan": {
                "code": target_plan.code,
                "name": target_plan.name,
            },
            "invoice": serialize_invoice(
                invoice
            ),
        },
        status=201 if created else 200,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def hospital_invoices(request):
    hospital = get_user_hospital(
        request.user
    )

    if not hospital:
        return Response(
            {
                "error": (
                    "Hospital account not found."
                )
            },
            status=404,
        )

    invoices = (
        Invoice.objects
        .filter(hospital=hospital)
        .order_by("-created_at")
    )

    return Response(
        {
            "hospital": {
                "id": hospital.id,
                "name": hospital.name,
                "slug": hospital.slug,
            },
            "count": invoices.count(),
            "invoices": [
                serialize_invoice(invoice)
                for invoice in invoices
            ],
        }
    )


# ============================================================
# Manual payment workflow
# ============================================================

from datetime import date
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from .models import Payment


def serialize_payment(payment):
    return {
        "id": payment.id,
        "payment_reference": payment.payment_reference,
        "invoice_number": payment.invoice.invoice_number,
        "hospital": {
            "id": payment.hospital.id,
            "name": payment.hospital.name,
            "slug": payment.hospital.slug,
        },
        "payment_type": payment.payment_type,
        "amount": str(payment.amount),
        "currency": payment.currency,
        "gateway": payment.gateway,
        "payment_method": payment.payment_method,
        "transaction_id": payment.transaction_id,
        "billing_cycle": payment.billing_cycle,
        "payment_date": payment.payment_date.isoformat(),
        "status": payment.status,
        "status_label": payment.get_status_display().lower(),
        "paid_at": (
            payment.paid_at.isoformat()
            if payment.paid_at
            else None
        ),
        "notes": payment.notes,
        "rejection_reason": payment.rejection_reason,
        "confirmed_at": (
            payment.confirmed_at.isoformat()
            if payment.confirmed_at
            else None
        ),
        "has_proof_of_payment": bool(payment.proof_of_payment),
        "proof_of_payment_url": (
            f"/saas-billing/payments/{payment.id}/proof/"
            if payment.proof_of_payment
            else None
        ),
        "created_at": payment.created_at.isoformat(),
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def hospital_payments(request):
    hospital = get_user_hospital(request.user)

    if not hospital:
        return Response(
            {"error": "Hospital account not found."},
            status=404,
        )

    payments = (
        Payment.objects
        .filter(hospital=hospital)
        .select_related(
            "invoice",
            "hospital",
            "subscription",
        )
        .order_by("-created_at")
    )

    return Response(
        {
            "count": payments.count(),
            "payments": [
                serialize_payment(payment)
                for payment in payments
            ],
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def submit_manual_payment(request):
    hospital = get_user_hospital(request.user)
    staff_profile = getattr(
        request.user,
        "staff_profile",
        None,
    )

    if not hospital:
        return Response(
            {"error": "Hospital account not found."},
            status=404,
        )

    if not staff_profile or staff_profile.role != "admin":
        return Response(
            {
                "error": (
                    "Only the hospital administrator "
                    "can submit subscription payments."
                )
            },
            status=403,
        )

    invoice_id = request.data.get("invoice_id")
    bank_reference = str(
        request.data.get("transaction_id", "")
        or request.data.get("bank_reference", "")
    ).strip()

    payment_method = str(
        request.data.get(
            "payment_method",
            "bank_transfer",
        )
    ).strip()

    if payment_method not in {
        Payment.GATEWAY_BANK,
        Payment.GATEWAY_CASH,
    }:
        return Response(
            {"error": "Payment method must be cash or bank transfer."},
            status=400,
        )

    notes = str(
        request.data.get("notes", "")
    ).strip()

    payment_date_value = request.data.get("payment_date")
    try:
        payment_date = (
            date.fromisoformat(str(payment_date_value))
            if payment_date_value
            else timezone.localdate()
        )
    except ValueError:
        return Response(
            {"error": "payment_date must be a valid date."},
            status=400,
        )

    if not invoice_id:
        return Response(
            {"error": "invoice_id is required."},
            status=400,
        )

    if not bank_reference and payment_method == Payment.GATEWAY_BANK:
        return Response(
            {
                "error": (
                    "Bank transfer or transaction "
                    "reference is required."
                )
            },
            status=400,
        )

    try:
        invoice = (
            Invoice.objects
            .select_for_update()
            .select_related(
                "hospital",
                "subscription",
                "subscription__plan",
            )
            .get(
                id=invoice_id,
                hospital=hospital,
            )
        )
    except Invoice.DoesNotExist:
        return Response(
            {"error": "Invoice not found."},
            status=404,
        )

    if invoice.status == Invoice.STATUS_PAID:
        return Response(
            {"error": "This invoice is already paid."},
            status=409,
        )

    pending_exists = Payment.objects.filter(
        invoice=invoice,
        status=Payment.STATUS_PENDING,
    ).exists()

    if pending_exists:
        return Response(
            {
                "error": (
                    "A pending payment already exists "
                    "for this invoice."
                )
            },
            status=409,
        )

    requested_amount = request.data.get("amount")

    if requested_amount in (None, ""):
        amount = invoice.balance_due
    else:
        try:
            amount = Decimal(
                str(requested_amount)
            ).quantize(Decimal("0.01"))
        except (InvalidOperation, ValueError):
            return Response(
                {"error": "Invalid payment amount."},
                status=400,
            )

    if amount <= Decimal("0.00"):
        return Response(
            {
                "error": (
                    "Payment amount must be "
                    "greater than zero."
                )
            },
            status=400,
        )

    if amount != invoice.balance_due:
        return Response(
            {
                "error": (
                    "The submitted amount must equal "
                    "the full invoice balance."
                ),
                "balance_due": str(
                    invoice.balance_due
                ),
            },
            status=400,
        )

    duplicate_transaction = bool(
        bank_reference
        and Payment.objects.filter(
            transaction_id=bank_reference,
        ).exists()
    )

    if duplicate_transaction:
        return Response(
            {
                "error": (
                    "This transaction reference "
                    "has already been submitted."
                )
            },
            status=409,
        )

    billing_cycle = (
        (invoice.metadata or {}).get("billing_cycle")
        or HospitalSubscription.CYCLE_MONTHLY
    )
    target_plan = invoice.subscription.plan
    target_plan_id = (invoice.metadata or {}).get("target_plan_id")
    if target_plan_id:
        target_plan = SubscriptionPlan.objects.filter(
            id=target_plan_id,
            is_active=True,
        ).first() or target_plan

    payment_reference = Payment.generate_reference()
    if not bank_reference:
        bank_reference = f"CASH-{payment_reference}"

    payment = Payment(
        payment_reference=payment_reference,
        invoice=invoice,
        hospital=hospital,
        subscription=invoice.subscription,
        plan=target_plan,
        billing_cycle=billing_cycle,
        payment_type=(
            Payment.TYPE_COMBINED
            if invoice.invoice_type
            == Invoice.TYPE_COMBINED
            else Payment.TYPE_SUBSCRIPTION
        ),
        amount=amount,
        currency=invoice.currency,
        gateway=payment_method,
        payment_method=payment_method,
        transaction_id=bank_reference,
        payment_date=payment_date,
        proof_of_payment=request.FILES.get("proof_of_payment"),
        status=Payment.STATUS_PENDING,
        submitted_by=request.user,
        notes=notes,
        gateway_response={
            "submitted_by_user_id": (
                request.user.id
            ),
            "submitted_by_email": (
                request.user.email
            ),
        },
    )

    try:
        payment.full_clean()
    except ValidationError as exc:
        return Response(
            {"error": "; ".join(exc.messages)},
            status=400,
        )

    payment.save()

    AuditLogger.log_audit(
        user=request.user,
        action="PAYMENT_SUBMITTED",
        target=f"subscription_payment:{payment.id}",
        hospital=hospital,
        new_values={
            "payment_reference": payment.payment_reference,
            "billing_cycle": payment.billing_cycle,
            "amount": str(payment.amount),
            "currency": payment.currency,
            "payment_method": payment.payment_method,
            "transaction_reference": payment.transaction_id,
            "status": payment.status,
        },
        request=request,
    )

    return Response(
        {
            "success": True,
            "message": (
                "Payment submitted successfully "
                "and is awaiting approval."
            ),
            "payment": serialize_payment(payment),
        },
        status=201,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def approve_manual_payment(request, payment_id):
    if not request.user.is_superuser:
        return Response(
            {
                "error": (
                    "Only a platform super administrator "
                    "can approve payments."
                )
            },
            status=403,
        )

    try:
        payment = (
            Payment.objects
            .select_for_update()
            .select_related(
                "invoice",
                "hospital",
                "subscription",
                "subscription__plan",
            )
            .get(id=payment_id)
        )
    except Payment.DoesNotExist:
        return Response(
            {"error": "Payment not found."},
            status=404,
        )

    if payment.status == Payment.STATUS_SUCCESS:
        return Response(
            {
                "error": (
                    "This payment has already "
                    "been approved."
                )
            },
            status=409,
        )

    if payment.status != Payment.STATUS_PENDING:
        return Response(
            {
                "error": (
                    "Only pending payments "
                    "can be approved."
                )
            },
            status=400,
        )

    invoice = (
        Invoice.objects
        .select_for_update()
        .get(id=payment.invoice_id)
    )

    subscription = (
        HospitalSubscription.objects
        .select_for_update()
        .select_related("hospital", "plan")
        .get(id=payment.subscription_id)
    )

    target_plan = None
    invoice_metadata = invoice.metadata or {}
    if invoice_metadata.get("pending_plan_change"):
        target_plan_code = str(invoice_metadata.get("target_plan_code", "")).strip().lower()
        if target_plan_code:
            target_plan = SubscriptionPlan.objects.filter(code=target_plan_code, is_active=True).first()

    if payment.amount != invoice.balance_due:
        return Response(
            {
                "error": (
                    "Payment amount does not match "
                    "the outstanding invoice balance."
                ),
                "payment_amount": str(payment.amount),
                "balance_due": str(
                    invoice.balance_due
                ),
            },
            status=400,
        )

    now = timezone.now()

    payment.status = Payment.STATUS_SUCCESS
    payment.paid_at = now
    payment.confirmed_by = request.user
    payment.confirmed_at = now

    payment.gateway_response = {
        **(payment.gateway_response or {}),
        "approved_by_user_id": request.user.id,
        "approved_by_email": request.user.email,
        "approved_at": now.isoformat(),
    }

    payment.save(
        update_fields=[
            "status",
            "paid_at",
            "confirmed_by",
            "confirmed_at",
            "gateway_response",
            "updated_at",
        ]
    )

    invoice.amount_paid = (
        invoice.amount_paid
        + payment.amount
    )

    if invoice.amount_paid >= invoice.total_amount:
        invoice.amount_paid = invoice.total_amount
        invoice.status = Invoice.STATUS_PAID
        invoice.paid_at = now

    invoice.save(
        update_fields=[
            "amount_paid",
            "status",
            "paid_at",
            "updated_at",
        ]
    )

    if (
        invoice.status == Invoice.STATUS_PAID
        and invoice.invoice_type == Invoice.TYPE_ADJUSTMENT
        and (invoice.metadata or {}).get("target_plan_id")
    ):
        subscription = activate_plan_change(
            subscription=subscription,
            invoice=invoice,
        )

    if (
        invoice.service_fee_amount
        > Decimal("0.00")
    ):
        subscription.service_fee_paid = True
        subscription.service_fee_paid_at = now

    if target_plan:
        subscription.plan = target_plan
        subscription.current_monthly_price = target_plan.monthly_price
        subscription.current_service_fee = target_plan.service_fee

    subscription.save(
        update_fields=[
            "service_fee_paid",
            "service_fee_paid_at",
            "updated_at",
        ]
    )

    subscription = renew_subscription(
        subscription=subscription,
        billing_cycle=payment.billing_cycle,
        payment_date=payment.payment_date,
    )

    hospital = subscription.hospital
    hospital.subscription_plan = (
        subscription.plan.code
    )
    hospital.subscription_status = "active"
    hospital.is_active = True

    # Keep legacy limits synchronized for existing modules still reading hospital limits.
    if subscription.plan.max_staff is not None:
        hospital.max_staff = subscription.plan.max_staff
    if subscription.plan.max_patients is not None:
        hospital.max_patients = subscription.plan.max_patients

    hospital.save(
        update_fields=[
            "subscription_plan",
            "subscription_status",
            "is_active",
            "max_staff",
            "max_patients",
            "updated_at",
        ]
    )

    if target_plan and hospital.email:
        try:
            send_mail(
                subject="MediCore Plan Update Confirmed",
                message=(
                    f"Hello {hospital.name},\n\n"
                    f"Your plan change has been approved.\n"
                    f"New plan: {target_plan.name}\n"
                    f"Status: Active\n\n"
                    "Thank you for using MediCore SaaS."
                ),
                from_email=None,
                recipient_list=[hospital.email],
                fail_silently=True,
            )
        except Exception:
            pass

    # Send payment receipt email
    send_payment_receipt_email(payment)

    return Response(
        {
            "success": True,
            "message": (
                "Payment approved and subscription "
                "activated successfully."
            ),
            "payment": serialize_payment(payment),
            "invoice": serialize_invoice(invoice),
            "subscription": {
                "plan": subscription.plan.name,
                "status": subscription.status,
                "service_fee_paid": (
                    subscription.service_fee_paid
                ),
                "next_billing_date": (
                    subscription
                    .next_billing_date
                    .isoformat()
                ),
            },
            "receipt_email_sent": payment.receipt_delivery_status == 'sent',
            "receipt_email_error": payment.receipt_last_error or None,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_payment_proof(request, payment_id):
    payment = (
        Payment.objects
        .select_related("hospital")
        .filter(id=payment_id)
        .first()
    )

    if not payment:
        return Response({"error": "Payment not found."}, status=404)

    user_hospital = get_user_hospital(request.user)
    if not request.user.is_superuser and payment.hospital_id != getattr(
        user_hospital,
        "id",
        None,
    ):
        return Response({"error": "Payment not found."}, status=404)

    if not payment.proof_of_payment:
        return Response({"error": "Payment proof not found."}, status=404)

    payment.proof_of_payment.open("rb")
    return FileResponse(
        payment.proof_of_payment,
        as_attachment=True,
        filename=payment.proof_of_payment.name.rsplit("/", 1)[-1],
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def billing_dashboard(request):
    hospital = get_user_hospital(request.user)
    staff_profile = getattr(
        request.user,
        "staff_profile",
        None,
    )

    if not hospital:
        return Response(
            {"error": "Hospital account not found."},
            status=404,
        )

    if not staff_profile or staff_profile.role != "admin":
        return Response(
            {
                "error": (
                    "Only the hospital administrator can view "
                    "subscription billing information."
                )
            },
            status=403,
        )

    try:
        subscription = (
            HospitalSubscription.objects
            .select_related("hospital", "plan")
            .get(hospital=hospital)
        )
    except HospitalSubscription.DoesNotExist:
        return Response(
            {
                "error": "Hospital subscription not configured.",
                "subscription_required": True,
            },
            status=404,
        )

    access = get_subscription_access(subscription)

    invoices = (
        Invoice.objects
        .filter(hospital=hospital)
        .order_by("-created_at")
    )

    payments = (
        Payment.objects
        .filter(hospital=hospital)
        .select_related("invoice")
        .order_by("-created_at")
    )

    outstanding_balance = sum(
        (
            invoice.balance_due
            for invoice in invoices
            if invoice.status in {
                Invoice.STATUS_PENDING,
                Invoice.STATUS_OVERDUE,
            }
        ),
        Decimal("0.00"),
    )

    return Response(
        {
            "hospital": {
                "id": hospital.id,
                "name": hospital.name,
                "slug": hospital.slug,
            },
            "subscription": {
                "id": subscription.id,
                "plan": subscription.plan.name,
                "plan_code": subscription.plan.code,
                "status": subscription.status,
                "currency": subscription.currency,
                "monthly_price": str(
                    subscription.current_monthly_price
                ),
                "service_fee": str(
                    subscription.current_service_fee
                ),
                "service_fee_paid": (
                    subscription.service_fee_paid
                ),
                "trial_ends_at": (
                    subscription.trial_ends_at.isoformat()
                    if subscription.trial_ends_at
                    else None
                ),
                "trial_days_remaining": (
                    access["trial_days_remaining"]
                ),
                "grace_period_ends_at": (
                    subscription.grace_period_ends_at.isoformat()
                    if subscription.grace_period_ends_at
                    else None
                ),
                "grace_days_remaining": (
                    access["grace_days_remaining"]
                ),
                "next_billing_date": (
                    subscription.next_billing_date.isoformat()
                    if subscription.next_billing_date
                    else None
                ),
                "pending_plan": (
                    {
                        "code": subscription.pending_plan.code,
                        "name": subscription.pending_plan.name,
                    }
                    if subscription.pending_plan
                    else None
                ),
                "pending_plan_effective_date": (
                    subscription.pending_plan_effective_date.isoformat()
                    if subscription.pending_plan_effective_date
                    else None
                ),
                "billing_cycle": subscription.billing_cycle,
                "start_date": (
                    subscription.start_date.isoformat()
                    if subscription.start_date
                    else None
                ),
                "end_date": (
                    subscription.end_date.isoformat()
                    if subscription.end_date
                    else None
                ),
                "last_payment_date": (
                    subscription.last_payment_date.isoformat()
                    if subscription.last_payment_date
                    else None
                ),
                "days_remaining": max(
                    0,
                    (subscription.end_date - timezone.localdate()).days,
                ) if subscription.end_date else None,
                "full_access": access["full_access"],
                "billing_only": access["billing_only"],
            },
            "summary": {
                "outstanding_balance": str(
                    outstanding_balance
                ),
                "total_invoices": invoices.count(),
                "pending_invoices": invoices.filter(
                    status__in=[
                        Invoice.STATUS_PENDING,
                        Invoice.STATUS_OVERDUE,
                    ]
                ).count(),
                "paid_invoices": invoices.filter(
                    status=Invoice.STATUS_PAID
                ).count(),
                "successful_payments": payments.filter(
                    status=Payment.STATUS_SUCCESS
                ).count(),
            },
            "invoices": [
                serialize_invoice(invoice)
                for invoice in invoices[:20]
            ],
            "payments": [
                serialize_payment(payment)
                for payment in payments[:20]
            ],
            "bank_details": {
                "bank_name": settings.MEDICORE_BANK_NAME,
                "account_name": settings.MEDICORE_BANK_ACCOUNT_NAME,
                "account_number": settings.MEDICORE_BANK_ACCOUNT_NUMBER,
                "swift_code": settings.MEDICORE_BANK_SWIFT_CODE,
                "configured": bool(
                    settings.MEDICORE_BANK_NAME
                    and settings.MEDICORE_BANK_ACCOUNT_NUMBER
                ),
            },
        }
    )


# ============================================================
# PDF invoice and payment receipt downloads
# ============================================================

from django.http import FileResponse

from .pdf_services import (
    build_invoice_pdf,
    build_payment_receipt_pdf,
)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_invoice_pdf(request, invoice_id):
    hospital = get_user_hospital(request.user)

    if not hospital and not request.user.is_superuser:
        return Response(
            {"error": "Hospital account not found."},
            status=404,
        )

    invoice_query = (
        Invoice.objects
        .select_related(
            "hospital",
            "subscription",
            "subscription__plan",
        )
    )

    if request.user.is_superuser:
        invoice = invoice_query.filter(
            id=invoice_id
        ).first()
    else:
        invoice = invoice_query.filter(
            id=invoice_id,
            hospital=hospital,
        ).first()

    if not invoice:
        return Response(
            {"error": "Invoice not found."},
            status=404,
        )

    pdf_buffer = build_invoice_pdf(invoice)

    filename = (
        f"{invoice.invoice_number}.pdf"
    )

    return FileResponse(
        pdf_buffer,
        as_attachment=True,
        filename=filename,
        content_type="application/pdf",
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_payment_receipt_pdf(
    request,
    payment_id,
):
    hospital = get_user_hospital(request.user)

    if not hospital and not request.user.is_superuser:
        return Response(
            {"error": "Hospital account not found."},
            status=404,
        )

    payment_query = (
        Payment.objects
        .select_related(
            "hospital",
            "invoice",
            "subscription",
            "subscription__plan",
        )
    )

    if request.user.is_superuser:
        payment = payment_query.filter(
            id=payment_id
        ).first()
    else:
        payment = payment_query.filter(
            id=payment_id,
            hospital=hospital,
        ).first()

    if not payment:
        return Response(
            {"error": "Payment not found."},
            status=404,
        )

    if payment.status != Payment.STATUS_SUCCESS:
        return Response(
            {
                "error": (
                    "A receipt is only available "
                    "for successful payments."
                )
            },
            status=400,
        )

    pdf_buffer = build_payment_receipt_pdf(
        payment
    )

    filename = (
        f"receipt-{payment.payment_reference}.pdf"
    )

    return FileResponse(
        pdf_buffer,
        as_attachment=True,
        filename=filename,
        content_type="application/pdf",
    )


# ============================================================
# Subscription entitlements and plan usage
# ============================================================

from .entitlements import build_hospital_entitlements


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def hospital_entitlements(request):
    hospital = get_user_hospital(request.user)

    if not hospital:
        if request.user.is_superuser:
            return Response(
                {
                    "is_platform_super_admin": True,
                    "subscription_limits_apply": False,
                }
            )

        return Response(
            {"error": "Hospital account not found."},
            status=404,
        )

    return Response(
        {
            "hospital": {
                "id": hospital.id,
                "name": hospital.name,
                "slug": hospital.slug,
            },
            "entitlements": (
                build_hospital_entitlements(
                    hospital
                )
            ),
        }
    )


# ============================================================
# Plan upgrade and downgrade workflow
# ============================================================

from .plan_change_services import (
    PlanChangeError,
    activate_plan_change,
    create_plan_change_invoice,
    determine_plan_change_type,
    validate_target_plan,
)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def available_plan_changes(request):
    hospital = get_user_hospital(request.user)
    staff_profile = getattr(
        request.user,
        "staff_profile",
        None,
    )

    if not hospital:
        return Response(
            {"error": "Hospital account not found."},
            status=404,
        )

    if not staff_profile or staff_profile.role != "admin":
        return Response(
            {
                "error": (
                    "Only the hospital administrator can view "
                    "subscription plan changes."
                )
            },
            status=403,
        )

    try:
        subscription = (
            HospitalSubscription.objects
            .select_related("plan", "hospital")
            .get(hospital=hospital)
        )
    except HospitalSubscription.DoesNotExist:
        return Response(
            {
                "error": (
                    "Hospital subscription not configured."
                )
            },
            status=404,
        )

    plans = SubscriptionPlan.objects.filter(
        is_active=True
    ).order_by("display_order")

    if subscription.plan.code != "starter":
        plans = plans.exclude(code="starter")

    results = []

    for plan in plans:
        if plan.id == subscription.plan_id:
            allowed = False
            reason = "Current plan"
            change_type = "current"
        else:
            change_type = determine_plan_change_type(
                subscription.plan,
                plan,
            )

            try:
                usage = validate_target_plan(
                    subscription,
                    plan,
                )

                allowed = True
                reason = None
            except PlanChangeError as error:
                allowed = False
                reason = str(error)
                usage = {
                    "staff_used": None,
                    "staff_limit": plan.max_staff,
                    "patients_used": None,
                    "patients_limit": plan.max_patients,
                }

        results.append(
            {
                "id": plan.id,
                "code": plan.code,
                "name": plan.name,
                "description": plan.description,
                "currency": plan.currency,
                "monthly_price": str(
                    plan.monthly_price
                ),
                "six_month_price": str(
                    plan.six_month_price
                    if plan.six_month_price is not None
                    else plan.monthly_price * Decimal("6")
                ),
                "annual_price": str(
                    plan.annual_price
                    if plan.annual_price is not None
                    else plan.monthly_price * Decimal("12")
                ),
                "service_fee": str(
                    plan.service_fee
                ),
                "max_staff": plan.max_staff,
                "max_patients": plan.max_patients,
                "storage_gb": plan.storage_gb,
                "features": plan.features,
                "change_type": change_type,
                "allowed": allowed,
                "reason": reason,
            }
        )

    return Response(
        {
            "current_plan": {
                "id": subscription.plan.id,
                "code": subscription.plan.code,
                "name": subscription.plan.name,
                "monthly_price": str(
                    subscription.current_monthly_price
                ),
            },
            "plans": results,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def request_plan_change(request):
    hospital = get_user_hospital(request.user)
    staff_profile = getattr(
        request.user,
        "staff_profile",
        None,
    )

    if not hospital:
        return Response(
            {"error": "Hospital account not found."},
            status=404,
        )

    if (
        not staff_profile
        or staff_profile.role != "admin"
    ):
        return Response(
            {
                "error": (
                    "Only the hospital administrator "
                    "can change the subscription plan."
                )
            },
            status=403,
        )

    plan_code = str(
        request.data.get("plan_code", "")
    ).strip().lower()

    if not plan_code:
        return Response(
            {"error": "plan_code is required."},
            status=400,
        )

    try:
        target_plan = SubscriptionPlan.objects.get(
            code=plan_code,
            is_active=True,
        )
    except SubscriptionPlan.DoesNotExist:
        return Response(
            {"error": "Subscription plan not found."},
            status=404,
        )

    try:
        subscription = (
            HospitalSubscription.objects
            .select_related("plan", "hospital")
            .get(hospital=hospital)
        )

        invoice, created = (
            create_plan_change_invoice(
                subscription=subscription,
                target_plan=target_plan,
            )
        )
    except HospitalSubscription.DoesNotExist:
        return Response(
            {
                "error": (
                    "Hospital subscription not configured."
                )
            },
            status=404,
        )
    except PlanChangeError as error:
        return Response(
            {"error": str(error)},
            status=400,
        )

    refreshed_subscription = (
        HospitalSubscription.objects
        .select_related("plan")
        .get(pk=subscription.pk)
    )

    immediately_activated = (
        refreshed_subscription.plan_id
        == target_plan.id
    )

    return Response(
        {
            "success": True,
            "created": created,
            "immediately_activated": (
                immediately_activated
            ),
            "message": (
                f"{target_plan.name} plan activated."
                if immediately_activated
                else (
                    "Plan-change invoice created. "
                    "Submit payment to complete the upgrade."
                )
            ),
            "invoice": serialize_invoice(invoice),
            "target_plan": {
                "code": target_plan.code,
                "name": target_plan.name,
                "monthly_price": str(
                    target_plan.monthly_price
                ),
                "service_fee": str(
                    target_plan.service_fee
                ),
            },
        },
        status=201 if created else 200,
    )
