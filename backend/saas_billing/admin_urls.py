from django.urls import path

from .admin_views import saas_admin_dashboard


urlpatterns = [
    path(
        "dashboard/",
        saas_admin_dashboard,
        name="saas-admin-dashboard",
    ),
]
