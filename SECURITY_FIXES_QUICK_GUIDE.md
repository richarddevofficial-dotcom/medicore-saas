# ⚡ CRITICAL SECURITY FIXES - QUICK IMPLEMENTATION GUIDE

## 🔴 FIX #1: Disable DEBUG and Set Secret Key (5 minutes)

**File:** `backend/config/settings.py`

Change these lines:

```python
# Line 64 - BEFORE
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-dev-only-change-me-please-12345')

# Line 66 - BEFORE
DEBUG = _env_bool('DEBUG', True)
```

To:

```python
# Line 64 - AFTER
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    raise ValueError(
        "DJANGO_SECRET_KEY environment variable is required. "
        "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(50))\""
    )

# Line 66 - AFTER
DEBUG = _env_bool('DEBUG', False)  # Default to False, not True
```

**DigitalOcean Action:**

```bash
# Generate secure key
python -c "import secrets; print(secrets.token_urlsafe(50))"

# Add to render.yaml or environment variables:
env:
  DJANGO_SECRET_KEY: "<PASTE_GENERATED_KEY_HERE>"
  DEBUG: "false"
```

---

## 🔴 FIX #2: Add Rate Limiting (15 minutes)

**File:** `backend/config/settings.py`

Add after REST_FRAMEWORK config:

```python
# Around line 200, update REST_FRAMEWORK:
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 100,
    # ADD THESE LINES:
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
    }
}
```

**Create throttle for login:**

**File:** `backend/config/throttles.py` (NEW FILE)

```python
from rest_framework.throttling import SimpleRateThrottle

class LoginThrottle(SimpleRateThrottle):
    """Allow 5 login attempts per minute per IP address"""
    scope = 'login'

    def get_cache_key(self):
        if self.request.user and self.request.user.is_authenticated:
            return None  # Don't throttle authenticated users

        return f"login_{self.request.META.get('REMOTE_ADDR')}"


class PasswordResetThrottle(SimpleRateThrottle):
    """Allow 3 password reset attempts per hour per IP"""
    scope = 'password_reset'

    def get_cache_key(self):
        return f"password_reset_{self.request.META.get('REMOTE_ADDR')}"
```

**Apply to auth endpoints:**

**File:** `backend/config/views.py` or wherever token endpoint is defined

```python
from config.throttles import LoginThrottle
from rest_framework.decorators import throttle_classes

@api_view(['POST'])
@throttle_classes([LoginThrottle])
def token_obtain_pair(request):
    # Existing login logic
    pass
```

---

## 🔴 FIX #3: Move JWT from localStorage to httpOnly Cookies (30 minutes)

**Backend Change:**

**File:** `backend/config/settings.py`

```python
# Add to end of SIMPLE_JWT config:
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),  # Changed from hours=24
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'AUTH_HEADER_TYPES': ('Bearer',),
    # ADD THESE:
    'AUTH_COOKIE': 'access_token',  # Cookie name
    'AUTH_COOKIE_REFRESH': 'refresh_token',
    'AUTH_COOKIE_SECURE': not DEBUG,  # HTTPS only
    'AUTH_COOKIE_HTTP_ONLY': True,  # Can't be accessed by JS
    'AUTH_COOKIE_SAMESITE': 'Lax',  # CSRF protection
    'ROTATE_REFRESH_TOKENS': True,  # Issue new token on refresh
    'BLACKLIST_AFTER_ROTATION': True,  # Invalidate old tokens
}
```

**Install token blacklist:**

```bash
pip install djangorestframework-simplejwt[cryptography]
```

**File:** `backend/config/settings.py`

```python
INSTALLED_APPS = [
    # ... existing apps ...
    'rest_framework_simplejwt.token_blacklist',  # ADD THIS
]
```

**Frontend Change:**

**File:** `frontend/src/lib/api-client.js`

```javascript
import axios from "axios";

const configuredBaseUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const baseURL = configuredBaseUrl.endsWith("/")
  ? configuredBaseUrl
  : `${configuredBaseUrl}/`;

const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // IMPORTANT: Keep this to send cookies
  // REMOVE: apiClient.interceptors.request.use for localStorage token
});

// Remove this entire interceptor:
// apiClient.interceptors.request.use((config) => {
//   const token = localStorage.getItem("token");
//   ...
// })

// The token is now in httpOnly cookie, axios sends it automatically
// with withCredentials: true

export default apiClient;
```

**Update login to use cookies instead of localStorage:**

**File:** `frontend/src/stores/auth-store.js`

```javascript
// OLD CODE - remove:
// localStorage.setItem("token", response.data.access)
// localStorage.setItem("user", JSON.stringify(response.data.user))

// NEW CODE - keep only these (cookies are automatic):
localStorage.setItem("user", JSON.stringify(response.data.user));
localStorage.setItem("hospital", JSON.stringify(response.data.hospital));
localStorage.setItem("role", response.data.user.role);

// Logout - remove localStorage token:
logout: () => {
  localStorage.removeItem("user");
  localStorage.removeItem("hospital");
  localStorage.removeItem("role");
  // Don't remove token - server invalidates it via Set-Cookie
};
```

