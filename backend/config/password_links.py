from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


def build_password_setup_link(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    query = urlencode({"uid": uid, "token": token, "email": user.email or ""})
    base_url = getattr(settings, "FRONTEND_APP_URL", "http://localhost:3000").rstrip("/")
    return f"{base_url}/reset-password?{query}"


def send_password_setup_email(user, *, created_by_email=""):
    if not user or not user.email:
        return False

    setup_link = build_password_setup_link(user)
    actor = created_by_email or "Administrator"
    subject = "Set up your MediCore account password"
    message = (
        f"Hello {user.first_name or user.username},\n\n"
        "Your account has been created on MediCore HMS.\n"
        "Use the secure link below to set your password:\n\n"
        f"{setup_link}\n\n"
        "This link will expire automatically for security reasons.\n"
        "If you did not expect this, contact your administrator.\n\n"
        f"Created by: {actor}\n"
        "MediCore HMS"
    )

    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )
    return True
