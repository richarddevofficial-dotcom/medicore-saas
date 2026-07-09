from django.contrib import admin
from .models import Bill, SubscriptionPayment, ReceiptEmailJob, POSReceipt


@admin.register(Bill)
class BillAdmin(admin.ModelAdmin):
	list_display = ('bill_number', 'hospital', 'patient_name', 'status', 'total_amount', 'created_at')
	list_filter = ('status', 'hospital')
	search_fields = ('bill_number', 'patient_name', 'patient_mrn')


@admin.register(SubscriptionPayment)
class SubscriptionPaymentAdmin(admin.ModelAdmin):
	list_display = (
		'id',
		'hospital',
		'plan',
		'amount',
		'status',
		'receipt_delivery_status',
		'created_at',
	)
	list_filter = ('status', 'receipt_delivery_status', 'plan', 'hospital')
	search_fields = ('transaction_id', 'hospital__name')


@admin.register(ReceiptEmailJob)
class ReceiptEmailJobAdmin(admin.ModelAdmin):
	list_display = ('id', 'payment', 'status', 'attempts', 'max_attempts', 'next_attempt_at', 'updated_at')
	list_filter = ('status',)
	search_fields = ('payment__transaction_id', 'payment__hospital__name')


@admin.register(POSReceipt)
class POSReceiptAdmin(admin.ModelAdmin):
	list_display = (
		'receipt_number',
		'hospital',
		'customer_name',
		'medicine_name_snapshot',
		'quantity',
		'total_amount',
		'created_at',
	)
	list_filter = ('hospital', 'payment_method', 'created_at')
	search_fields = ('receipt_number', 'customer_name', 'medicine_name_snapshot', 'hospital__name')