---

## 🔴 FIX #4: Add Security Headers (10 minutes)

**File:** `backend/config/settings.py`

Add to the `if not DEBUG:` section around line 190:

```python
if not DEBUG:
    SECURE_SSL_REDIRECT = _env_bool('SECURE_SSL_REDIRECT', True)
    SESSION_COOKIE_SECURE = _env_bool('SESSION_COOKIE_SECURE', True)
    CSRF_COOKIE_SECURE = _env_bool('CSRF_COOKIE_SECURE', True)
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

    # ADD THESE NEW HEADERS:
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

    SECURE_CONTENT_SECURITY_POLICY = {
        'default-src': ("'self'",),
        'script-src': ("'self'", "'unsafe-inline'"),  # NextJS requires unsafe-inline
        'style-src': ("'self'", "'unsafe-inline'"),
        'img-src': ("'self'", "data:", "https:"),
        'font-src': ("'self'", "https:"),
        'connect-src': ("'self'", "https:"),
    }

    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"
    REFERRER_POLICY = "strict-origin-when-cross-origin"
```

---

## 🟠 FIX #5: Fix CORS Configuration (5 minutes)

**File:** `backend/config/settings.py`

**BEFORE:**

```python
CORS_ALLOW_ALL_ORIGINS = _env_bool('CORS_ALLOW_ALL_ORIGINS', DEBUG)
CORS_ALLOWED_ORIGINS = _env_list(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3002,http://127.0.0.1:3002',
)
```

**AFTER:**

```python
CORS_ALLOW_ALL_ORIGINS = False  # Never allow all origins
CORS_ALLOWED_ORIGINS = _env_list(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3000,http://127.0.0.1:3000' if DEBUG else 'https://medicore.com,https://www.medicore.com,https://app.medicore.com'
)

# For tenant subdomains:
CORS_ALLOWED_ORIGIN_REGEXES = [
    r'^https://([a-zA-Z0-9-]+\.)?medicorecloud\.com$' if not DEBUG else None
]
CORS_ALLOWED_ORIGIN_REGEXES = [r for r in CORS_ALLOWED_ORIGIN_REGEXES if r]
```

---

## 🟡 FIX #6: Strengthen Password Requirements (5 minutes)

**File:** `backend/config/settings.py`

**BEFORE:**

```python
ENABLE_PASSWORD_VALIDATORS = _env_bool('ENABLE_PASSWORD_VALIDATORS', not DEBUG)
```

**AFTER:**

```python
ENABLE_PASSWORD_VALIDATORS = True  # ALWAYS enabled, not conditional on DEBUG
```

And update minimum length:

```python
AUTH_PASSWORD_VALIDATORS = (
    [
        {
            'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
        },
        {
            'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
            'OPTIONS': {'min_length': 12},  # Changed from 8
        },
        {
            'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
        },
        {
            'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
        },
    ]
    if ENABLE_PASSWORD_VALIDATORS
    else []
)
```

---

## IMPLEMENTATION ORDER

1. **First Deploy (Critical):**
   - FIX #1: DEBUG=False, SECRET_KEY
   - FIX #2: Rate limiting
2. **Second Deploy (Within 1 week):**
   - FIX #3: JWT to httpOnly cookies
   - FIX #4: Security headers
   - FIX #5: CORS whitelist
   - FIX #6: Password requirements

**Important:** After making changes, run:

```bash
# Check for Django issues
python manage.py check --deploy

# Test locally
python manage.py runserver

# Run migrations if needed
python manage.py migrate
```

---

## TESTING THE FIXES

```bash
# Test DEBUG is disabled
curl -X POST https://api.medicore.com/api/v1/nonexistent/
# Should NOT show Python stacktrace

# Test rate limiting
for i in {1..10}; do
  curl -X POST https://api.medicore.com/api/v1/token/ \
    -d "phone=9876543210&password=test"
done
# After 5 attempts, should return 429 (Too Many Requests)

# Test security headers
curl -i https://api.medicore.com/
# Should show: Strict-Transport-Security, Content-Security-Policy, X-Frame-Options, etc.

# Test CORS
curl -H "Origin: https://attacker.com" https://api.medicore.com/api/v1/
# Should NOT include Access-Control-Allow-Origin header for attacker.com
```

---

## DIGITALOCEAN DEPLOYMENT

Create `render.yaml`:

```yaml
env:
  DJANGO_SECRET_KEY: "<GENERATED_KEY>"
  DEBUG: "false"
  ALLOWED_HOSTS: "api.medicore.com,medicore.com,www.medicore.com"
  CORS_ALLOWED_ORIGINS: "https://medicore.com,https://www.medicore.com,https://app.medicore.com"
  SECURE_SSL_REDIRECT: "true"
  SECURE_HSTS_SECONDS: "31536000"
  DB_SSLMODE: "require"
  DATABASE_URL: "postgresql://..."
  CELERY_BROKER_URL: "redis://..."
  REDIS_URL: "redis://..."
```

Or in DigitalOcean App Platform:

1. Go to Settings → Environment Variables
2. Add each variable from above
3. Deploy

That's it! Your system will be significantly more secure.
