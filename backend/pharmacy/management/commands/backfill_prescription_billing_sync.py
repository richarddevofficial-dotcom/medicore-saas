from decimal import Decimal

from django.core.management.base import BaseCommand

from billing.models import Bill
from pharmacy.models import Medicine, Prescription


class Command(BaseCommand):
    help = "Backfill bill medicine fees from existing prescriptions and sync prescription payment statuses."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview changes without saving to the database.",
        )
        parser.add_argument(
            "--auto-create-bills",
            action="store_true",
            help="Create missing bills for patients who already have prescriptions.",
        )

    def handle(self, *args, **options):
        dry_run = bool(options.get("dry_run"))
        auto_create_bills = bool(options.get("auto_create_bills"))

        stats = {
            "patients_with_prescriptions": 0,
            "bill_updates": 0,
            "bill_created": 0,
            "bill_missing": 0,
            "prescription_to_ready": 0,
            "prescription_to_pending": 0,
            "patients_skipped_no_patient": 0,
        }

        patient_ids = (
            Prescription.objects.exclude(patient__isnull=True)
            .values_list("patient_id", flat=True)
            .distinct()
        )

        for patient_id in patient_ids:
            prescriptions = list(
                Prescription.objects.filter(patient_id=patient_id).exclude(status="cancelled")
            )
            if not prescriptions:
                continue

            patient = prescriptions[0].patient
            if not patient:
                stats["patients_skipped_no_patient"] += 1
                continue

            stats["patients_with_prescriptions"] += 1

            medicine_total = Decimal("0")
            for prescription in prescriptions:
                amount = Decimal(str(prescription.medicine_amount or 0))
                if amount <= 0:
                    medicine = Medicine.objects.filter(
                        hospital=prescription.hospital,
                        name__iexact=prescription.medicine_name,
                    ).first()
                    if medicine:
                        qty = Decimal(str(prescription.quantity_prescribed or 1))
                        amount = Decimal(str(medicine.selling_price or 0)) * qty
                medicine_total += amount

            bill = (
                Bill.objects.filter(hospital=patient.hospital, patient_mrn=patient.mrn)
                .order_by("-created_at")
                .first()
            )

            if not bill:
                if not auto_create_bills:
                    stats["bill_missing"] += 1
                    continue

                if dry_run:
                    stats["bill_created"] += 1
                    continue

                bill = Bill.objects.create(
                    hospital=patient.hospital,
                    patient_name=f"{patient.first_name} {patient.last_name}".strip(),
                    patient_mrn=patient.mrn,
                    consultation_fee=Decimal("0"),
                    lab_fee=Decimal("0"),
                    medicine_fee=medicine_total,
                    room_fee=Decimal("0"),
                    other_fee=Decimal("0"),
                    amount_paid=Decimal("0"),
                    payment_method="cash",
                    status="pending",
                    notes="Auto-created by prescription backfill sync",
                )
                stats["bill_created"] += 1

            current_medicine_fee = Decimal(str(bill.medicine_fee or 0))
            if current_medicine_fee != medicine_total:
                if not dry_run:
                    bill.medicine_fee = medicine_total
                    bill.save()
                paid = Decimal(str(bill.amount_paid or 0))
                consultation_fee = Decimal(str(bill.consultation_fee or 0))
                lab_fee = Decimal(str(bill.lab_fee or 0))
                total = (
                    consultation_fee
                    + lab_fee
                    + medicine_total
                    + Decimal(str(bill.room_fee or 0))
                    + Decimal(str(bill.other_fee or 0))
                )
                if paid >= total and total > 0:
                    bill.status = "paid"
                elif paid > 0:
                    bill.status = "partial"
                else:
                    bill.status = "pending"
                if not dry_run:
                    bill.save(update_fields=["status", "updated_at"])
                stats["bill_updates"] += 1

            consultation_fee = Decimal(str(bill.consultation_fee or 0))
            lab_fee = Decimal(str(bill.lab_fee or 0))
            required_for_medicine = consultation_fee + lab_fee + medicine_total
            paid = Decimal(str(bill.amount_paid or 0))
            medicine_stage_paid = medicine_total > 0 and paid >= required_for_medicine

            for prescription in prescriptions:
                if prescription.status not in ["pending", "ready"]:
                    continue

                if medicine_stage_paid and prescription.status == "pending":
                    if not dry_run:
                        prescription.status = "ready"
                        prescription.save(update_fields=["status"])
                    stats["prescription_to_ready"] += 1

                if not medicine_stage_paid and prescription.status == "ready":
                    if not dry_run:
                        prescription.status = "pending"
                        prescription.save(update_fields=["status"])
                    stats["prescription_to_pending"] += 1

        mode = "DRY RUN" if dry_run else "APPLIED"
        self.stdout.write(self.style.SUCCESS(f"Backfill {mode} complete."))
        self.stdout.write(
            f"patients_with_prescriptions={stats['patients_with_prescriptions']} "
            f"bill_updates={stats['bill_updates']} "
            f"bill_created={stats['bill_created']} "
            f"bill_missing={stats['bill_missing']} "
            f"prescription_to_ready={stats['prescription_to_ready']} "
            f"prescription_to_pending={stats['prescription_to_pending']} "
            f"patients_skipped_no_patient={stats['patients_skipped_no_patient']}"
        )
