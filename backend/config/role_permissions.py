"""
Role-Based Access Control (RBAC) Permissions
Defines granular permissions for each staff role.
"""
from rest_framework.permissions import BasePermission


def get_staff_role(user):
    """Extract staff role from user, handling case variations."""
    if not user or not user.is_authenticated:
        return None

    staff_profile = getattr(user, "staff_profile", None)
    if staff_profile:
        role = str(staff_profile.role or "").strip().lower()
        if role in {"hospital_admin", "hospital administrator", "administrator"}:
            return "admin"
        return role

    return None


# ============================================================================
# ADMIN ROLES (Can do everything)
# ============================================================================

class IsHospitalAdmin(BasePermission):
    """
    Hospital admin has full access to their hospital.
    System admins (is_superuser) have access to all hospitals.
    """
    message = "Hospital admin permission required."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        # Superuser = System Admin (full access)
        if user.is_superuser:
            return True
        
        # Hospital Admin
        role = get_staff_role(user)
        return role == "admin"


# ============================================================================
# CLINICAL ROLES (Patients, Appointments, Lab, etc.)
# ============================================================================

class IsClinicalStaff(BasePermission):
    """
    Clinical staff: Doctors, Nurses, Lab Technicians, Radiographers
    Can view patients and clinical records.
    """
    message = "Clinical staff permission required."
    
    allowed_roles = {"doctor", "nurse", "lab_technician", "radiographer"}

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        if user.is_superuser:
            return True
        
        role = get_staff_role(user)
        return role in self.allowed_roles or role == "admin"


class IsDoctor(BasePermission):
    """Only doctors can access."""
    message = "Doctor permission required."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        if user.is_superuser:
            return True
        
        role = get_staff_role(user)
        return role == "doctor" or role == "admin"


class IsNurse(BasePermission):
    """Only nurses can access."""
    message = "Nurse permission required."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        if user.is_superuser:
            return True
        
        role = get_staff_role(user)
        return role == "nurse" or role == "admin"


# ============================================================================
# PHARMACY ROLES
# ============================================================================

class IsPharmacyStaff(BasePermission):
    """
    Pharmacists: Manage medicines, prescriptions.
    Can view medicines but NOT patient medical history details.
    """
    message = "Pharmacy staff permission required."
    
    allowed_roles = {"pharmacist", "admin"}

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        if user.is_superuser:
            return True
        
        role = get_staff_role(user)
        return role in self.allowed_roles


class IsPharmacist(BasePermission):
    """Only pharmacists can access pharmacy management."""
    message = "Pharmacist permission required."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        if user.is_superuser:
            return True
        
        role = get_staff_role(user)
        return role in {"pharmacist", "admin"}


# ============================================================================
# RECEPTION/PATIENT REGISTRATION
# ============================================================================

class IsReceptionist(BasePermission):
    """
    Receptionists: Patient registration, appointments.
    Can view patients but NOT medical records/diagnosis.
    """
    message = "Receptionist permission required."
    
    allowed_roles = {"receptionist", "admin"}

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        if user.is_superuser:
            return True
        
        role = get_staff_role(user)
        return role in self.allowed_roles


class IsServiceRequester(BasePermission):
    """Users who can read billable services needed for patient care."""
    message = "Service requester permission required."

    allowed_roles = {"admin", "receptionist", "doctor"}

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        return get_staff_role(user) in self.allowed_roles


# ============================================================================
# LABORATORY & IMAGING
# ============================================================================

class IsLabTechnician(BasePermission):
    """Lab technicians: Manage lab tests, results."""
    message = "Lab technician permission required."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        if user.is_superuser:
            return True
        
        role = get_staff_role(user)
        return role in {"lab_technician", "admin"}


class IsRadiographer(BasePermission):
    """Radiographers: Manage imaging/radiology."""
    message = "Radiographer permission required."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        if user.is_superuser:
            return True
        
        role = get_staff_role(user)
        return role in {"radiographer", "admin"}


# ============================================================================
# FINANCE & BILLING
# ============================================================================

class IsFinanceStaff(BasePermission):
    """
    Finance staff: Accountants, Finance Officers, Cashiers.
    Can view billing and financial data.
    """
    message = "Finance staff permission required."
    
    allowed_roles = {"accountant", "finance", "finance_manager", "cashier", "admin"}

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        if user.is_superuser:
            return True
        
        role = get_staff_role(user)
        return role in self.allowed_roles


class IsFinanceManager(BasePermission):
    """Only finance managers and admins can approve payments."""
    message = "Finance manager permission required."
    
    allowed_roles = {"finance_manager", "admin"}

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        if user.is_superuser:
            return True
        
        role = get_staff_role(user)
        return role in self.allowed_roles


class IsCashier(BasePermission):
    """Cashiers: Process payments, generate receipts."""
    message = "Cashier permission required."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        if user.is_superuser:
            return True
        
        role = get_staff_role(user)
        return role in {"cashier", "admin"}


# ============================================================================
# HR & STAFF MANAGEMENT
# ============================================================================

class IsHRStaff(BasePermission):
    """HR staff: Access HR/payroll modules."""
    message = "HR staff permission required."
    
    allowed_roles = {"hr", "hr_officer", "hr_manager", "admin"}

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        if user.is_superuser:
            return True
        
        role = get_staff_role(user)
        return role in self.allowed_roles


class IsHRManager(BasePermission):
    """Only HR managers and admins can approve HR actions."""
    message = "HR manager permission required."
    
    allowed_roles = {"hr_manager", "admin"}

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        if user.is_superuser:
            return True
        
        role = get_staff_role(user)
        return role in self.allowed_roles


# ============================================================================
# COMBINATIONS (For common workflows)
# ============================================================================

class CanManagePatients(BasePermission):
    """
    Can create/edit patients:
    - Admin, Receptionist, Clinical Staff
    """
    message = "Cannot manage patients with this role."
    
    allowed_roles = {"admin", "receptionist", "doctor", "nurse", "lab_technician", "radiographer"}

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        if user.is_superuser:
            return True
        
        role = get_staff_role(user)
        return role in self.allowed_roles


class CanManageAppointments(BasePermission):
    """
    Can manage appointments:
    - Admin, Receptionist, Clinical Staff
    """
    message = "Cannot manage appointments with this role."
    
    allowed_roles = {"admin", "receptionist", "doctor", "nurse"}

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        if user.is_superuser:
            return True
        
        role = get_staff_role(user)
        return role in self.allowed_roles


class CanViewMedicines(BasePermission):
    """
    Can view medicines:
    - Admin, Pharmacist, Clinical Staff, Finance Staff
    """
    message = "Cannot view medicines with this role."
    
    allowed_roles = {
        "admin", "pharmacist", 
        "doctor", "nurse", "lab_technician", "radiographer",
        "accountant", "finance", "finance_manager", "cashier"
    }

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        if user.is_superuser:
            return True
        
        role = get_staff_role(user)
        return role in self.allowed_roles
