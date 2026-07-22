from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import (
    api_view,
    permission_classes,
)
from rest_framework.permissions import (
    IsAuthenticated,
)
from rest_framework.response import Response

from staff.models import StaffProfile

from .models import (
    Admission,
    DischargeSummary,
    InpatientMedicationOrder,
    MedicationAdministration,
    NursingObservation,
)
from rooms.models import Bed

from .services import (
    assign_bed_to_admission,
    release_admission_bed,
    transfer_admission_bed,
)

from .serializers import (
    AdmissionCreateSerializer,
    AdmissionDetailSerializer,
    AdmissionListSerializer,
    DischargeSummarySerializer,
    InpatientMedicationOrderSerializer,
    MedicationAdministrationSerializer,
    NursingObservationSerializer,
)


READ_ROLES = {
    "admin",
    "doctor",
    "nurse",
    "receptionist",
    "cashier",
    "accountant",
    "pharmacist",
    "lab_technician",
    "radiographer",
}

CLINICAL_ROLES = {
    "admin",
    "doctor",
    "nurse",
}

ADMISSION_ROLES = {
    "admin",
    "doctor",
    "receptionist",
}

DISCHARGE_ROLES = {
    "admin",
    "doctor",
}


def get_user_profile(user):
    if not user or not user.is_authenticated:
        return None

    return (
        StaffProfile.objects
        .filter(
            user=user,
            is_active=True,
        )
        .select_related(
            "hospital",
            "user",
        )
        .first()
    )


def get_user_hospital(user):
    profile = get_user_profile(user)

    if profile:
        return profile.hospital

    return None


def is_platform_super_admin(user):
    return bool(
        user
        and user.is_authenticated
        and user.is_superuser
    )


def role_allowed(user, roles):
    if is_platform_super_admin(user):
        return True

    profile = get_user_profile(user)

    return bool(
        profile
        and profile.role in roles
    )


def admission_queryset(request):
    queryset = (
        Admission.objects
        .select_related(
            "hospital",
            "patient",
            "admitting_doctor",
            "admitting_doctor__user",
            "ward",
            "room",
            "bed",
            "bill",
            "bed_assignment",
        )
        .prefetch_related(
            "nursing_observations",
            "medication_orders",
            "medication_orders__medicine",
            "medication_orders__administrations",
            "transfers",
        )
    )

    if is_platform_super_admin(
        request.user
    ):
        hospital_id = request.query_params.get(
            "hospital_id"
        )

        if hospital_id:
            queryset = queryset.filter(
                hospital_id=hospital_id
            )

        return queryset

    hospital = get_user_hospital(
        request.user
    )

    if not hospital:
        return queryset.none()

    return queryset.filter(
        hospital=hospital
    )


