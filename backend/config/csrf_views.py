"""
CSRF protection views and utilities.
Provides CSRF token endpoint for frontend and error handlers.
"""

from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([AllowAny])
@ensure_csrf_cookie  # Ensure CSRF token is set in cookie
def get_csrf_token(request):
    """
    API endpoint to get CSRF token.
    Frontend should call this before making POST/PUT/DELETE requests.
    
    Usage in Next.js:
    const response = await fetch('/api/v1/csrf-token/', {
        method: 'GET',
        credentials: 'include'  // Include cookies
    });
    // CSRF token is now in csrftoken cookie
    
    Then include in requests:
    const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
    
    fetch('/api/v1/endpoint/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrfToken,
        },
        credentials: 'include'
    })
    """
    csrf_token = get_token(request)
    return Response({
        'csrf_token': csrf_token,
        'message': 'CSRF token retrieved. Include it in X-CSRFToken header for POST/PUT/DELETE requests.'
    })


def csrf_failure(request, reason=""):
    """
    Custom CSRF failure handler.
    Returns JSON response instead of HTML error page.
    """
    return JsonResponse({
        'error': 'CSRF validation failed',
        'reason': reason or 'Missing or invalid CSRF token',
        'detail': 'Include the CSRF token from the csrftoken cookie in X-CSRFToken header',
    }, status=403)


@api_view(['POST'])
@permission_classes([AllowAny])
def csrf_exempt_login(request):
    """
    CSRF-exempt login endpoint.
    Safe to call without CSRF token initially.
    After login, CSRF tokens are used for all other requests.
    """
    # This endpoint is marked as exempt but should only accept specific actions
    from config.urls import login_initiate
    return login_initiate(request)
