from django.contrib import admin
from .models import Department


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "hospital",
    )

    search_fields = (
        "name",
        "hospital__name",
    )

    list_filter = (
        "hospital",
    )

    ordering = (
        "hospital__name",
        "name",
    )

    list_select_related = (
        "hospital",
    )
