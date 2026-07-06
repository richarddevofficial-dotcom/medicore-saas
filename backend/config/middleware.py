from django.shortcuts import redirect

class SuperAdminMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        if request.user.is_authenticated and hasattr(request.user, 'staff_profile'):
            request.is_super_admin = request.user.is_superuser
        else:
            request.is_super_admin = False
        return self.get_response(request)
