from django.utils import timezone
from rest_framework import serializers

from pharmacy.models import Medicine
from rooms.models import Bed, Room, Ward
from staff.models import StaffProfile

from .models import (
    Admission,
    DischargeSummary,
    InpatientMedicationOrder,
    InpatientTransfer,
    MedicationAdministration,
    NursingObservation,
)


def display_name(instance):
    if not instance:
        return None

    first_name = getattr(
        instance,
        "first_name",
        "",
    )
    last_name = getattr(
        instance,
        "last_name",
        "",
    )

    full_name = (
        f"{first_name} {last_name}"
    ).strip()

    if full_name:
        return full_name

    user = getattr(
        instance,
        "user",
        None,
    )

    if user:
        user_full_name = user.get_full_name()

        if user_full_name:
            return user_full_name

        return user.email or user.username

    return str(instance)


class SimpleHospitalSerializer(
    serializers.Serializer
):
    id = serializers.IntegerField()
    name = serializers.CharField()
    slug = serializers.CharField()


class SimplePatientSerializer(
    serializers.Serializer
):
    id = serializers.IntegerField()
    name = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    patient_number = serializers.SerializerMethodField()

    def get_name(self, obj):
        return display_name(obj)

    def get_phone(self, obj):
        return (
            getattr(obj, "phone", None)
            or getattr(
                obj,
                "phone_number",
                None,
            )
        )

    def get_patient_number(self, obj):
        return (
            getattr(
                obj,
                "patient_number",
                None,
            )
            or getattr(
                obj,
                "patient_id",
                None,
            )
        )


class SimpleStaffSerializer(
    serializers.Serializer
):
    id = serializers.IntegerField()
    name = serializers.SerializerMethodField()
    role = serializers.CharField()

    def get_name(self, obj):
        return display_name(obj)


class SimpleWardSerializer(
    serializers.Serializer
):
    id = serializers.IntegerField()
    name = serializers.CharField()


class SimpleRoomSerializer(
    serializers.Serializer
):
    id = serializers.IntegerField()
    name = serializers.SerializerMethodField()

    def get_name(self, obj):
        return (
            getattr(obj, "name", None)
            or getattr(
                obj,
                "room_number",
                None,
            )
            or str(obj)
        )


class SimpleBedSerializer(
    serializers.Serializer
):
    id = serializers.IntegerField()
    name = serializers.SerializerMethodField()

    def get_name(self, obj):
        return (
            getattr(obj, "bed_number", None)
            or getattr(obj, "name", None)
            or str(obj)
        )


class NursingObservationSerializer(
    serializers.ModelSerializer
):
    recorded_by_detail = (
        SimpleStaffSerializer(
            source="recorded_by",
            read_only=True,
        )
    )

    class Meta:
        model = NursingObservation

        fields = [
            "id",
            "admission",
            "recorded_by",
            "recorded_by_detail",
            "temperature",
            "pulse_rate",
            "respiratory_rate",
            "systolic_bp",
            "diastolic_bp",
            "oxygen_saturation",
            "blood_glucose",
            "weight_kg",
            "fluid_intake_ml",
            "fluid_output_ml",
            "pain_score",
            "consciousness_level",
            "nursing_notes",
            "observed_at",
            "created_at",
        ]

        read_only_fields = [
            "admission",
            "recorded_by",
            "created_at",
        ]

    def validate_pain_score(self, value):
        if value is not None and value > 10:
            raise serializers.ValidationError(
                "Pain score must be between 0 and 10."
            )

        return value


