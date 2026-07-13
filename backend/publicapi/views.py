import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from hospitals.models import Hospital
from saas_billing.models import (
    HospitalSubscription,
    SubscriptionPlan,
)
from staff.models import StaffProfile

from .services import (
    seed_default_departments,
    send_hospital_welcome_email,
)


User = get_user_model()


def generate_unique_slug(hospital_name):
    base_slug = slugify(hospital_name).strip("-") or "hospital"
    candidate = base_slug
    counter = 2

    while Hospital.objects.filter(slug=candidate).exists():
        candidate = f"{base_slug}-{counter}"
        counter += 1

    return candidate


def generate_unique_username(email):
    email_prefix = email.split("@")[0]
    base_username = (
        slugify(email_prefix).replace("-", "_")
        or "admin"
    )

    candidate = base_username
    counter = 2

    while User.objects.filter(username=candidate).exists():
        candidate = f"{base_username}_{counter}"
        counter += 1

    return candidate


@api_view(["POST"])
@permission_classes([AllowAny])
@transaction.atomic
def register_hospital(request):
    hospital_name = str(
        request.data.get("hospital_name", "")
    ).strip()

    hospital_type = str(
        request.data.get("hospital_type", "hospital")
    ).strip()

    hospital_email = str(
        request.data.get("hospital_email", "")
        or request.data.get("email", "")
    ).strip().lower()

    hospital_phone = str(
        request.data.get("hospital_phone", "")
        or request.data.get("phone", "")
    ).strip()

    city = str(
        request.data.get("city", "")
    ).strip()

    state = str(
        request.data.get("state", "")
    ).strip()

    country = str(
        request.data.get("country", "South Sudan")
    ).strip()

    address = str(
        request.data.get("address", "")
    ).strip()

    admin_first_name = str(
        request.data.get("admin_first_name", "")
    ).strip()

    admin_last_name = str(
        request.data.get("admin_last_name", "")
    ).strip()

    admin_email = str(
        request.data.get("admin_email", "")
        or request.data.get("email", "")
    ).strip().lower()

    admin_phone = str(
        request.data.get("admin_phone", "")
        or request.data.get("phone", "")
    ).strip()

    password = str(
        request.data.get("password", "")
    )

    if not hospital_name:
        return Response(
            {"error": "Hospital name is required."},
            status=400,
        )

    if not hospital_email:
        return Response(
            {"error": "Hospital email is required."},
            status=400,
        )

    if not admin_email:
        return Response(
            {"error": "Administrator email is required."},
            status=400,
        )

    if len(password) < 8:
        return Response(
            {
                "error": (
                    "Password must contain at least "
                    "8 characters."
                )
            },
            status=400,
        )

    if Hospital.objects.filter(
        email__iexact=hospital_email
    ).exists():
        return Response(
            {
                "error": (
                    "A hospital with this email "
                    "already exists."
                )
            },
            status=409,
        )

    if User.objects.filter(
        email__iexact=admin_email
    ).exists():
        return Response(
            {
                "error": (
                    "A user account with this "
                    "administrator email already exists."
                )
            },
            status=409,
        )

    starter_plan = SubscriptionPlan.objects.filter(
        code="starter",
        is_active=True,
    ).first()

    if not starter_plan:
        return Response(
            {
                "error": (
                    "Starter subscription plan is not "
                    "configured. Run "
                    "seed_subscription_plans first."
                )
            },
            status=500,
        )

    slug = generate_unique_slug(hospital_name)
    username = generate_unique_username(admin_email)
    now = timezone.now()
    trial_end = now + timedelta(days=15)

    try:
        hospital = Hospital.objects.create(
            name=hospital_name,
            slug=slug,
            hospital_type=hospital_type or "hospital",
            registration_number=(
                f"MC-{uuid.uuid4().hex[:10].upper()}"
            ),
            email=hospital_email,
            phone=hospital_phone,
            address=address,
            city=city,
            state=state,
            country=country,
            subscription_plan="starter",
            subscription_status="trial",
            trial_start=now,
            trial_end=trial_end,
            max_staff=starter_plan.max_staff or 0,
            max_patients=starter_plan.max_patients or 0,
            timezone="Africa/Juba",
            currency="SSP",
            is_active=True,
            is_verified=True,
        )

        user = User.objects.create_user(
            username=username,
            email=admin_email,
            password=password,
            first_name=admin_first_name,
            last_name=admin_last_name,
            is_active=True,
            is_staff=False,
            is_superuser=False,
        )

        staff_profile = StaffProfile.objects.create(
            user=user,
            hospital=hospital,
            role="admin",
            phone=admin_phone,
            is_active=True,
        )

        subscription = HospitalSubscription.objects.create(
            hospital=hospital,
            plan=starter_plan,
            status=HospitalSubscription.STATUS_TRIAL,
            started_at=now,
            trial_started_at=now,
            trial_ends_at=trial_end,
            current_monthly_price=(
                starter_plan.monthly_price
            ),
            current_service_fee=(
                starter_plan.service_fee
            ),
            currency=starter_plan.currency,
            service_fee_paid=False,
            auto_renew=False,
        )

        departments = seed_default_departments(hospital)

    except IntegrityError:
        return Response(
            {
                "error": (
                    "The hospital could not be created "
                    "because some information already exists."
                )
            },
            status=409,
        )
    except RuntimeError as error:
        transaction.set_rollback(True)

        return Response(
            {"error": str(error)},
            status=500,
        )

    tenant_url = (
        f"https://{hospital.slug}.medicorecloud.com"
    )

    login_url = (
        f"{tenant_url}/login"
    )

    def send_welcome_message():
        try:
            send_hospital_welcome_email(
                hospital=hospital,
                administrator=user,
                tenant_url=tenant_url,
                login_url=login_url,
            )
        except Exception as error:
            print(
                "Welcome email failed for hospital "
                f"{hospital.id}: {error}"
            )

    transaction.on_commit(send_welcome_message)

    return Response(
        {
            "success": True,
            "message": (
                "Hospital, administrator, subscription "
                "and default departments created successfully."
            ),
            "hospital": {
                "id": hospital.id,
                "name": hospital.name,
                "slug": hospital.slug,
            },
            "administrator": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": staff_profile.role,
            },
            "subscription": {
                "id": subscription.id,
                "plan": starter_plan.name,
                "plan_code": starter_plan.code,
                "status": subscription.status,
                "trial_started_at": (
                    subscription.trial_started_at.isoformat()
                    if subscription.trial_started_at
                    else None
                ),
                "trial_ends_at": (
                    subscription.trial_ends_at.isoformat()
                    if subscription.trial_ends_at
                    else None
                ),
                "monthly_price": str(
                    subscription.current_monthly_price
                ),
                "service_fee": str(
                    subscription.current_service_fee
                ),
                "service_fee_paid": (
                    subscription.service_fee_paid
                ),
                "currency": subscription.currency,
            },
            "departments": departments,
            "tenant_url": tenant_url,
            "login_url": login_url,
        },
        status=201,
    )
