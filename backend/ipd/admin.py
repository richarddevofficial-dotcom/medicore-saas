from django.contrib import admin

from .models import (
    Admission,
    DischargeSummary,
    InpatientMedicationOrder,
    InpatientTransfer,
    MedicationAdministration,
    NursingObservation,
)


@admin.register(Admission)
class AdmissionAdmin(admin.ModelAdmin):
    list_display = [
        "admission_number",
        "hospital",
        "patient",
        "status",
        "ward",
        "room",
        "bed",
        "admitted_at",
    ]

    list_filter = [
        "status",
        "admission_type",
        "hospital",
    ]

    search_fields = [
        "admission_number",
        "patient__first_name",
        "patient__last_name",
    ]


@admin.register(InpatientTransfer)
class InpatientTransferAdmin(admin.ModelAdmin):
    list_display = [
        "admission",
        "from_bed",
        "to_bed",
        "transferred_at",
    ]


@admin.register(NursingObservation)
class NursingObservationAdmin(admin.ModelAdmin):
    list_display = [
        "admission",
        "recorded_by",
        "temperature",
        "pulse_rate",
        "oxygen_saturation",
        "observed_at",
    ]


@admin.register(InpatientMedicationOrder)
class InpatientMedicationOrderAdmin(admin.ModelAdmin):
    list_display = [
        "admission",
        "medicine",
        "dosage",
        "frequency",
        "status",
        "start_at",
    ]


@admin.register(MedicationAdministration)
class MedicationAdministrationAdmin(
    admin.ModelAdmin
):
    list_display = [
        "medication_order",
        "administered_by",
        "dosage_given",
        "administered_at",
        "was_refused",
    ]


@admin.register(DischargeSummary)
class DischargeSummaryAdmin(admin.ModelAdmin):
    list_display = [
        "admission",
        "discharge_type",
        "discharged_by",
        "discharged_at",
    ]
