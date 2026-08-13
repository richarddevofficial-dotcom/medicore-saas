import os
from pathlib import Path
from datetime import timedelta
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_env_file(env_path):
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue

        key, value = line.split('=', 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_env_file(BASE_DIR / '.env')
_load_env_file(BASE_DIR / '.env.local')  # Load .env.local for development overrides


def _env_bool(key, default=False):
    value = os.getenv(key)
    if value is None:
        return default
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}


def _env_list(key, default=''):
    raw = os.getenv(key, default)
    return [item.strip() for item in raw.split(',') if item.strip()]


def _database_from_url(database_url):
    parsed = urlparse(database_url)
    engine_map = {
        'postgres': 'django.db.backends.postgresql',
        'postgresql': 'django.db.backends.postgresql',
        'pgsql': 'django.db.backends.postgresql',
    }
    engine = engine_map.get(parsed.scheme)
    if not engine:
        return None

    return {
        'ENGINE': engine,
        'NAME': parsed.path.lstrip('/'),
        'USER': parsed.username or '',
        'PASSWORD': parsed.password or '',
        'HOST': parsed.hostname or '',
        'PORT': str(parsed.port or ''),
        'CONN_MAX_AGE': int(os.getenv('DB_CONN_MAX_AGE', '60')),
        'OPTIONS': {'sslmode': os.getenv('DB_SSLMODE', 'require')},
    }


SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    raise ValueError(
        "DJANGO_SECRET_KEY environment variable is required. "
        "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(50))\""
    )

DEBUG = _env_bool('DEBUG', False)  # Default to False for security

# Detect Django's test runner so security redirects do not interfere with
# test client requests. `manage.py test` always puts 'test' in sys.argv.
import sys

TESTING = 'test' in sys.argv or os.getenv('DJANGO_TESTING') == '1'

ALLOWED_HOSTS = _env_list('ALLOWED_HOSTS', '127.0.0.1,localhost')
TRUSTED_PROXY_IPS = set(_env_list('TRUSTED_PROXY_IPS'))

if TESTING and 'testserver' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS = [*ALLOWED_HOSTS, 'testserver']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',  # Token rotation & blacklist
    'corsheaders',
    'django_filters',
    'import_export',
    'human_resources',
    'hospitals',
    'patients',
    'staff',
    'appointments',
    'departments',
    'finance',
    'expenses',
    'budgets',
    'rooms',
    'pharmacy',
    'laboratory',
    'insurance',
    'billing',
    'reports',
    'auditlog',
    'imaging',
    'ipd',
    'publicapi',
 ]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'config.middleware.TenantDomainMiddleware',
    'config.middleware.DynamicTenantCorsGuardMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'config.middleware.SuperAdminMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

DATABASE_URL = os.getenv('DATABASE_URL', '').strip()
if DATABASE_URL:
    parsed_db = _database_from_url(DATABASE_URL)
    if parsed_db:
        DATABASES['default'] = parsed_db

REDIS_URL = os.getenv('REDIS_URL', '').strip()
CACHES = {
    'default': {
        'BACKEND': (
            'django.core.cache.backends.redis.RedisCache'
            if REDIS_URL
            else 'django.core.cache.backends.locmem.LocMemCache'
        ),
        **({'LOCATION': REDIS_URL} if REDIS_URL else {}),
        'KEY_PREFIX': 'medicore',
    }
}

