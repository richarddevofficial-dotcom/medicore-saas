"""
Activity monitoring and alerting system for security events.
Tracks suspicious activities and alerts administrators.
"""

from django.utils import timezone
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.conf import settings
from auditlog.models import AuditLog, NotificationEvent
from datetime import timedelta


class ActivityMonitor:
    """Monitor and alert on suspicious activities."""
    
    # Alert thresholds
    ALERTS = {
        'failed_login': {
            'threshold': 5,              # 5 failed attempts
            'window_seconds': 300,       # In 5 minutes
            'severity': 'HIGH',
        },
        'password_change': {
            'threshold': 3,              # 3 changes
            'window_seconds': 3600,      # In 1 hour
            'severity': 'MEDIUM',
        },
        'data_export': {
            'threshold': 10,             # 10 exports
            'window_seconds': 3600,      # In 1 hour
            'severity': 'MEDIUM',
        },
        'permission_change': {
            'threshold': 5,              # 5 changes
            'window_seconds': 3600,      # In 1 hour
            'severity': 'HIGH',
        },
        'unknown_ip_login': {
            'threshold': 1,              # 1 login from new IP
            'window_seconds': 0,         # Immediate
            'severity': 'MEDIUM',
        },
        'bulk_data_access': {
            'threshold': 1000,           # 1000 records
            'window_seconds': 300,       # In 5 minutes
            'severity': 'HIGH',
        },
    }
    
    @staticmethod
    def log_event(
        user,
        event_type,
        details=None,
        severity='INFO',
        hospital=None,
        ip_address=None,
    ):
        """
        Log a monitored event.
        
        Args:
            user: User object
            event_type: Type of event (e.g., 'failed_login', 'data_export')
            details: Dict of event details
            severity: 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
            hospital: Hospital object
            ip_address: Client IP
        """
        try:
            staff_profile = getattr(user, 'staff_profile', None) if user else None
            hospital = hospital or getattr(staff_profile, 'hospital', None)
            user_label = (
                getattr(user, 'email', '')
                or getattr(user, 'username', '')
                or str(user or 'anonymous')
            )
            # Create audit log
            audit_entry = AuditLog.objects.create(
                user=user_label,
                role=getattr(staff_profile, 'role', ''),
                action=f'event:{event_type}',
                target='activity_monitor',
                action_type='security',
                status=severity,
                changes=details or {},
                ip_address=ip_address,
                hospital=hospital,
            )
            
            # Check if alert threshold exceeded
            ActivityMonitor._check_alert_threshold(
                event_type, user, hospital, severity, ip_address
            )
            
            return audit_entry
        except Exception as exc:
            print(f"Activity logging failed: {exc}")
            return None
    
    @staticmethod
    def _check_alert_threshold(
        event_type,
        user,
        hospital,
        severity,
        ip_address=None,
    ):
        """Check if alert threshold exceeded and send alert."""
        if event_type not in ActivityMonitor.ALERTS:
            return
        
        alert_config = ActivityMonitor.ALERTS[event_type]
        threshold = alert_config['threshold']
        window = alert_config['window_seconds']
        alert_severity = alert_config['severity']
        
        # Count recent events
        cutoff_time = timezone.now() - timedelta(seconds=window)
        recent_events = AuditLog.objects.filter(
            user=(
                getattr(user, 'email', '')
                or getattr(user, 'username', '')
                or str(user or 'anonymous')
            ),
            action__contains=f'event:{event_type}',
            created_at__gte=cutoff_time,
        )
        if hospital:
            recent_events = recent_events.filter(hospital=hospital)
        if not user and ip_address:
            recent_events = recent_events.filter(ip_address=ip_address)
        recent_count = recent_events.count()
        
        # Trigger alert if threshold exceeded
        if recent_count >= threshold:
            ActivityMonitor._send_alert(
                user,
                event_type,
                recent_count,
                threshold,
                alert_severity,
                hospital
            )
    
    @staticmethod
    def _send_alert(user, event_type, count, threshold, severity, hospital):
        """Send alert to administrators."""
        try:
            # Get admin emails
            admins = User.objects.filter(is_superuser=True, email__isnull=False)
            admin_emails = [admin.email for admin in admins if admin.email]
            
            if not admin_emails:
                return
            
            # Compose alert
            subject = f"🚨 SECURITY ALERT - {event_type.upper()} ({severity})"
            user_name = (
                user.get_full_name() or user.username
                if user
                else 'Anonymous user'
            )
            user_email = user.email if user else 'N/A'
            message = (
                f"User: {user_name}\n"
                f"Email: {user_email}\n"
                f"Event: {event_type}\n"
                f"Count: {count} (threshold: {threshold})\n"
                f"Severity: {severity}\n"
                f"Timestamp: {timezone.now().isoformat()}\n"
                f"Hospital: {hospital.name if hospital else 'N/A'}\n\n"
                f"This user has triggered {count} {event_type} events, exceeding the threshold of {threshold}.\n"
                f"Please investigate for potential security issues."
            )
            
            # Send email alert
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                admin_emails,
                fail_silently=True,
            )
            
            # Log alert in database
            NotificationEvent.objects.create(
                notification_type='security_alert',
                recipient=', '.join(admin_emails),
                subject=subject,
                status='sent',
                reference=f'alert:{event_type}:{user.id if user else "anonymous"}',
            )
        except Exception as exc:
            print(f"Alert sending failed: {exc}")
    
    @staticmethod
    def log_export(user, export_type, record_count, hospital=None, ip_address=None):
        """Log data export with rate limiting check."""
        ActivityMonitor.log_event(
            user=user,
            event_type='data_export',
            details={
                'export_type': export_type,
                'record_count': record_count,
                'timestamp': timezone.now().isoformat(),
            },
            severity='MEDIUM',
            hospital=hospital,
            ip_address=ip_address,
        )
    
    @staticmethod
    def log_failed_login(email, ip_address):
        """Log failed login attempt."""
        ActivityMonitor.log_event(
            user=None,
            event_type='failed_login',
            details={
                'email': email,
                'ip_address': ip_address,
                'timestamp': timezone.now().isoformat(),
            },
            severity='MEDIUM',
            ip_address=ip_address,
        )
    
    @staticmethod
    def log_permission_change(actor, target_user, permission, hospital=None, ip_address=None):
        """Log permission changes."""
        ActivityMonitor.log_event(
            user=actor,
            event_type='permission_change',
            details={
                'target_user': str(target_user),
                'permission': permission,
                'timestamp': timezone.now().isoformat(),
            },
            severity='HIGH',
            hospital=hospital,
            ip_address=ip_address,
        )
    
    @staticmethod
    def log_password_change(user, ip_address=None, hospital=None):
        """Log password change."""
        ActivityMonitor.log_event(
            user=user,
            event_type='password_change',
            details={
                'timestamp': timezone.now().isoformat(),
            },
            severity='MEDIUM',
            hospital=hospital,
            ip_address=ip_address,
        )
