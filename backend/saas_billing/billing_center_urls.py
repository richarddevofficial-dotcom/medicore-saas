from django.urls import path

from .billing_center_views import (
    billing_center_change_plan,
    billing_center_dashboard,
    billing_center_end_trial,
    billing_center_extend_trial,
    billing_center_hospital_detail,
    billing_center_hospitals,
    billing_center_reactivate_subscription,
    billing_center_suspend_subscription,
    billing_center_waive_service_fee,
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
    path(
        "hospitals/<int:hospital_id>/",
        billing_center_hospital_detail,
        name="billing-center-hospital-detail",
    ),
    path(
        "hospitals/<int:hospital_id>/extend-trial/",
        billing_center_extend_trial,
        name="billing-center-extend-trial",
    ),
    path(
        "hospitals/<int:hospital_id>/end-trial/",
        billing_center_end_trial,
        name="billing-center-end-trial",
    ),
    path(
        "hospitals/<int:hospital_id>/suspend/",
        billing_center_suspend_subscription,
        name="billing-center-suspend-subscription",
    ),
    path(
        "hospitals/<int:hospital_id>/reactivate/",
        billing_center_reactivate_subscription,
        name="billing-center-reactivate-subscription",
    ),
    path(
        "hospitals/<int:hospital_id>/change-plan/",
        billing_center_change_plan,
        name="billing-center-change-plan",
    ),
    path(
        "hospitals/<int:hospital_id>/waive-service-fee/",
        billing_center_waive_service_fee,
        name="billing-center-waive-service-fee",
    ),
]
