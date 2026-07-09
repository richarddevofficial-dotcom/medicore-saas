import socket
import ssl
from datetime import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from hospitals.models import Hospital
from hospitals.serializers import resolve_domain_to_ip


def _fetch_ssl_expiry(hostname, timeout=5):
    context = ssl.create_default_context()
    with socket.create_connection((hostname, 443), timeout=timeout) as sock:
        with context.wrap_socket(sock, server_hostname=hostname) as secure_sock:
            cert = secure_sock.getpeercert()
            not_after = cert.get("notAfter")
            if not not_after:
                return None
            expires = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z")
            return timezone.make_aware(expires, timezone.utc)


class Command(BaseCommand):
    help = "Refresh DNS and SSL health for hospital custom domains"

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=200,
            help="Maximum number of hospitals to process",
        )

    def handle(self, *args, **options):
        limit = max(1, int(options.get("limit") or 200))
        hospitals = Hospital.objects.exclude(custom_domain="").order_by("id")[:limit]

        if not hospitals:
            self.stdout.write(self.style.WARNING("No custom domains configured."))
            return

        checked = 0
        resolved = 0
        ssl_valid = 0

        for hospital in hospitals:
            checked += 1
            domain = (hospital.custom_domain or "").strip().lower()
            now = timezone.now()

            resolved_ip = resolve_domain_to_ip(domain)
            hospital.domain_last_checked_at = now
            hospital.domain_last_resolved_ip = resolved_ip or ""

            if not resolved_ip:
                hospital.domain_status = "failed"
                hospital.domain_ssl_status = "failed"
                hospital.domain_ssl_expires_at = None
                hospital.save(
                    update_fields=[
                        "domain_last_checked_at",
                        "domain_last_resolved_ip",
                        "domain_status",
                        "domain_ssl_status",
                        "domain_ssl_expires_at",
                    ]
                )
                continue

            resolved += 1

            try:
                ssl_expiry = _fetch_ssl_expiry(domain)
                hospital.domain_ssl_status = "valid" if ssl_expiry else "failed"
                hospital.domain_ssl_expires_at = ssl_expiry
                if hospital.domain_status == "pending":
                    hospital.domain_status = "verified"
                    if not hospital.domain_verified_at:
                        hospital.domain_verified_at = now
                if hospital.domain_ssl_status == "valid":
                    ssl_valid += 1
            except Exception:
                hospital.domain_ssl_status = "failed"
                hospital.domain_ssl_expires_at = None

            hospital.save(
                update_fields=[
                    "domain_last_checked_at",
                    "domain_last_resolved_ip",
                    "domain_status",
                    "domain_verified_at",
                    "domain_ssl_status",
                    "domain_ssl_expires_at",
                ]
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Domain health refresh complete: checked={checked}, dns_resolved={resolved}, ssl_valid={ssl_valid}."
            )
        )
