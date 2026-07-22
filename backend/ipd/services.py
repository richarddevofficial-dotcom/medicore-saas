from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from rooms.models import (
    Bed,
    BedAssignment,
    Room,
)

from .models import (
    Admission,
    InpatientTransfer,
)


def update_room_occupancy(room):
    if not room:
        return

    room.is_occupied = room.beds.filter(
        status=Bed.STATUS_OCCUPIED
        if hasattr(Bed, "STATUS_OCCUPIED")
        else "occupied",
    ).exists()

    room.save(
        update_fields=[
            "is_occupied",
        ]
    )


def validate_bed_for_hospital(
    *,
    bed,
    hospital,
):
    if bed.hospital_id != hospital.id:
        raise ValidationError(
            "The selected bed belongs to another hospital."
        )

    if not bed.is_active:
        raise ValidationError(
            "The selected bed is inactive."
        )

    if bed.status != "available":
        raise ValidationError(
            (
                "The selected bed is not available. "
                f"Current status: {bed.status}."
            )
        )

    if BedAssignment.objects.filter(
        bed=bed,
        released_at__isnull=True,
    ).exists():
        raise ValidationError(
            "The selected bed already has an active assignment."
        )


def validate_bed_relationships(
    *,
    bed,
    room=None,
    ward=None,
):
    selected_room = room or bed.room
    selected_ward = ward or selected_room.ward

    if bed.room_id != selected_room.id:
        raise ValidationError(
            "The selected bed does not belong to the selected room."
        )

    if selected_room.ward_id != selected_ward.id:
        raise ValidationError(
            "The selected room does not belong to the selected ward."
        )

    return selected_ward, selected_room


@transaction.atomic
def assign_bed_to_admission(
    *,
    admission,
    bed,
    assigned_by,
    notes="",
):
    admission = (
        Admission.objects
        .select_for_update()
        .select_related(
            "hospital",
            "patient",
            "ward",
            "room",
            "bed",
        )
        .get(pk=admission.pk)
    )

    bed = (
        Bed.objects
        .select_for_update()
        .select_related(
            "hospital",
            "room",
            "room__ward",
        )
        .get(pk=bed.pk)
    )

    validate_bed_for_hospital(
        bed=bed,
        hospital=admission.hospital,
    )

    ward, room = validate_bed_relationships(
        bed=bed,
        room=admission.room,
        ward=admission.ward,
    )

    if BedAssignment.objects.filter(
        patient=admission.patient,
        released_at__isnull=True,
    ).exists():
        raise ValidationError(
            "This patient already has an active bed assignment."
        )

    assignment = BedAssignment.objects.create(
        hospital=admission.hospital,
        patient=admission.patient,
        bed=bed,
        status="active",
        notes=notes,
        assigned_by=assigned_by,
        assigned_at=timezone.now(),
    )

    bed.status = "occupied"
    bed.save(
        update_fields=[
            "status",
        ]
    )

    update_room_occupancy(room)

    admission.ward = ward
    admission.room = room
    admission.bed = bed
    admission.bed_assignment = assignment

    admission.save(
        update_fields=[
            "ward",
            "room",
            "bed",
            "bed_assignment",
            "updated_at",
        ]
    )

    return admission, assignment


@transaction.atomic
def transfer_admission_bed(
    *,
    admission,
    target_bed,
    transferred_by,
    reason,
):
    admission = (
        Admission.objects
        .select_for_update()
        .select_related(
            "hospital",
            "patient",
            "ward",
            "room",
            "bed",
            "bed_assignment",
        )
        .get(pk=admission.pk)
    )

    if admission.status not in [
        Admission.STATUS_ADMITTED,
        Admission.STATUS_TRANSFERRED,
    ]:
        raise ValidationError(
            "Only admitted patients can be transferred."
        )

    target_bed = (
        Bed.objects
        .select_for_update()
        .select_related(
            "hospital",
            "room",
            "room__ward",
        )
        .get(pk=target_bed.pk)
    )

    validate_bed_for_hospital(
        bed=target_bed,
        hospital=admission.hospital,
    )

    target_ward, target_room = (
        validate_bed_relationships(
            bed=target_bed,
        )
    )

    current_assignment = (
        BedAssignment.objects
        .select_for_update()
        .filter(
            patient=admission.patient,
            released_at__isnull=True,
        )
        .select_related(
            "bed",
            "bed__room",
        )
        .first()
    )

    if not current_assignment:
        raise ValidationError(
            "The patient does not have an active bed assignment."
        )

    source_bed = current_assignment.bed
    source_room = source_bed.room

    if source_bed.id == target_bed.id:
        raise ValidationError(
            "The target bed is the same as the current bed."
        )

    current_assignment.status = "transferred"
    current_assignment.release_reason = (
        reason or "Patient transferred."
    )
    current_assignment.released_at = timezone.now()
    current_assignment.released_by = transferred_by

    current_assignment.save(
        update_fields=[
            "status",
            "release_reason",
            "released_at",
            "released_by",
        ]
    )

    source_bed.status = "available"
    source_bed.save(
        update_fields=[
            "status",
        ]
    )

    new_assignment = BedAssignment.objects.create(
        hospital=admission.hospital,
        patient=admission.patient,
        bed=target_bed,
        transfer_from=current_assignment,
        status="active",
        notes=reason,
        assigned_by=transferred_by,
        assigned_at=timezone.now(),
    )

    target_bed.status = "occupied"
    target_bed.save(
        update_fields=[
            "status",
        ]
    )

    transfer = InpatientTransfer.objects.create(
        admission=admission,
        from_ward=admission.ward,
        from_room=admission.room,
        from_bed=source_bed,
        to_ward=target_ward,
        to_room=target_room,
        to_bed=target_bed,
        reason=reason,
        transferred_by=transferred_by,
        transferred_at=timezone.now(),
    )

    admission.ward = target_ward
    admission.room = target_room
    admission.bed = target_bed
    admission.bed_assignment = new_assignment
    admission.status = Admission.STATUS_TRANSFERRED

    admission.save(
        update_fields=[
            "ward",
            "room",
            "bed",
            "bed_assignment",
            "status",
            "updated_at",
        ]
    )

    update_room_occupancy(source_room)
    update_room_occupancy(target_room)

    return admission, transfer, new_assignment


@transaction.atomic
def release_admission_bed(
    *,
    admission,
    released_by,
    release_reason="Patient discharged.",
    next_status="available",
):
    if next_status not in {
        "available",
        "cleaning",
        "maintenance",
    }:
        raise ValidationError(
            "Invalid next bed status."
        )

    admission = (
        Admission.objects
        .select_for_update()
        .select_related(
            "patient",
            "bed",
            "room",
            "bed_assignment",
        )
        .get(pk=admission.pk)
    )

    assignment = (
        BedAssignment.objects
        .select_for_update()
        .filter(
            patient=admission.patient,
            released_at__isnull=True,
        )
        .select_related(
            "bed",
            "bed__room",
        )
        .first()
    )

    if not assignment:
        return admission, None

    bed = assignment.bed
    room = bed.room

    assignment.status = "released"
    assignment.release_reason = release_reason
    assignment.released_at = timezone.now()
    assignment.released_by = released_by

    assignment.save(
        update_fields=[
            "status",
            "release_reason",
            "released_at",
            "released_by",
        ]
    )

    bed.status = next_status
    bed.save(
        update_fields=[
            "status",
        ]
    )

    update_room_occupancy(room)

    return admission, assignment
