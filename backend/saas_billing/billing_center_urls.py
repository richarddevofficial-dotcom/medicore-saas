from django.urls import path

from .billing_center_views import (
    billing_center_dashboard,
)


urlpatterns = [
    path(
        "dashboard/",
        billing_center_dashboard,
        name="billing-center-dashboard",
    ),
]