def get_admission(request, admission_id):
    return admission_queryset(
        request
    ).filter(
        id=admission_id
    ).first()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ipd_dashboard(request):
    if not role_allowed(
        request.user,
        READ_ROLES,
    ):
        return Response(
            {
                "error": (
                    "You do not have permission "
                    "to view IPD information."
                )
            },
            status=403,
        )

    queryset = admission_queryset(request)
    today = timezone.localdate()

    active_queryset = queryset.filter(
        status__in=[
            Admission.STATUS_ADMITTED,
            Admission.STATUS_TRANSFERRED,
        ],
        is_active=True,
    )

    data = {
        "total_admissions": queryset.count(),
        "pending_admissions": queryset.filter(
            status=Admission.STATUS_PENDING
        ).count(),
        "current_inpatients": (
            active_queryset.count()
        ),
        "discharged_today": queryset.filter(
            status=Admission.STATUS_DISCHARGED,
            discharged_at__date=today,
        ).count(),
        "admitted_today": queryset.filter(
            admitted_at__date=today,
        ).count(),
        "emergency_admissions": (
            active_queryset.filter(
                admission_type=(
                    Admission.ADMISSION_EMERGENCY
                )
            ).count()
        ),
        "recent_admissions": (
            AdmissionListSerializer(
                queryset[:10],
                many=True,
            ).data
        ),
    }

    return Response(data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def admission_list_create(request):
    if request.method == "GET":
        if not role_allowed(
            request.user,
            READ_ROLES,
        ):
            return Response(
                {
                    "error": (
                        "You do not have permission "
                        "to view admissions."
                    )
                },
                status=403,
            )

        queryset = admission_queryset(
            request
        )

        search = str(
            request.query_params.get(
                "search",
                "",
            )
        ).strip()

        status_value = str(
            request.query_params.get(
                "status",
                "",
            )
        ).strip()

        admission_type = str(
            request.query_params.get(
                "admission_type",
                "",
            )
        ).strip()

        if search:
            queryset = queryset.filter(
                Q(
                    admission_number__icontains=search
                )
                | Q(
                    patient__first_name__icontains=search
                )
                | Q(
                    patient__last_name__icontains=search
                )
                | Q(
                    provisional_diagnosis__icontains=search
                )
            )

        if status_value:
            queryset = queryset.filter(
                status=status_value
            )

        if admission_type:
            queryset = queryset.filter(
                admission_type=admission_type
            )

        serializer = AdmissionListSerializer(
            queryset[:500],
            many=True,
        )

        return Response(
            {
                "count": queryset.count(),
                "results": serializer.data,
            }
        )

    if not role_allowed(
        request.user,
        ADMISSION_ROLES,
    ):
        return Response(
            {
                "error": (
                    "You do not have permission "
                    "to create admissions."
                )
            },
            status=403,
        )

    hospital = get_user_hospital(
        request.user
    )

    if not hospital:
        return Response(
            {
                "error": (
                    "Your user account is not linked "
                    "to an active hospital."
                )
            },
            status=400,
        )

    serializer = AdmissionCreateSerializer(
        data=request.data,
        context={
            "request": request,
            "hospital": hospital,
        },
    )

    serializer.is_valid(
        raise_exception=True
    )

    admission = serializer.save()

    return Response(
        {
            "message": (
                "IPD admission request created."
            ),
            "admission": (
                AdmissionDetailSerializer(
                    admission
                ).data
            ),
        },
        status=201,
    )


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def admission_detail(
    request,
    admission_id,
):
    admission = get_admission(
        request,
        admission_id,
    )

    if not admission:
        return Response(
            {
                "error": (
                    "Admission not found."
                )
            },
            status=404,
        )

    if request.method == "GET":
        if not role_allowed(
            request.user,
            READ_ROLES,
        ):
            return Response(
                {
                    "error": (
                        "You do not have permission "
                        "to view this admission."
                    )
                },
                status=403,
            )

        return Response(
            AdmissionDetailSerializer(
                admission
            ).data
        )

    if not role_allowed(
        request.user,
        ADMISSION_ROLES,
    ):
        return Response(
            {
                "error": (
                    "You do not have permission "
                    "to update admissions."
                )
            },
            status=403,
        )

    allowed_fields = {
        "admitting_doctor",
        "admission_type",
        "provisional_diagnosis",
        "reason_for_admission",
        "presenting_complaint",
        "admission_notes",
        "expected_discharge_date",
    }

    update_data = {
        key: value
        for key, value in request.data.items()
        if key in allowed_fields
    }

    serializer = AdmissionDetailSerializer(
        admission,
        data=update_data,
        partial=True,
    )

    serializer.is_valid(
        raise_exception=True
    )

    serializer.save()

    return Response(
        {
            "message": (
                "Admission updated successfully."
            ),
            "admission": serializer.data,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def admit_patient(
    request,
    admission_id,
):
    if not role_allowed(
        request.user,
        ADMISSION_ROLES,
    ):
        return Response(
            {
                "error": (
                    "You do not have permission "
                    "to admit patients."
                )
            },
            status=403,
        )

    admission = (
        admission_queryset(request)
        .select_for_update()
        .filter(
            id=admission_id
        )
        .first()
    )

    if not admission:
        return Response(
            {"error": "Admission not found."},
            status=404,
        )

    if admission.status != (
        Admission.STATUS_PENDING
    ):
        return Response(
            {
                "error": (
                    "Only pending admissions can "
                    "be admitted."
                )
            },
            status=400,
        )

    bed_id = (
        request.data.get("bed_id")
        or admission.bed_id
    )

    if not bed_id:
        return Response(
            {
                "error": (
                    "A bed must be selected before "
                    "the patient can be admitted."
                )
            },
            status=400,
        )

    bed = Bed.objects.filter(
        id=bed_id
    ).first()

    if not bed:
        return Response(
            {
                "error": "Selected bed not found."
            },
            status=404,
        )

    try:
        admission, assignment = (
            assign_bed_to_admission(
                admission=admission,
                bed=bed,
                assigned_by=request.user,
                notes=str(
                    request.data.get(
                        "notes",
                        "",
                    )
                ).strip(),
            )
        )
    except Exception as error:
        return Response(
            {
                "error": str(error),
            },
            status=400,
        )

    admission.status = (
        Admission.STATUS_ADMITTED
    )
    admission.admitted_at = timezone.now()
    admission.is_active = True

    admission.save(
        update_fields=[
            "status",
            "admitted_at",
            "is_active",
            "updated_at",
        ]
    )

    return Response(
        {
            "message": (
                "Patient admitted and bed "
                "assigned successfully."
            ),
            "bed_assignment_id": assignment.id,
            "admission": (
                AdmissionDetailSerializer(
                    admission
                ).data
            ),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def transfer_patient(
    request,
    admission_id,
):
    if not role_allowed(
        request.user,
        {
            "admin",
            "doctor",
            "nurse",
            "receptionist",
        },
    ):
        return Response(
            {
                "error": (
                    "You do not have permission "
                    "to transfer inpatients."
                )
            },
            status=403,
        )

    admission = get_admission(
        request,
        admission_id,
    )

    if not admission:
        return Response(
            {"error": "Admission not found."},
            status=404,
        )

    target_bed_id = request.data.get(
        "target_bed_id"
    )

    reason = str(
        request.data.get(
            "reason",
            "",
        )
    ).strip()

    if not target_bed_id:
        return Response(
            {
                "error": (
                    "target_bed_id is required."
                )
            },
            status=400,
        )

    if not reason:
        return Response(
            {
                "error": (
                    "A transfer reason is required."
                )
            },
            status=400,
        )

    target_bed = Bed.objects.filter(
        id=target_bed_id
    ).first()

    if not target_bed:
        return Response(
            {
                "error": (
                    "Target bed not found."
                )
            },
            status=404,
        )

    try:
        admission, transfer, assignment = (
            transfer_admission_bed(
                admission=admission,
                target_bed=target_bed,
                transferred_by=request.user,
                reason=reason,
            )
        )
    except Exception as error:
        return Response(
            {
                "error": str(error),
            },
            status=400,
        )

    return Response(
        {
            "message": (
                "Patient transferred successfully."
            ),
            "transfer_id": transfer.id,
            "bed_assignment_id": assignment.id,
            "admission": (
                AdmissionDetailSerializer(
                    admission
                ).data
            ),
        }
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def nursing_observations(
    request,
    admission_id,
):
    admission = get_admission(
        request,
        admission_id,
    )

    if not admission:
        return Response(
            {"error": "Admission not found."},
            status=404,
        )

    if request.method == "GET":
        if not role_allowed(
            request.user,
            READ_ROLES,
        ):
            return Response(
                {
                    "error": (
                        "You do not have permission "
                        "to view observations."
                    )
                },
                status=403,
            )

        serializer = (
            NursingObservationSerializer(
                admission.nursing_observations.all(),
                many=True,
            )
        )

        return Response(
            {
                "count": (
                    admission.nursing_observations.count()
                ),
                "results": serializer.data,
            }
        )

    if not role_allowed(
        request.user,
        CLINICAL_ROLES,
    ):
        return Response(
            {
                "error": (
                    "Only clinical staff can record "
                    "nursing observations."
                )
            },
            status=403,
        )

    profile = get_user_profile(
        request.user
    )

    serializer = NursingObservationSerializer(
        data=request.data
    )

    serializer.is_valid(
        raise_exception=True
    )

    observation = serializer.save(
        admission=admission,
        recorded_by=profile,
    )

    return Response(
        {
            "message": (
                "Nursing observation recorded."
            ),
            "observation": (
                NursingObservationSerializer(
                    observation
                ).data
            ),
        },
        status=201,
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def medication_orders(
    request,
    admission_id,
):
    admission = get_admission(
        request,
        admission_id,
    )

    if not admission:
        return Response(
            {"error": "Admission not found."},
            status=404,
        )

    if request.method == "GET":
        if not role_allowed(
            request.user,
            READ_ROLES,
        ):
            return Response(
                {
                    "error": (
                        "You do not have permission "
                        "to view medication orders."
                    )
                },
                status=403,
            )

        serializer = (
            InpatientMedicationOrderSerializer(
                admission.medication_orders.all(),
                many=True,
            )
        )

        return Response(
            {
                "count": (
                    admission.medication_orders.count()
                ),
                "results": serializer.data,
            }
        )

    if not role_allowed(
        request.user,
        {
            "admin",
            "doctor",
        },
    ):
        return Response(
            {
                "error": (
                    "Only a doctor or hospital "
                    "administrator can prescribe "
                    "IPD medication."
                )
            },
            status=403,
        )

    profile = get_user_profile(
        request.user
    )

    serializer = (
        InpatientMedicationOrderSerializer(
            data=request.data
        )
    )

    serializer.is_valid(
        raise_exception=True
    )

    medicine = serializer.validated_data[
        "medicine"
    ]

    medicine_hospital_id = getattr(
        medicine,
        "hospital_id",
        None,
    )

    if (
        medicine_hospital_id
        and medicine_hospital_id
        != admission.hospital_id
    ):
        return Response(
            {
                "error": (
                    "The selected medicine belongs "
                    "to another hospital."
                )
            },
            status=400,
        )

    medication_order = serializer.save(
        admission=admission,
        prescribed_by=profile,
    )

    return Response(
        {
            "message": (
                "Medication order created."
            ),
            "medication_order": (
                InpatientMedicationOrderSerializer(
                    medication_order
                ).data
            ),
        },
        status=201,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def administer_medication(
    request,
    medication_id,
):
    if not role_allowed(
        request.user,
        {
            "admin",
            "doctor",
            "nurse",
        },
    ):
        return Response(
            {
                "error": (
                    "You do not have permission "
                    "to administer medication."
                )
            },
            status=403,
        )

    queryset = (
        InpatientMedicationOrder.objects
        .select_related(
            "admission",
            "admission__hospital",
            "medicine",
        )
    )

    if not is_platform_super_admin(
        request.user
    ):
        hospital = get_user_hospital(
            request.user
        )

        queryset = queryset.filter(
            admission__hospital=hospital
        )

    medication_order = queryset.filter(
        id=medication_id
    ).first()

    if not medication_order:
        return Response(
            {
                "error": (
                    "Medication order not found."
                )
            },
            status=404,
        )

    if medication_order.status != (
        InpatientMedicationOrder.STATUS_ACTIVE
    ):
        return Response(
            {
                "error": (
                    "Only active medication orders "
                    "can be administered."
                )
            },
            status=400,
        )

    profile = get_user_profile(
        request.user
    )

    serializer = (
        MedicationAdministrationSerializer(
            data=request.data
        )
    )

    serializer.is_valid(
        raise_exception=True
    )

    administration = serializer.save(
        medication_order=medication_order,
        administered_by=profile,
    )

    return Response(
        {
            "message": (
                "Medication administration recorded."
            ),
            "administration": (
                MedicationAdministrationSerializer(
                    administration
                ).data
            ),
        },
        status=201,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def discharge_patient(
    request,
    admission_id,
):
    if not role_allowed(
        request.user,
        DISCHARGE_ROLES,
    ):
        return Response(
            {
                "error": (
                    "Only a doctor or hospital "
                    "administrator can discharge "
                    "a patient."
                )
            },
            status=403,
        )

    admission = (
        admission_queryset(request)
        .select_for_update()
        .filter(
            id=admission_id
        )
        .first()
    )

    if not admission:
        return Response(
            {"error": "Admission not found."},
            status=404,
        )

    if admission.status not in [
        Admission.STATUS_ADMITTED,
        Admission.STATUS_TRANSFERRED,
    ]:
        return Response(
            {
                "error": (
                    "Only admitted patients can "
                    "be discharged."
                )
            },
            status=400,
        )

    if hasattr(
        admission,
        "discharge_summary",
    ):
        return Response(
            {
                "error": (
                    "This admission has already "
                    "been discharged."
                )
            },
            status=409,
        )

    profile = get_user_profile(
        request.user
    )

    serializer = DischargeSummarySerializer(
        data=request.data
    )

    serializer.is_valid(
        raise_exception=True
    )

    discharge = serializer.save(
        admission=admission,
        discharged_by=profile,
        approved_by=request.user,
        discharged_at=timezone.now(),
    )

    admission.status = (
        Admission.STATUS_DISCHARGED
    )
    admission.discharged_at = (
        discharge.discharged_at
    )
    admission.is_active = False

    admission.save(
        update_fields=[
            "status",
            "discharged_at",
            "is_active",
            "updated_at",
        ]
    )

    next_bed_status = str(
        request.data.get(
            "next_bed_status",
            "cleaning",
        )
    ).strip()

    release_reason = str(
        request.data.get(
            "bed_release_reason",
            "Patient discharged.",
        )
    ).strip()

    try:
        release_admission_bed(
            admission=admission,
            released_by=request.user,
            release_reason=release_reason,
            next_status=next_bed_status,
        )
    except Exception as error:
        return Response(
            {
                "error": (
                    "Discharge was recorded, but "
                    f"the bed could not be released: {error}"
                )
            },
            status=500,
        )

    return Response(
        {
            "message": (
                "Patient discharged successfully."
            ),
            "discharge": (
                DischargeSummarySerializer(
                    discharge
                ).data
            ),
            "admission": (
                AdmissionDetailSerializer(
                    admission
                ).data
            ),
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ipd_lookups(request):
    if not role_allowed(
        request.user,
        READ_ROLES,
    ):
        return Response(
            {
                "error": (
                    "You do not have permission "
                    "to access IPD lookup data."
                )
            },
            status=403,
        )

    hospital = get_user_hospital(
        request.user
    )

    if (
        not hospital
        and not is_platform_super_admin(
            request.user
        )
    ):
        return Response(
            {
                "error": (
                    "Your account is not linked "
                    "to an active hospital."
                )
            },
            status=400,
        )

    from patients.models import Patient
    from pharmacy.models import Medicine
    from rooms.models import Bed, Room, Ward
    from staff.models import StaffProfile

    def model_has_field(model, field_name):
        return any(
            field.name == field_name
            for field in model._meta.fields
        )

    def tenant_queryset(model):
        queryset = model.objects.all()

        if (
            hospital
            and model_has_field(
                model,
                "hospital",
            )
        ):
            queryset = queryset.filter(
                hospital=hospital
            )

        return queryset

    patient_queryset = tenant_queryset(
        Patient
    )

    if model_has_field(
        Patient,
        "is_active",
    ):
        patient_queryset = (
            patient_queryset.filter(
                is_active=True
            )
        )

    patient_search = str(
        request.query_params.get(
            "patient_search",
            "",
        )
    ).strip()

    if patient_search:
        patient_filters = Q()

        for field_name in [
            "first_name",
            "last_name",
            "phone",
            "phone_number",
            "patient_number",
            "patient_id",
        ]:
            if model_has_field(
                Patient,
                field_name,
            ):
                patient_filters |= Q(
                    **{
                        (
                            f"{field_name}"
                            "__icontains"
                        ): patient_search
                    }
                )

        if patient_filters:
            patient_queryset = (
                patient_queryset.filter(
                    patient_filters
                )
            )

    staff_queryset = tenant_queryset(
        StaffProfile
    ).select_related(
        "user"
    )

    if model_has_field(
        StaffProfile,
        "is_active",
    ):
        staff_queryset = (
            staff_queryset.filter(
                is_active=True
            )
        )

    doctors_queryset = (
        staff_queryset.filter(
            role="doctor"
        )
    )

    wards_queryset = tenant_queryset(
        Ward
    )

    if model_has_field(
        Ward,
        "is_active",
    ):
        wards_queryset = (
            wards_queryset.filter(
                is_active=True
            )
        )

    rooms_queryset = tenant_queryset(
        Room
    ).select_related(
        "ward"
    )

    if model_has_field(
        Room,
        "is_active",
    ):
        rooms_queryset = (
            rooms_queryset.filter(
                is_active=True
            )
        )

    beds_queryset = tenant_queryset(
        Bed
    ).select_related(
        "room",
        "room__ward",
    ).filter(
        status="available",
        is_active=True,
    )

    medicines_queryset = tenant_queryset(
        Medicine
    )

    if model_has_field(
        Medicine,
        "is_active",
    ):
        medicines_queryset = (
            medicines_queryset.filter(
                is_active=True
            )
        )

    def patient_name(patient):
        first_name = getattr(
            patient,
            "first_name",
            "",
        )

        last_name = getattr(
            patient,
            "last_name",
            "",
        )

        name = (
            f"{first_name} {last_name}"
        ).strip()

        return name or str(patient)

    def patient_number(patient):
        return (
            getattr(
                patient,
                "patient_number",
                None,
            )
            or getattr(
                patient,
                "patient_id",
                None,
            )
            or str(patient.id)
        )

    def patient_phone(patient):
        return (
            getattr(
                patient,
                "phone",
                None,
            )
            or getattr(
                patient,
                "phone_number",
                None,
            )
            or ""
        )

    patients = [
        {
            "id": patient.id,
            "name": patient_name(
                patient
            ),
            "patient_number": (
                patient_number(patient)
            ),
            "phone": patient_phone(
                patient
            ),
        }
        for patient in patient_queryset[
            :200
        ]
    ]

    doctors = [
        {
            "id": doctor.id,
            "name": (
                doctor.user.get_full_name()
                or doctor.user.email
                or str(doctor)
            ),
            "specialization": (
                getattr(
                    doctor,
                    "specialization",
                    "",
                )
                or ""
            ),
        }
        for doctor in doctors_queryset[
            :200
        ]
    ]

    wards = [
        {
            "id": ward.id,
            "name": ward.name,
            "ward_type": ward.ward_type,
            "floor": ward.floor,
        }
        for ward in wards_queryset.order_by(
            "name"
        )
    ]

    rooms = [
        {
            "id": room.id,
            "ward_id": room.ward_id,
            "room_number": (
                room.room_number
            ),
            "room_type": room.room_type,
            "capacity": room.capacity,
            "is_occupied": (
                room.is_occupied
            ),
        }
        for room in rooms_queryset.order_by(
            "room_number"
        )
    ]

    beds = [
        {
            "id": bed.id,
            "room_id": bed.room_id,
            "ward_id": bed.room.ward_id,
            "bed_number": (
                bed.bed_number
            ),
            "bed_type": bed.bed_type,
            "status": bed.status,
            "price_per_day": str(
                bed.price_per_day
            ),
        }
        for bed in beds_queryset.order_by(
            "room__room_number",
            "bed_number",
        )
    ]

    medicines = [
        {
            "id": medicine.id,
            "name": medicine.name,
            "generic_name": (
                getattr(
                    medicine,
                    "generic_name",
                    "",
                )
                or ""
            ),
            "strength": (
                getattr(
                    medicine,
                    "strength",
                    "",
                )
                or ""
            ),
        }
        for medicine in (
            medicines_queryset.order_by(
                "name"
            )[:500]
        )
    ]

    return Response(
        {
            "patients": patients,
            "doctors": doctors,
            "wards": wards,
            "rooms": rooms,
            "beds": beds,
            "medicines": medicines,
        }
    )
