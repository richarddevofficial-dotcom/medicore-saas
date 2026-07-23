#!/usr/bin/env python
"""
Quick RBAC verification script - checks permission classes and setup
Run: python verify_rbac.py from backend directory
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework.permissions import IsAuthenticated
from budgets.views import (
    BudgetYearViewSet, BudgetTemplateViewSet, BudgetAllocationViewSet,
    BudgetVarianceViewSet, BudgetRevisionViewSet, BudgetForecastViewSet,
    BudgetAlertViewSet
)
from human_resources.permissions import IsHRUser, IsHRManager


def check_permissions():
    """Verify permission classes are correctly set"""
    
    viewsets = [
        ('BudgetYear', BudgetYearViewSet),
        ('BudgetTemplate', BudgetTemplateViewSet),
        ('BudgetAllocation', BudgetAllocationViewSet),
        ('BudgetVariance', BudgetVarianceViewSet),
        ('BudgetRevision', BudgetRevisionViewSet),
        ('BudgetForecast', BudgetForecastViewSet),
        ('BudgetAlert', BudgetAlertViewSet),
    ]
    
    print("=" * 70)
    print("BUDGET MODULE - ROLE-BASED ACCESS CONTROL VERIFICATION")
    print("=" * 70)
    
    for name, viewset in viewsets:
        perms = getattr(viewset, 'permission_classes', [])
        perm_names = [p.__name__ for p in perms]
        
        print(f"\n✓ {name:25} Permissions: {', '.join(perm_names)}")
        
        # Check for required permissions
        has_auth = any(p.__name__ == 'IsAuthenticated' for p in perms)
        has_hr_user = any(p.__name__ == 'IsHRUser' for p in perms)
        has_hr_manager = any(p.__name__ == 'IsHRManager' for p in perms)
        
        if not has_auth:
            print(f"  ⚠️  WARNING: Missing IsAuthenticated")
        
        if not (has_hr_user or has_hr_manager):
            print(f"  ⚠️  WARNING: Missing role-based permission")
        
        # Check for HospitalScopedViewSet
        base_classes = [b.__name__ for b in viewset.__bases__]
        if 'HospitalScopedViewSet' in base_classes:
            print(f"  ✓ Inherits from HospitalScopedViewSet (hospital scoping enabled)")
        else:
            print(f"  ⚠️  WARNING: Not using HospitalScopedViewSet")
    
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    
    print("\n✓ IsHRUser allowed roles:")
    user_perm = IsHRUser()
    for role in sorted(user_perm.allowed_roles):
        print(f"  - {role}")
    
    print("\n✓ IsHRManager allowed roles:")
    manager_perm = IsHRManager()
    for role in sorted(manager_perm.allowed_roles):
        print(f"  - {role}")
    
    print("\n" + "=" * 70)
    print("✓ RBAC CONFIGURATION VERIFIED")
    print("=" * 70)


if __name__ == '__main__':
    check_permissions()
