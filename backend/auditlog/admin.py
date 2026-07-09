from django.contrib import admin
from .models import AuditLog, NotificationEvent


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
	list_display = ('created_at', 'user', 'role', 'action', 'target', 'action_type', 'hospital')
	list_filter = ('action_type', 'hospital')
	search_fields = ('user', 'action', 'target')


@admin.register(NotificationEvent)
class NotificationEventAdmin(admin.ModelAdmin):
	list_display = (
		'created_at',
		'notification_type',
		'recipient',
		'status',
		'attempts',
		'reference',
	)
	list_filter = ('notification_type', 'status', 'channel')
	search_fields = ('recipient', 'subject', 'reference', 'error_message')