class MedicationAdministrationSerializer(
    serializers.ModelSerializer
):
    administered_by_detail = (
        SimpleStaffSerializer(
            source="administered_by",
            read_only=True,
        )
    )

    class Meta:
        model = MedicationAdministration

        fields = [
            "id",
            "medication_order",
            "administered_by",
            "administered_by_detail",
            "administered_at",
            "dosage_given",
            "notes",
            "was_refused",
            "refusal_reason",
            "created_at",
        ]

        read_only_fields = [
            "medication_order",
            "administered_by",
            "created_at",
        ]

    def validate(self, attrs):
        was_refused = attrs.get(
            "was_refused",
            False,
        )

        refusal_reason = str(
            attrs.get(
                "refusal_reason",
                "",
            )
        ).strip()

        if was_refused and not refusal_reason:
            raise serializers.ValidationError(
                {
                    "refusal_reason": (
                        "A refusal reason is required "
                        "when medication is refused."
                    )
                }
            )

        return attrs


class InpatientMedicationOrderSerializer(
    serializers.ModelSerializer
):
    medicine_name = serializers.CharField(
        source="medicine.name",
        read_only=True,
    )

    prescribed_by_detail = (
        SimpleStaffSerializer(
            source="prescribed_by",
            read_only=True,
        )
    )

    administrations = (
        MedicationAdministrationSerializer(
            many=True,
            read_only=True,
        )
    )

    class Meta:
        model = InpatientMedicationOrder

        fields = [
            "id",
            "admission",
            "medicine",
            "medicine_name",
            "prescribed_by",
            "prescribed_by_detail",
            "dosage",
            "route",
            "frequency",
            "duration",
            "instructions",
            "start_at",
            "end_at",
            "status",
            "administrations",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "admission",
            "prescribed_by",
            "created_at",
            "updated_at",
        ]


class InpatientTransferSerializer(
    serializers.ModelSerializer
):
    from_ward_detail = SimpleWardSerializer(
        source="from_ward",
        read_only=True,
    )

    to_ward_detail = SimpleWardSerializer(
        source="to_ward",
        read_only=True,
    )

    from_room_detail = SimpleRoomSerializer(
        source="from_room",
        read_only=True,
    )

    to_room_detail = SimpleRoomSerializer(
        source="to_room",
        read_only=True,
    )

    from_bed_detail = SimpleBedSerializer(
        source="from_bed",
        read_only=True,
    )

    to_bed_detail = SimpleBedSerializer(
        source="to_bed",
        read_only=True,
    )

    class Meta:
        model = InpatientTransfer

        fields = [
            "id",
            "admission",
            "from_ward",
            "from_ward_detail",
            "from_room",
            "from_room_detail",
            "from_bed",
            "from_bed_detail",
            "to_ward",
            "to_ward_detail",
            "to_room",
            "to_room_detail",
            "to_bed",
            "to_bed_detail",
            "reason",
            "transferred_by",
            "transferred_at",
            "created_at",
        ]

        read_only_fields = [
            "admission",
            "from_ward",
            "from_room",
            "from_bed",
            "transferred_by",
            "created_at",
        ]


class DischargeSummarySerializer(
    serializers.ModelSerializer
):
    discharged_by_detail = (
        SimpleStaffSerializer(
            source="discharged_by",
            read_only=True,
        )
    )

    class Meta:
        model = DischargeSummary

        fields = [
            "id",
            "admission",
            "discharge_type",
            "final_diagnosis",
            "clinical_summary",
            "treatment_summary",
            "condition_at_discharge",
            "discharge_medications",
            "follow_up_instructions",
            "follow_up_date",
            "discharged_by",
            "discharged_by_detail",
            "approved_by",
            "discharged_at",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "admission",
            "discharged_by",
            "approved_by",
            "created_at",
            "updated_at",
        ]


