from rest_framework import serializers
from decimal import Decimal
from .models import Patient
from pharmacy.models import Prescription, Medicine
from billing.models import Bill


def _calculate_medicine_totals(patient):
    prescriptions = Prescription.objects.filter(patient=patient)
    total = Decimal("0")
    count = 0

    for prescription in prescriptions:
        amount = Decimal(str(prescription.medicine_amount or 0))
        if amount <= 0:
            medicine = Medicine.objects.filter(
                hospital=patient.hospital,
                name__iexact=prescription.medicine_name,
            ).first()
            if medicine:
                quantity = prescription.quantity_prescribed or 1
                amount = Decimal(str(medicine.selling_price or 0)) * Decimal(str(quantity))

        total += amount
        count += 1

    return total, count


def _get_latest_bill(patient):
    return Bill.objects.filter(
        hospital=patient.hospital,
        patient_mrn=patient.mrn,
    ).order_by('-created_at').first()


def _is_stage_paid(patient, stage):
    bill = _get_latest_bill(patient)
    if not bill:
        return False

    paid = Decimal(str(bill.amount_paid or 0))
    consultation_fee = Decimal(str(bill.consultation_fee or 0))
    lab_fee = Decimal(str(bill.lab_fee or 0))

    if stage == 'consultation':
        return consultation_fee > 0 and paid >= consultation_fee

    if stage == 'lab':
        required = consultation_fee + lab_fee
        return consultation_fee > 0 and lab_fee > 0 and paid >= required

    return False


def _get_workflow_status(patient):
    if patient.status == 'treated':
        return 'Treated'

    if patient.status in ['waiting', 'in_consultation']:
        return 'Awaiting Service' if _is_stage_paid(patient, 'consultation') else 'Awaiting Payment'

    if patient.status in ['lab_requested', 'lab_in_progress', 'lab_completed']:
        return 'Awaiting Service' if _is_stage_paid(patient, 'lab') else 'Awaiting Payment'

    if patient.status in ['imaging_requested', 'imaging_completed']:
        return 'Awaiting Service' if _is_stage_paid(patient, 'consultation') else 'Awaiting Payment'

    return patient.get_status_display()

class PatientListSerializer(serializers.ModelSerializer):
    age = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    workflow_status = serializers.SerializerMethodField()
    medicine_fee_calculated = serializers.SerializerMethodField()
    medicine_prescriptions_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Patient
        fields = [
            'id', 'mrn', 'first_name', 'last_name',
            'phone', 'gender', 'blood_group',
            'date_of_birth', 'age', 'status', 'status_display',
            'workflow_status',
            'assigned_doctor', 'doctor_name', 'symptoms',
            'lab_test_requested', 'lab_test_results',
            'is_active', 'created_at',
            'lab_test_requested', 'lab_test_results',
            'imaging_requested', 'imaging_results',
            'lab_test_requested', 'lab_test_results',
            'imaging_requested', 'imaging_results',
            'medicine_fee_calculated', 'medicine_prescriptions_count',
        ]
    
    def get_age(self, obj):
        from datetime import date
        today = date.today()
        return today.year - obj.date_of_birth.year - (
            (today.month, today.day) < (obj.date_of_birth.month, obj.date_of_birth.day)
        )
    
    def get_doctor_name(self, obj):
        if obj.assigned_doctor:
            return f"Dr. {obj.assigned_doctor.user.get_full_name()}"
        return None

    def get_medicine_fee_calculated(self, obj):
        total, _count = _calculate_medicine_totals(obj)
        return float(total)

    def get_medicine_prescriptions_count(self, obj):
        _total, count = _calculate_medicine_totals(obj)
        return count

    def get_workflow_status(self, obj):
        return _get_workflow_status(obj)

class PatientDetailSerializer(serializers.ModelSerializer):
    age = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    doctor_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    workflow_status = serializers.SerializerMethodField()
    registered_by_name = serializers.SerializerMethodField()
    medicine_fee_calculated = serializers.SerializerMethodField()
    medicine_prescriptions_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Patient
        fields = '__all__'
        read_only_fields = ['mrn', 'hospital', 'registered_by', 'created_at', 'updated_at']
    
    def get_age(self, obj):
        from datetime import date
        today = date.today()
        return today.year - obj.date_of_birth.year - (
            (today.month, today.day) < (obj.date_of_birth.month, obj.date_of_birth.day)
        )
    
    def get_doctor_name(self, obj):
        if obj.assigned_doctor:
            return f"Dr. {obj.assigned_doctor.user.get_full_name()}"
        return None
    
    def get_registered_by_name(self, obj):
        if obj.registered_by:
            return obj.registered_by.user.get_full_name()
        return None

    def get_medicine_fee_calculated(self, obj):
        total, _count = _calculate_medicine_totals(obj)
        return float(total)

    def get_medicine_prescriptions_count(self, obj):
        _total, count = _calculate_medicine_totals(obj)
        return count

    def get_workflow_status(self, obj):
        return _get_workflow_status(obj)