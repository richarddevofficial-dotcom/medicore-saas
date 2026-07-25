# Subscription Upgrade/Downgrade Behavior - Verified ✓

**Date:** 2026-07-25  
**Status:** ✓ CORRECT IMPLEMENTATION

## Summary

The subscription system correctly implements:

- **Upgrades:** Applied **immediately** after payment
- **Downgrades:** Scheduled for **end of billing period** (next_billing_date)
- **Cancellations:** Remain active until period ends

---

## Implementation Details

### Files Involved

- `backend/saas_billing/plan_change_services.py` - Plan change logic
- `backend/saas_billing/views.py` - Payment approval & activation
- `backend/saas_billing/management/commands/apply_scheduled_plan_changes.py` - Scheduled activation

### Downgrade Flow

```
1. Hospital requests downgrade
   ↓
2. create_plan_change_invoice()
   - Calculates subscription_amount = 0 (no charge for downgrade)
   - Creates Invoice with status=PAID (automatic payment since free)
   - Calls activate_plan_change()
   ↓
3. activate_plan_change() detects is_downgrade = True
   - Sets subscription.pending_plan = target_plan
   - Sets subscription.pending_plan_effective_date = subscription.next_billing_date
   - Marks invoice as "scheduled"
   ↓
4. Management command runs daily: apply_scheduled_plan_changes.py
   - Finds subscriptions where pending_plan_effective_date <= today
   - Updates subscription.plan = pending_plan
   - Updates all pricing and limits
   - Clears pending_plan fields
```

### Upgrade Flow

```
1. Hospital requests upgrade
   ↓
2. create_plan_change_invoice()
   - Calculates subscription_amount = monthly_difference (pro-rata charge)
   - Creates Invoice with status=PENDING
   - Does NOT activate yet (waits for payment approval)
   ↓
3. Hospital pays invoice
   ↓
4. approve_manual_payment() webhook/endpoint
   - Marks invoice as PAID
   - Calls activate_plan_change()
   ↓
5. activate_plan_change() detects is_upgrade = False (not downgrade)
   - Immediately updates subscription.plan = target_plan
   - Updates subscription.current_monthly_price
   - Updates subscription.current_service_fee
   - Updates hospital.subscription_plan, hospital.max_staff, hospital.max_patients
   - Marks invoice as "activated"
   ↓
6. Hospital immediately has access to new plan features
```

---

## Edge Cases Handled

✓ **Plan price is same as current:** Validation rejects (PlanChangeError)  
✓ **Upgrade requiring payment:** Invoice created, awaits approval  
✓ **Downgrade with no charge:** Auto-paid invoice, scheduled for next billing  
✓ **Existing pending plan change:** Returns existing invoice (prevents duplicates)  
✓ **Staff/Patient limits exceeded:** Validation prevents downgrade if would exceed new plan's limits

---

## Database Fields Used

```python
HospitalSubscription:
  - plan_id                    # Current active plan
  - current_monthly_price      # Current effective price
  - current_service_fee        # Current effective fee
  - pending_plan_id            # Scheduled plan (for downgrades)
  - pending_plan_effective_date # When downgrade applies
  - pending_plan_requested_at  # When downgrade was requested

Hospital:
  - subscription_plan          # Plan code
  - max_staff, max_patients    # Plan limits
  - subscription_status        # "active", "suspended", etc.
  - is_active                  # Overall account status
```

---

## Verification Checklist

- [x] Upgrades have immediate effect after payment
- [x] Downgrades wait until end of billing period
- [x] Cancellations use pending_plan logic (treated as downgrade)
- [x] No duplicate plan changes allowed
- [x] Hospital limits updated on activation
- [x] Scheduled changes applied by management command
- [x] Invoice metadata tracks change status
- [x] Payment gateway integration ready

---

## Commands

Monitor scheduled changes (dry-run):

```bash
python manage.py apply_scheduled_plan_changes --dry-run
```

Apply scheduled changes:

```bash
python manage.py apply_scheduled_plan_changes
```

Run daily via cron/scheduler for automatic activation on deadline.

---

## Conclusion

✓ The subscription system is correctly implemented and ready for production.  
No changes needed.
