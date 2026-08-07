"""
Rate limiting (throttling) classes for API endpoints.
Prevents brute force attacks, DoS, and abuse.
"""
from rest_framework.throttling import SimpleRateThrottle


class LoginThrottle(SimpleRateThrottle):
    """
    Allow 5 login attempts per minute per IP address.
    Prevents password brute force attacks.
    """
    scope = 'login'
    
    def get_cache_key(self, request, view):
        # Don't throttle authenticated users
        if request.user and request.user.is_authenticated:
            return None
        
        # Throttle by IP address
        client_ip = request.META.get('REMOTE_ADDR')
        return f"login_{client_ip}"


class PasswordResetThrottle(SimpleRateThrottle):
    """
    Allow 3 password reset attempts per hour per IP.
    Prevents password reset abuse.
    """
    scope = 'password_reset'
    
    def get_cache_key(self, request, view):
        client_ip = request.META.get('REMOTE_ADDR')
        return f"password_reset_{client_ip}"

class RegistrationThrottle(SimpleRateThrottle):
    """Allow three hospital registration attempts per hour per IP."""

    scope = 'registration'

    def get_cache_key(self, request, view):
        client_ip = request.META.get('REMOTE_ADDR')
        return f"registration_{client_ip}"


class RefreshTokenThrottle(SimpleRateThrottle):
    """
    Allow 10 token refresh attempts per minute per user.
    Prevents token refresh spam.
    """
    scope = 'refresh_token'
    
    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            return f"refresh_token_{request.user.id}"
        return None
