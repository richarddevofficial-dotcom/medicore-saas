import os
from urllib.parse import urlparse

from django.http import JsonResponse
from django.conf import settings

from hospitals.models import Hospital

class SuperAdminMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        if request.user.is_authenticated and hasattr(request.user, 'staff_profile'):
            request.is_super_admin = request.user.is_superuser
        else:
            request.is_super_admin = False
        return self.get_response(request)


def _parse_host(value):
    if not value:
        return ""
    host = value.strip().lower()
    if ":" in host:
        host = host.split(":", 1)[0]
    return host


def _platform_hosts():
    configured = os.getenv(
        "PLATFORM_HOSTS",
        "localhost,127.0.0.1,medicore.com,www.medicore.com",
    )
    return {_parse_host(item) for item in configured.split(",") if item.strip()}


def _platform_base_domain():
    return str(getattr(settings, 'PLATFORM_BASE_DOMAIN', '') or '').strip().lower()


def _platform_subdomain_mode_enabled():
    return bool(getattr(settings, 'PLATFORM_SUBDOMAIN_MODE', False))


def _tenant_from_managed_subdomain(host):
    if not host or not _platform_subdomain_mode_enabled():
        return None

    base_domain = _platform_base_domain()
    if not base_domain:
        return None

    suffix = f".{base_domain}"
    if not host.endswith(suffix):
        return None

    slug = host[: -len(suffix)].strip(".")
    if not slug or "." in slug:
        return None

    return Hospital.objects.filter(
        slug=slug,
        is_active=True,
    ).first()


def _origin_host(origin):
    if not origin:
        return ""
    try:
        parsed = urlparse(origin)
        return _parse_host(parsed.netloc)
    except Exception:
        return ""


class TenantDomainMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        host = _parse_host(request.META.get("HTTP_HOST", ""))
        tenant = None
        if host:
            tenant = Hospital.objects.filter(
                custom_domain=host,
                domain_status='verified',
                is_active=True,
            ).first()
            if not tenant:
                tenant = _tenant_from_managed_subdomain(host)

        request.tenant_hospital = tenant

        enforce = os.getenv("ENABLE_TENANT_HOST_ENFORCEMENT", "false").lower() == "true"
        if enforce and host and not tenant and host not in _platform_hosts():
            return JsonResponse(
                {"error": "Unknown or unverified tenant host."},
                status=400,
            )

        return self.get_response(request)


class DynamicTenantCorsGuardMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.META.get("HTTP_ORIGIN", "")
        if origin:
            origin_host = _origin_host(origin)
            enforce = os.getenv("ENABLE_DYNAMIC_CORS_GUARD", "false").lower() == "true"
            if enforce and origin_host:
                is_platform = origin_host in _platform_hosts()
                is_verified_tenant = Hospital.objects.filter(
                    custom_domain=origin_host,
                    domain_status='verified',
                    is_active=True,
                ).exists()
                if not is_verified_tenant:
                    is_verified_tenant = _tenant_from_managed_subdomain(origin_host) is not None

                if not is_platform and not is_verified_tenant:
                    return JsonResponse(
                        {"error": "Origin not allowed for this tenant."},
                        status=403,
                    )

        return self.get_response(request)
