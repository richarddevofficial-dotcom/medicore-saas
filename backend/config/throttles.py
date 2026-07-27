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
    
    def get_cache_key(self):
        # Don't throttle authenticated users
        if self.request.user and self.request.user.is_authenticated:
            return None
        
        # Throttle by IP address
        client_ip = self.request.META.get('REMOTE_ADDR')
        return f"login_{client_ip}"


class PasswordResetThrottle(SimpleRateThrottle):
    """
    Allow 3 password reset attempts per hour per IP.
    Prevents password reset abuse.
    """
    scope = 'password_reset'
    
    def get_cache_key(self):
        client_ip = self.request.META.get('REMOTE_ADDR')
        return f"password_reset_{client_ip}"


class RefreshTokenThrottle(SimpleRateThrottle):
    """
    Allow 10 token refresh attempts per minute per user.
    Prevents token refresh spam.
    """
    scope = 'refresh_token'
    
    def get_cache_key(self):
        if self.request.user and self.request.user.is_authenticated:
            return f"refresh_token_{self.request.user.id}"
        return None
