from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from config.services.brevo_email import BrevoEmailError, send_brevo_email


def build_password_setup_link(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)

    query = urlencode(
        {
            "uid": uid,
            "token": token,
            "email": user.email or "",
        }
    )

    base_url = getattr(
        settings,
        "FRONTEND_APP_URL",
        "http://localhost:3000",
    ).rstrip("/")

    return f"{base_url}/reset-password?{query}"


def send_password_setup_email(user, *, created_by_email=""):
    if not user or not user.email:
        return False

    setup_link = build_password_setup_link(user)
    actor = created_by_email or "Administrator"
    recipient_name = user.get_full_name() or user.username

    subject = "Set up your MediCore account password"

    text_message = (
        f"Hello {recipient_name},\n\n"
        "Your account has been created on MediCore HMS.\n"
        "Use the secure link below to set your password:\n\n"
        f"{setup_link}\n\n"
        "This link will expire automatically for security reasons.\n"
        "If you did not expect this email, contact your administrator.\n\n"
        f"Created by: {actor}\n"
        "MediCore HMS"
    )

    html_message = f"""
    <html>
      <body style="font-family:Arial,sans-serif;color:#1e293b;background:#f8fafc;padding:24px;">
        <div style="
          max-width:600px;
          margin:0 auto;
          background:#ffffff;
          border:1px solid #e2e8f0;
          border-radius:14px;
          padding:32px;
        ">
          <h2 style="margin-top:0;color:#0f172a;">
            Set up your MediCore password
          </h2>

          <p>Hello {recipient_name},</p>

          <p>
            Your account has been created on MediCore HMS.
            Click the button below to create your password.
          </p>

          <div style="margin:28px 0;text-align:center;">
            <a
              href="{setup_link}"
              style="
                display:inline-block;
                background:#ea580c;
                color:#ffffff;
                text-decoration:none;
                padding:14px 24px;
                border-radius:8px;
                font-weight:700;
              "
            >
              Set Password
            </a>
          </div>

          <p style="font-size:14px;color:#64748b;">
            This link will expire automatically for security reasons.
          </p>

          <p style="font-size:14px;color:#64748b;">
            If the button does not work, copy and paste this link into your browser:
          </p>

          <p style="
            font-size:13px;
            color:#475569;
            word-break:break-all;
            background:#f1f5f9;
            padding:12px;
            border-radius:8px;
          ">
            {setup_link}
          </p>

          <p style="font-size:13px;color:#64748b;">
            Created by: {actor}
          </p>

          <p style="margin-bottom:0;font-weight:700;color:#0f172a;">
            MediCore HMS
          </p>
        </div>
      </body>
    </html>
    """

    try:
        send_brevo_email(
            subject=subject,
            text_content=text_message,
            html_content=html_message,
            recipients=[
                {
                    "email": user.email,
                    "name": recipient_name,
                }
            ],
            tags=[
                "medicore",
                "password-setup",
            ],
        )
        return True

    except BrevoEmailError:
        return False
