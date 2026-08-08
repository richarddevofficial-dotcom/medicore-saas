"""
Rate limiting (throttling) classes for API endpoints.
Prevents brute force attacks, DoS, and abuse.
"""
from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle


def get_client_ip(request):
    remote_address = request.META.get("REMOTE_ADDR", "unknown")
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for and remote_address in settings.TRUSTED_PROXY_IPS:
        return forwarded_for.split(",")[0].strip()
    return remote_address


class ClientIPThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": get_client_ip(request),
        }


class LoginThrottle(ClientIPThrottle):
    """
    Allow 5 login attempts per minute per IP address.
    Prevents password brute force attacks.
    """
    scope = "login"


class PasswordResetThrottle(ClientIPThrottle):
    """
    Allow 3 password reset attempts per hour per IP.
    Prevents password reset abuse.
    """
    scope = "password_reset"


class RegistrationThrottle(ClientIPThrottle):
    """Allow three hospital registration attempts per hour per IP."""

    scope = "registration"


class RefreshTokenThrottle(ClientIPThrottle):
    """
    Allow 10 token refresh attempts per minute per IP.
    Prevents token refresh spam.
    """
    scope = "refresh_token"
