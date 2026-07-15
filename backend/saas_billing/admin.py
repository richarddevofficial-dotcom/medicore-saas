from datetime import timedelta
from decimal import Decimal

from django.contrib import admin, messages
from django.db import transaction
from django.utils import timezone

from .models import (
    HospitalSubscription,
    Invoice,
    Payment,
    PlanFeature,
    SubscriptionPlan,
)


class PlanFeatureInline(admin.TabularInline):
    model = PlanFeature
    extra = 0


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "monthly_price",
        "service_fee",
        "currency",
        "max_staff",
        "max_patients",
        "is_active",
    )

    list_filter = (
        "is_active",
        "currency",
    )

    search_fields = (
        "name",
        "code",
    )

    ordering = (
        "display_order",
        "monthly_price",
    )

    inlines = [
        PlanFeatureInline,
    ]


@admin.register(HospitalSubscription)
class HospitalSubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        "hospital",
        "plan",
        "status",
        "trial_ends_at",
        "service_fee_paid",
        "next_billing_date",
        "current_monthly_price",
    )

    list_filter = (
        "status",
        "plan",
        "service_fee_paid",
        "auto_renew",
    )

    search_fields = (
        "hospital__name",
        "hospital__slug",
        "hospital__email",
        "plan__name",
    )


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = (
        "invoice_number",
        "hospital",
        "invoice_type",
        "status",
        "total_amount",
        "amount_paid",
        "currency",
        "due_date",
    )

    list_filter = (
        "status",
        "invoice_type",
        "currency",
    )

    search_fields = (
        "invoice_number",
        "hospital__name",
        "hospital__slug",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )


@admin.action(
    description="Approve selected pending payments"
)
def approve_selected_payments(
    modeladmin,
    request,
    queryset,
):
    approved_count = 0
    skipped_count = 0
    failed_count = 0

    for selected_payment in queryset:
        try:
            with transaction.atomic():
                payment = (
                    Payment.objects
                    .select_for_update()
                    .select_related(
                        "invoice",
                        "subscription",
                        "subscription__hospital",
                        "subscription__plan",
                    )
                    .get(pk=selected_payment.pk)
                )

                if payment.status != Payment.STATUS_PENDING:
                    skipped_count += 1
                    continue

                invoice = (
                    Invoice.objects
                    .select_for_update()
                    .get(pk=payment.invoice_id)
                )

                subscription = (
                    HospitalSubscription.objects
                    .select_for_update()
                    .select_related(
                        "hospital",
                        "plan",
                    )
                    .get(pk=payment.subscription_id)
                )

                balance_due = invoice.balance_due

                if payment.amount != balance_due:
                    failed_count += 1
                    continue

                now = timezone.now()

                payment.status = Payment.STATUS_SUCCESS
                payment.paid_at = now
                payment.gateway_response = {
                    **(payment.gateway_response or {}),
                    "approved_by_user_id": request.user.id,
                    "approved_by_email": request.user.email,
                    "approved_at": now.isoformat(),
                    "approval_source": "django_admin",
                }

                payment.save(
                    update_fields=[
                        "status",
                        "paid_at",
                        "gateway_response",
                        "updated_at",
                    ]
                )

                invoice.amount_paid = (
                    invoice.amount_paid
                    + payment.amount
                )

                if (
                    invoice.amount_paid
                    >= invoice.total_amount
                ):
                    invoice.amount_paid = (
                        invoice.total_amount
                    )
                    invoice.status = (
                        Invoice.STATUS_PAID
                    )
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
                    invoice.service_fee_amount
                    > Decimal("0.00")
                ):
                    subscription.service_fee_paid = True
                    subscription.service_fee_paid_at = now

                subscription.status = (
                    HospitalSubscription.STATUS_ACTIVE
                )

                subscription.activated_at = (
                    subscription.activated_at
                    or now
                )

                subscription.next_billing_date = (
                    timezone.localdate()
                    + timedelta(days=30)
                )

                subscription.grace_period_ends_at = None

                subscription.save(
                    update_fields=[
                        "status",
                        "activated_at",
                        "next_billing_date",
                        "service_fee_paid",
                        "service_fee_paid_at",
                        "grace_period_ends_at",
                        "updated_at",
                    ]
                )

                hospital = subscription.hospital
                hospital.subscription_plan = (
                    subscription.plan.code
                )
                hospital.subscription_status = "active"
                hospital.is_active = True

                hospital.save(
                    update_fields=[
                        "subscription_plan",
                        "subscription_status",
                        "is_active",
                        "updated_at",
                    ]
                )

                approved_count += 1

        except Exception:
            failed_count += 1

    if approved_count:
        messages.success(
            request,
            (
                f"{approved_count} payment(s) approved "
                "successfully."
            ),
        )

    if skipped_count:
        messages.warning(
            request,
            (
                f"{skipped_count} payment(s) skipped "
                "because they were not pending."
            ),
        )

    if failed_count:
        messages.error(
            request,
            (
                f"{failed_count} payment(s) could not "
                "be approved. Check the amount and "
                "invoice balance."
            ),
        )


