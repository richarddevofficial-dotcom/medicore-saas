from django.urls import path

from .billing_center_views import (
    billing_center_dashboard,
    billing_center_hospitals,
)


urlpatterns = [
    path(
        "dashboard/",
        billing_center_dashboard,
        name="billing-center-dashboard",
    ),
    path(
        "hospitals/",
        billing_center_hospitals,
        name="billing-center-hospitals",
    ),
]
