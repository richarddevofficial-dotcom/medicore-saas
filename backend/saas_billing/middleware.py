import json

from django.http import JsonResponse

from .models import HospitalSubscription
from .services import get_subscription_access


class SubscriptionAccessMiddleware:
    """
    Restrict expired tenants to authentication and billing endpoints.

    This middleware does not restrict platform super administrators.
    """

    ALLOWED_PATH_PREFIXES = (
        "/admin/",
        "/api/v1/auth/",
        "/api/v1/token/",
        "/api/v1/saas-billing/",
        "/api/v1/public/",
        "/static/",
        "/media/",
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)

        if not user or not user.is_authenticated:
            return self.get_response(request)

        if user.is_superuser:
            return self.get_response(request)

        if request.path.startswith(self.ALLOWED_PATH_PREFIXES):
            return self.get_response(request)

        staff_profile = getattr(user, "staff_profile", None)

        if not staff_profile or not staff_profile.hospital:
            return self.get_response(request)

        try:
            subscription = HospitalSubscription.objects.get(
                hospital=staff_profile.hospital
            )
        except HospitalSubscription.DoesNotExist:
            return JsonResponse(
                {
                    "code": "SUBSCRIPTION_MISSING",
                    "message": "Hospital subscription not configured.",
                    "renewal_required": True,
                    "billing_only": True,
                },
                status=403,
            )

        access = get_subscription_access(subscription)

        if access["billing_only"]:
            return JsonResponse(
                {
                    "code": "SUBSCRIPTION_EXPIRED",
                    "message": "Your MediCoreCloud subscription has expired.",
                    "status": subscription.status,
                    "subscription_end_date": (
                        subscription.end_date.isoformat()
                        if subscription.end_date
                        else None
                    ),
                    "renewal_required": True,
                    "billing_only": True,
                    "billing_url": "/settings/billing",
                },
                status=403,
            )

        response = self.get_response(request)

        if subscription.status == HospitalSubscription.STATUS_GRACE:
            response["X-MediCore-Subscription-Warning"] = (
                "grace-period"
            )

            response["X-MediCore-Grace-Days-Remaining"] = str(
                access["grace_days_remaining"]
            )

        return response