@admin.action(
    description="Reject selected pending payments"
)
def reject_selected_payments(
    modeladmin,
    request,
    queryset,
):
    rejected_count = 0
    skipped_count = 0

    for payment in queryset:
        if payment.status != Payment.STATUS_PENDING:
            skipped_count += 1
            continue

        now = timezone.now()

        payment.status = Payment.STATUS_FAILED
        payment.gateway_response = {
            **(payment.gateway_response or {}),
            "rejected_by_user_id": request.user.id,
            "rejected_by_email": request.user.email,
            "rejected_at": now.isoformat(),
            "rejection_source": "django_admin",
        }

        existing_notes = payment.notes.strip()

        rejection_note = (
            f"Rejected through Django Admin by "
            f"{request.user.email or request.user.username}."
        )

        payment.notes = (
            f"{existing_notes}\n{rejection_note}".strip()
        )

        payment.save(
            update_fields=[
                "status",
                "gateway_response",
                "notes",
                "updated_at",
            ]
        )

        rejected_count += 1

    if rejected_count:
        messages.success(
            request,
            (
                f"{rejected_count} payment(s) "
                "rejected successfully."
            ),
        )

    if skipped_count:
        messages.warning(
            request,
            (
                f"{skipped_count} payment(s) skipped "
                "because they were not pending."
            ),
        )


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "payment_reference",
        "hospital",
        "payment_type",
        "amount",
        "currency",
        "gateway",
        "status",
        "paid_at",
    )

    list_filter = (
        "status",
        "payment_type",
        "gateway",
        "currency",
    )

    search_fields = (
        "payment_reference",
        "transaction_id",
        "hospital__name",
        "hospital__slug",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
        "paid_at",
        "gateway_response",
    )

    actions = [
        approve_selected_payments,
        reject_selected_payments,
    ]


@admin.register(PlanFeature)
class PlanFeatureAdmin(admin.ModelAdmin):
    list_display = (
        "feature_name",
        "feature_code",
        "plan",
        "is_enabled",
        "limit_value",
    )

    list_filter = (
        "plan",
        "is_enabled",
    )

    search_fields = (
        "feature_name",
        "feature_code",
        "plan__name",
    )


from .models import BillingReminderLog


@admin.register(BillingReminderLog)
class BillingReminderLogAdmin(admin.ModelAdmin):
    list_display = (
        "hospital",
        "reminder_type",
        "recipient_email",
        "billing_date",
        "sent_at",
    )

    list_filter = (
        "reminder_type",
        "billing_date",
    )

    search_fields = (
        "hospital__name",
        "hospital__slug",
        "recipient_email",
        "subject",
    )

    readonly_fields = (
        "hospital",
        "subscription",
        "invoice",
        "reminder_type",
        "recipient_email",
        "subject",
        "sent_at",
        "billing_date",
        "metadata",
        "created_at",
    )
