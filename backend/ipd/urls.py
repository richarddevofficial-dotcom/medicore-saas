from django.urls import path

from .views import (
    admission_detail,
    admission_list_create,
    administer_medication,
    admit_patient,
    discharge_patient,
    ipd_dashboard,
    ipd_lookups,
    medication_orders,
    nursing_observations,
    transfer_patient,
)


app_name = "ipd"


urlpatterns = [
    path(
        "lookups/",
        ipd_lookups,
        name="lookups",
    ),
    path(
        "dashboard/",
        ipd_dashboard,
        name="dashboard",
    ),
    path(
        "admissions/",
        admission_list_create,
        name="admission-list-create",
    ),
    path(
        "admissions/<int:admission_id>/",
        admission_detail,
        name="admission-detail",
    ),
    path(
        "admissions/<int:admission_id>/admit/",
        admit_patient,
        name="admit-patient",
    ),
    path(
        (
            "admissions/"
            "<int:admission_id>/transfer/"
        ),
        transfer_patient,
        name="transfer-patient",
    ),
    path(
        (
            "admissions/"
            "<int:admission_id>/observations/"
        ),
        nursing_observations,
        name="nursing-observations",
    ),
    path(
        (
            "admissions/"
            "<int:admission_id>/medications/"
        ),
        medication_orders,
        name="medication-orders",
    ),
    path(
        (
            "medications/"
            "<int:medication_id>/administer/"
        ),
        administer_medication,
        name="administer-medication",
    ),
    path(
        (
            "admissions/"
            "<int:admission_id>/discharge/"
        ),
        discharge_patient,
        name="discharge-patient",
    ),
]