ENABLE_PASSWORD_VALIDATORS = True  # Always enable (critical for security)
AUTH_PASSWORD_VALIDATORS = (
    [
        {
            'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
        },
        {
            'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
            'OPTIONS': {'min_length': 12},  # Increased from 8 to 12
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

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
MEDIA_URL = 'media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

SUBSCRIPTION_EXPIRING_SOON_DAYS = int(
    os.getenv('SUBSCRIPTION_EXPIRING_SOON_DAYS', '14')
)
SUBSCRIPTION_GRACE_PERIOD_DAYS = int(
    os.getenv('SUBSCRIPTION_GRACE_PERIOD_DAYS', '7')
)
MEDICORE_BANK_NAME = os.getenv('MEDICORE_BANK_NAME', '').strip()
MEDICORE_BANK_ACCOUNT_NAME = os.getenv(
    'MEDICORE_BANK_ACCOUNT_NAME',
    '',
).strip()
MEDICORE_BANK_ACCOUNT_NUMBER = os.getenv(
    'MEDICORE_BANK_ACCOUNT_NUMBER',
    '',
).strip()
MEDICORE_BANK_SWIFT_CODE = os.getenv(
    'MEDICORE_BANK_SWIFT_CODE',
    '',
).strip()

ATTENDANCE_CLOCK_IN_EARLY_MINUTES = int(
    os.getenv('ATTENDANCE_CLOCK_IN_EARLY_MINUTES', '60')
)
ATTENDANCE_LATE_GRACE_MINUTES = int(
    os.getenv('ATTENDANCE_LATE_GRACE_MINUTES', '15')
)
ATTENDANCE_CLOCK_IN_CLOSE_MINUTES = int(
    os.getenv('ATTENDANCE_CLOCK_IN_CLOSE_MINUTES', '240')
)

# ✅ SECURITY: Never allow all CORS origins
CORS_ALLOW_ALL_ORIGINS = False

# Whitelist specific frontend origins
CORS_ALLOWED_ORIGINS = _env_list(
    'CORS_ALLOWED_ORIGINS',
    # Dev: localhost, Prod: medicorecloud.com domains
    'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002' if DEBUG else 'https://medicorecloud.com,https://www.medicorecloud.com'
)

CORS_ALLOW_CREDENTIALS = True

# Whitelist CSRF trusted origins
CSRF_TRUSTED_ORIGINS = _env_list(
    'CSRF_TRUSTED_ORIGINS',
    # Dev: localhost, Prod: medicorecloud.com domains
    'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002' if DEBUG else 'https://medicorecloud.com,https://www.medicorecloud.com'
)

# ✅ CSRF Configuration (Enhanced Security)
CSRF_USE_SESSIONS = False  # Use cookies instead (more secure)
CSRF_COOKIE_SECURE = _env_bool('CSRF_COOKIE_SECURE', not DEBUG)  # HTTPS only
CSRF_COOKIE_HTTP_ONLY = False  # JavaScript needs to read for fetch requests (with credentials)
CSRF_COOKIE_SAMESITE = 'Lax'  # CSRF attack prevention
CSRF_COOKIE_AGE = 31449600  # 1 year
CSRF_COOKIE_NAME = 'csrftoken'  # Standard name (Next.js expects this)

# Allow tenant subdomains (for multi-tenant SaaS)
CORS_ALLOWED_ORIGIN_REGEXES = [
    r'^https://([a-zA-Z0-9-]+\.)?medicorecloud\.com$' if not DEBUG else None
]
CORS_ALLOWED_ORIGIN_REGEXES = [r for r in CORS_ALLOWED_ORIGIN_REGEXES if r]  # Remove None values

if not DEBUG and not TESTING:
    SECURE_SSL_REDIRECT = _env_bool('SECURE_SSL_REDIRECT', True)
    SESSION_COOKIE_SECURE = _env_bool('SESSION_COOKIE_SECURE', True)
    CSRF_COOKIE_SECURE = _env_bool('CSRF_COOKIE_SECURE', True)
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    
    # ✅ SECURITY HEADERS
    # HSTS: Force HTTPS for all future requests (1 year)
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    
    # CSP: Prevent XSS by restricting script sources
    SECURE_CONTENT_SECURITY_POLICY = {
        'default-src': ("'self'",),
        'script-src': ("'self'", "'unsafe-inline'"),  # NextJS requires unsafe-inline
        'style-src': ("'self'", "'unsafe-inline'"),   # CSS inline needed
        'img-src': ("'self'", "data:", "https:"),     # Allow data URIs and HTTPS images
        'font-src': ("'self'", "https:"),             # Google Fonts, etc
        'connect-src': ("'self'", "https:"),          # API calls HTTPS only
        'frame-ancestors': ("'none'",),               # Prevent clickjacking (X-Frame-Options: DENY)
    }
    
    # XSS Protection
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True  # Prevent MIME sniffing
    X_FRAME_OPTIONS = "DENY"             # Prevent clickjacking
    
    # Referrer Policy: Don't leak URLs in referer headers
    SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'config.authentication.CookieJWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 100,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',     # Anonymous users: 100 requests/hour
        'user': '1000/hour',    # Authenticated users: 1000/hour
        'login': '5/minute',    # Login attempts: 5/minute per IP
        'password_reset': '3/hour',  # Password resets: 3/hour per IP
        'registration': '3/hour',  # Hospital registrations per IP
        'refresh_token': '10/minute',  # Token refresh: 10/minute per IP
        'export': '10/hour',    # 🔒 Data exports: 10/hour per user
        'bulk_access': '100/hour',  # Bulk data access limited
    }
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'ipd': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),  # Short-lived access tokens
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),     # Long-lived refresh tokens
    'AUTH_HEADER_TYPES': ('Bearer',),
    
    # Store tokens in httpOnly cookies instead of localStorage
    'AUTH_COOKIE': 'access_token',
    'REFRESH_COOKIE': 'refresh_token',
    'TRUSTED_DEVICE_COOKIE': 'trusted_device_token',
    'AUTH_COOKIE_SECURE': not DEBUG,  # HTTPS only in production
    'AUTH_COOKIE_HTTP_ONLY': True,    # JS cannot access (prevents XSS theft)
    'AUTH_COOKIE_SAMESITE': 'Lax',    # CSRF protection
    'AUTH_COOKIE_DOMAIN': os.getenv('AUTH_COOKIE_DOMAIN', None),  # Set for cross-subdomain
    
    # Refresh token rotation (invalidate old tokens after refresh)
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

