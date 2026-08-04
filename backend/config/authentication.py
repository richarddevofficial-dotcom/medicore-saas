from django.conf import settings
from rest_framework import exceptions
from rest_framework.authentication import CSRFCheck
from rest_framework.permissions import SAFE_METHODS
from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    """Authenticate browser requests with the HttpOnly access-token cookie."""

    def authenticate(self, request):
        if self.get_header(request) is not None:
            return super().authenticate(request)

        token = request.COOKIES.get(settings.SIMPLE_JWT["AUTH_COOKIE"])
        if not token:
            return None

        if request.method not in SAFE_METHODS:
            self.enforce_csrf(request)

        validated_token = self.get_validated_token(token)
        return self.get_user(validated_token), validated_token

    @staticmethod
    def enforce_csrf(request):
        csrf_request = getattr(request, "_request", request)
        check = CSRFCheck(lambda _request: None)
        check.process_request(csrf_request)
        reason = check.process_view(csrf_request, None, (), {})
        if reason:
            raise exceptions.PermissionDenied(
                f"CSRF validation failed: {reason}"
            )