class AdmissionListSerializer(
    serializers.ModelSerializer
):
    hospital_detail = (
        SimpleHospitalSerializer(
            source="hospital",
            read_only=True,
        )
    )

    patient_detail = (
        SimplePatientSerializer(
            source="patient",
            read_only=True,
        )
    )

    admitting_doctor_detail = (
        SimpleStaffSerializer(
            source="admitting_doctor",
            read_only=True,
        )
    )

    ward_detail = SimpleWardSerializer(
        source="ward",
        read_only=True,
    )

    room_detail = SimpleRoomSerializer(
        source="room",
        read_only=True,
    )

    bed_detail = SimpleBedSerializer(
        source="bed",
        read_only=True,
    )

    class Meta:
        model = Admission

        fields = [
            "id",
            "admission_number",
            "hospital",
            "hospital_detail",
            "patient",
            "patient_detail",
            "admitting_doctor",
            "admitting_doctor_detail",
            "ward",
            "ward_detail",
            "room",
            "room_detail",
            "bed",
            "bed_detail",
            "admission_type",
            "status",
            "provisional_diagnosis",
            "reason_for_admission",
            "admitted_at",
            "expected_discharge_date",
            "discharged_at",
            "is_active",
            "created_at",
            "updated_at",
        ]


class AdmissionDetailSerializer(
    AdmissionListSerializer
):
    observations = (
        NursingObservationSerializer(
            source="nursing_observations",
            many=True,
            read_only=True,
        )
    )

    medication_orders = (
        InpatientMedicationOrderSerializer(
            many=True,
            read_only=True,
        )
    )

    transfers = (
        InpatientTransferSerializer(
            many=True,
            read_only=True,
        )
    )

    discharge_summary = (
        DischargeSummarySerializer(
            read_only=True,
        )
    )

    class Meta(
        AdmissionListSerializer.Meta
    ):
        fields = (
            AdmissionListSerializer.Meta.fields
            + [
                "presenting_complaint",
                "admission_notes",
                "bill",
                "bed_assignment",
                "observations",
                "medication_orders",
                "transfers",
                "discharge_summary",
            ]
        )


class AdmissionCreateSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = Admission

        fields = [
            "patient",
            "admitting_doctor",
            "ward",
            "room",
            "bed",
            "admission_type",
            "provisional_diagnosis",
            "reason_for_admission",
            "presenting_complaint",
            "admission_notes",
            "expected_discharge_date",
        ]

    def validate(self, attrs):
        request = self.context["request"]
        hospital = self.context["hospital"]

        patient = attrs.get("patient")
        doctor = attrs.get(
            "admitting_doctor"
        )
        ward = attrs.get("ward")
        room = attrs.get("room")
        bed = attrs.get("bed")

        related_objects = {
            "patient": patient,
            "admitting_doctor": doctor,
            "ward": ward,
            "room": room,
            "bed": bed,
        }

        for field_name, instance in (
            related_objects.items()
        ):
            if (
                instance
                and hasattr(
                    instance,
                    "hospital_id",
                )
                and instance.hospital_id
                != hospital.id
            ):
                raise serializers.ValidationError(
                    {
                        field_name: (
                            "The selected record belongs "
                            "to another hospital."
                        )
                    }
                )

        duplicate = Admission.objects.filter(
            hospital=hospital,
            patient=patient,
            status__in=[
                Admission.STATUS_PENDING,
                Admission.STATUS_ADMITTED,
                Admission.STATUS_TRANSFERRED,
            ],
            is_active=True,
        ).exists()

        if duplicate:
            raise serializers.ValidationError(
                {
                    "patient": (
                        "This patient already has an "
                        "active or pending IPD admission."
                    )
                }
            )

        if room and ward:
            room_ward_id = getattr(
                room,
                "ward_id",
                None,
            )

            if (
                room_ward_id
                and room_ward_id != ward.id
            ):
                raise serializers.ValidationError(
                    {
                        "room": (
                            "The selected room does not "
                            "belong to the selected ward."
                        )
                    }
                )

        if bed and room:
            bed_room_id = getattr(
                bed,
                "room_id",
                None,
            )

            if (
                bed_room_id
                and bed_room_id != room.id
            ):
                raise serializers.ValidationError(
                    {
                        "bed": (
                            "The selected bed does not "
                            "belong to the selected room."
                        )
                    }
                )

        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        hospital = self.context["hospital"]

        return Admission.objects.create(
            hospital=hospital,
            admitted_by=request.user,
            **validated_data,
        )