# Email settings
# Default to console backend for local/dev to avoid SMTP crashes.
# Override with SMTP env vars in production.
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', '')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'true').lower() == 'true'
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'noreply@medicore.local')
FRONTEND_APP_URL = os.getenv('FRONTEND_APP_URL', 'http://localhost:3000')
PLATFORM_BASE_DOMAIN = os.getenv('PLATFORM_BASE_DOMAIN', 'medicorecloud.com').strip().lower()
PLATFORM_SUBDOMAIN_MODE = _env_bool('PLATFORM_SUBDOMAIN_MODE', True)

# Public self-service registration API
if 'publicapi' not in INSTALLED_APPS:
    INSTALLED_APPS.append('publicapi')

# Allow secure MediCore tenant subdomains.
CORS_ALLOW_CREDENTIALS = True

CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://([a-zA-Z0-9-]+\.)?medicorecloud\.com$",
]

CSRF_TRUSTED_ORIGINS = list(dict.fromkeys([
    *CSRF_TRUSTED_ORIGINS,
    "https://medicorecloud.com",
    "https://www.medicorecloud.com",
    "https://api.medicorecloud.com",
    "https://*.medicorecloud.com",
]))

# MediCore SaaS subscription and commercial billing
if 'saas_billing' not in INSTALLED_APPS:
    INSTALLED_APPS.append('saas_billing')

# Enforce MediCore trial and subscription access after authentication.
_subscription_middleware = (
    'saas_billing.middleware.SubscriptionAccessMiddleware'
)

if _subscription_middleware not in MIDDLEWARE:
    auth_index = MIDDLEWARE.index(
        'django.contrib.auth.middleware.AuthenticationMiddleware'
    )

    MIDDLEWARE.insert(
        auth_index + 1,
        _subscription_middleware,
    )


CORS_ALLOW_CREDENTIALS = True
