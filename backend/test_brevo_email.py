import json
import os
import sys

import requests


def main():
    api_key = os.getenv("BREVO_API_KEY")
    api_url = os.getenv(
        "BREVO_API_URL",
        "https://api.brevo.com/v3/smtp/email",
    )
    sender_name = os.getenv("BREVO_SENDER_NAME", "MediCore HMS")
    sender_email = os.getenv(
        "BREVO_SENDER_EMAIL",
        "no-reply@medicorecloud.com",
    )
    timeout = int(os.getenv("BREVO_TIMEOUT", "15"))

    recipient_email = "adminmedicorecloud@gmail.com"

    if not api_key:
        print("ERROR: BREVO_API_KEY is missing.")
        sys.exit(1)

    payload = {
        "sender": {
            "name": sender_name,
            "email": sender_email,
        },
        "to": [
            {
                "email": recipient_email,
                "name": "MediCore Administrator",
            }
        ],
        "subject": "MediCore Brevo Email Test",
        "htmlContent": """
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2>MediCore HMS Email Test</h2>
            <p>Your Brevo domain email configuration is working.</p>
            <p>
                Sender:
                <strong>no-reply@medicorecloud.com</strong>
            </p>
        </div>
        """,
        "textContent": (
            "MediCore HMS email test successful. "
            "Your Brevo domain email configuration is working."
        ),
    }

    headers = {
        "accept": "application/json",
        "api-key": api_key,
        "content-type": "application/json",
    }

    try:
        response = requests.post(
            api_url,
            headers=headers,
            data=json.dumps(payload),
            timeout=timeout,
        )
    except requests.RequestException as exc:
        print(f"REQUEST ERROR: {exc}")
        sys.exit(1)

    print(f"HTTP status: {response.status_code}")

    try:
        print("Response:", response.json())
    except ValueError:
        print("Response:", response.text)

    if response.status_code not in (200, 201, 202):
        sys.exit(1)

    print("SUCCESS: Brevo accepted the email.")


if __name__ == "__main__":
    main()
