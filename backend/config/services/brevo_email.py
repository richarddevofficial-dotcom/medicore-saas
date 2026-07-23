import json
import os
import socket
from urllib import error, request


class BrevoEmailError(Exception):
    pass


def send_brevo_email(
    *,
    subject,
    text_content,
    recipients,
    html_content=None,
    tags=None,
):
    # In development mode with dummy API key, use mock backend
    debug_mode = os.getenv("DEBUG", "False").lower() in ["true", "1", "yes"]
    api_key = os.getenv(
        "BREVO_API_KEY",
        "",
    ).strip()

    # Use mock backend if: in debug mode AND (no API key OR dummy key)
    is_dummy_key = api_key and "dummy" in api_key.lower()
    if debug_mode and (not api_key or is_dummy_key):
        # Return mock response in development
        return {"messageId": "dev-mock-id-12345", "status_code": 200}

    api_url = os.getenv(
        "BREVO_API_URL",
        "https://api.brevo.com/v3/smtp/email",
    ).strip()

    sender_name = os.getenv(
        "BREVO_SENDER_NAME",
        "MediCore HMS",
    ).strip()

    sender_email = os.getenv(
        "BREVO_SENDER_EMAIL",
        "",
    ).strip()

    try:
        timeout = int(
            os.getenv(
                "BREVO_TIMEOUT",
                "15",
            )
        )
    except ValueError:
        timeout = 15

    if not api_key:
        raise BrevoEmailError(
            "BREVO_API_KEY is not configured."
        )

    if not sender_email:
        raise BrevoEmailError(
            "BREVO_SENDER_EMAIL is not configured."
        )

    to_list = []

    for recipient in recipients:
        if isinstance(recipient, dict):
            email = str(
                recipient.get("email", "")
            ).strip()

            name = str(
                recipient.get("name", "")
            ).strip()
        else:
            email = str(recipient).strip()
            name = ""

        if not email:
            continue

        item = {
            "email": email,
        }

        if name:
            item["name"] = name

        to_list.append(item)

    if not to_list:
        raise BrevoEmailError(
            "At least one recipient is required."
        )

    payload = {
        "sender": {
            "name": sender_name,
            "email": sender_email,
        },
        "to": to_list,
        "subject": subject,
        "textContent": text_content,
    }

    if html_content:
        payload["htmlContent"] = html_content

    if tags:
        payload["tags"] = [
            str(tag).strip()
            for tag in tags
            if str(tag).strip()
        ]

    http_request = request.Request(
        api_url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "accept": "application/json",
            "api-key": api_key,
            "content-type": "application/json",
        },
    )

    try:
        with request.urlopen(
            http_request,
            timeout=timeout,
        ) as response:
            body = response.read().decode("utf-8")

            result = (
                json.loads(body)
                if body
                else {}
            )

            result["status_code"] = response.status

            return result

    except error.HTTPError as exc:
        body = exc.read().decode(
            "utf-8",
            errors="replace",
        )

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            data = {
                "message": body,
            }

        message = (
            data.get("message")
            or data.get("error")
            or f"Brevo HTTP {exc.code}"
        )

        raise BrevoEmailError(message) from exc

    except error.URLError as exc:
        raise BrevoEmailError(
            f"Unable to reach Brevo: {exc.reason}"
        ) from exc

    except (
        TimeoutError,
        socket.timeout,
    ) as exc:
        raise BrevoEmailError(
            "Brevo API request timed out."
        ) from exc
