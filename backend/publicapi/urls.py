from django.urls import path

from .views import register_hospital


urlpatterns = [
    path(
        "register-hospital/",
        register_hospital,
        name="public-register-hospital",
    ),
]
