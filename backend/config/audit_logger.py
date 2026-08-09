"""
Enhanced audit logging for sensitive operations.
Logs all CRUD operations with user context, IP, timestamp, and changes.
"""

from auditlog.models import AuditLog


SENSITIVE_FIELD_PARTS = {
    'authorization',
    'cookie',
    'otp',
    'password',
    'secret',
    'token',
}


def _sanitize_audit_values(value):
    if isinstance(value, dict):
        return {
            key: (
                '[REDACTED]'
                if any(part in str(key).lower() for part in SENSITIVE_FIELD_PARTS)
                else _sanitize_audit_values(item)
            )
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [_sanitize_audit_values(item) for item in value]
    return value


class AuditLogger:
    """Centralized audit logging for sensitive operations."""
    
    # Sensitive operations that should always be logged
    SENSITIVE_OPERATIONS = {
        'login': 'User login attempt',
        'logout': 'User logout',
        'password_change': 'Password changed',
        'password_reset': 'Password reset',
        'otp_generate': 'OTP generated',
        'otp_verify': 'OTP verified',
        'permission_grant': 'Permission granted',
        'permission_revoke': 'Permission revoked',
        'data_export': 'Data exported',
        'data_delete': 'Data deleted',
        'admin_access': 'Admin access granted',
        'failed_auth': 'Failed authentication attempt',
        'account_lock': 'Account locked',
        'account_unlock': 'Account unlocked',
        'config_change': 'Configuration changed',
    }
    
    @staticmethod
    def log_audit(
        user,
        action,
        target,
        hospital=None,
        old_values=None,
        new_values=None,
        request=None,
        status='success',
        error_message=None,
        ip_address=None,
        user_agent=None,
    ):
        """
        Log an audit event.
        
        Args:
            user: User object or None
            action: Action name (e.g., 'create', 'update', 'delete')
            target: Target object type (e.g., 'employee', 'patient', 'finance_record')
            hospital: Hospital object (optional)
            old_values: Dict of old field values
            new_values: Dict of new field values
            request: HTTP request object (optional, for IP/user-agent extraction)
            status: 'success' or 'failure'
            error_message: Error message if status is 'failure'
            ip_address: Client IP address
            user_agent: Client user agent
        """
        try:
            # Extract IP and user agent from request if provided
            if request:
                ip_address = ip_address or _get_client_ip(request)
                user_agent = user_agent or request.META.get('HTTP_USER_AGENT', '')[:500]
            
            staff_profile = getattr(user, 'staff_profile', None) if user else None
            hospital = hospital or getattr(staff_profile, 'hospital', None)
            role = getattr(staff_profile, 'role', '')
            user_label = (
                getattr(user, 'email', '')
                or getattr(user, 'username', '')
                or str(user or 'anonymous')
            )
            changes = {
                'old': _sanitize_audit_values(old_values or {}),
                'new': _sanitize_audit_values(new_values or {}),
            } if old_values or new_values else {}
            
            # Create audit log entry
            audit_log = AuditLog.objects.create(
                user=user_label[:200],
                role=str(role)[:50],
                action=f'{action}:{target}'[:200],
                target=str(target)[:200],
                action_detail=AuditLogger.SENSITIVE_OPERATIONS.get(action, action),
                action_type='security',
                status=str(status)[:20],
                changes=changes,
                error_message=error_message or '',
                ip_address=ip_address,
                user_agent=user_agent or '',
                hospital=hospital,
            )
            
            return audit_log
        except Exception as exc:
            # Log audit failures to prevent audit system from crashing app
            print(f"Audit logging failed: {exc}")
            return None
    
    @staticmethod
    def log_login(user, request, mfa_required=False, success=True):
        """Log user login attempt."""
        action = 'login' if success else 'failed_auth'
        AuditLogger.log_audit(
            user=user,
            action=action,
            target='authentication',
            request=request,
            status='success' if success else 'failure',
            error_message=None if success else 'Login failed',
        )
    
    @staticmethod
    def log_password_change(user, request, success=True):
        """Log password change."""
        AuditLogger.log_audit(
            user=user,
            action='password_change',
            target='user_account',
            request=request,
            status='success' if success else 'failure',
            error_message=None if success else 'Password change failed',
        )
    
    @staticmethod
    def log_otp_action(user, request, action_type='generate', success=True):
        """Log OTP generation or verification."""
        AuditLogger.log_audit(
            user=user,
            action=f'otp_{action_type}',
            target='authentication',
            request=request,
            status='success' if success else 'failure',
            error_message=None if success else f'OTP {action_type} failed',
        )
    
    @staticmethod
    def log_data_access(user, request, target, hospital=None):
        """Log access to sensitive data."""
        AuditLogger.log_audit(
            user=user,
            action='data_access',
            target=target,
            hospital=hospital,
            request=request,
        )
    
    @staticmethod
    def log_permission_change(
        actor,
        target_user,
        permission,
        granted=True,
        request=None,
        hospital=None
    ):
        """Log permission grant/revoke."""
        action = 'permission_grant' if granted else 'permission_revoke'
        AuditLogger.log_audit(
            user=actor,
            action=action,
            target='user_permission',
            hospital=hospital,
            new_values={'permission': permission, 'target_user': str(target_user)},
            request=request,
        )
    
    @staticmethod
    def log_export(user, request, export_type, record_count, hospital=None):
        """Log data export."""
        AuditLogger.log_audit(
            user=user,
            action='data_export',
            target=export_type,
            hospital=hospital,
            new_values={'record_count': record_count, 'export_type': export_type},
            request=request,
        )
    
    @staticmethod
    def log_config_change(
        actor,
        setting_name,
        old_value,
        new_value,
        request=None,
        hospital=None
    ):
        """Log configuration changes."""
        AuditLogger.log_audit(
            user=actor,
            action='config_change',
            target='system_config',
            hospital=hospital,
            old_values={setting_name: old_value},
            new_values={setting_name: new_value},
            request=request,
        )


def _get_client_ip(request):
    """Extract client IP from request."""
    forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', 'unknown')
