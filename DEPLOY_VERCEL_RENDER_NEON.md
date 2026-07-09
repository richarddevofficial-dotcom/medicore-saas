# Deploy Guide: Vercel (Frontend) + Render (Backend) + Neon (Postgres)

## 1. Database (Neon)

1. Create a Neon project and Postgres database.
2. Copy the connection string and save it as `DATABASE_URL` in Render backend env vars.
3. Keep `sslmode=require` in the connection string or set `DB_SSLMODE=require`.

## 2. Backend (Render)

1. In Render, create a new **Web Service** from your repo.
2. Set root directory to `backend`.
3. Use settings from `backend/render.yaml`.
4. Set env vars:
   - `DATABASE_URL=<your neon postgres url>`
   - `DEBUG=false`
   - `ALLOWED_HOSTS=api.medicore.com,medicore.com,www.medicore.com`
   - `CORS_ALLOW_ALL_ORIGINS=false`
   - `CORS_ALLOWED_ORIGINS=https://medicore.com,https://www.medicore.com`
   - `CSRF_TRUSTED_ORIGINS=https://medicore.com,https://www.medicore.com`
   - `FRONTEND_APP_URL=https://medicore.com`
   - `PLATFORM_BASE_DOMAIN=medicore.com`
   - `PLATFORM_SUBDOMAIN_MODE=true`
   - `PLATFORM_HOSTS=medicore.com,www.medicore.com,api.medicore.com`
   - `ENABLE_TENANT_HOST_ENFORCEMENT=true`
   - `ENABLE_DYNAMIC_CORS_GUARD=true`
5. Deploy and verify backend API is reachable at your Render URL.
6. Add custom backend domain: `api.medicore.com`.

## 3. Frontend (Vercel)

1. Import repo to Vercel, choose root `frontend`.
2. Add env var:
   - `NEXT_PUBLIC_API_URL=https://api.medicore.com/api/v1`
3. Deploy.
4. Add custom domains:
   - `medicore.com`
   - `www.medicore.com`
   - `*.medicore.com` (wildcard)

## 4. DNS Records

At your DNS provider add:

1. `A/ALIAS` for root `medicore.com` -> Vercel target.
2. `CNAME` for `www` -> Vercel.
3. `CNAME` wildcard `*` -> Vercel (for hospital subdomains).
4. `CNAME` for `api` -> Render backend hostname.

## 5. TLS / Certificates

1. Vercel issues certs automatically for root, www, wildcard.
2. Render issues cert for `api.medicore.com` after DNS is correct.

## 6. Post-Deploy Checks

1. Open `https://medicore.com` and login.
2. Open `https://<hospital_slug>.medicore.com` and login.
3. Verify frontend API calls hit `https://api.medicore.com/api/v1`.
4. Verify tenant host resolution in backend (hospital-specific branding/settings).
5. Validate admin settings domain/subdomain view and updates.

## 7. Recommended Background Job

Schedule on backend host:

1. `python manage.py refresh_domain_health --limit 200`
2. Run every 15-30 minutes.

## 8. Important

1. Do not use SQLite in production.
2. Keep secrets only in platform env vars.
3. Keep `DEBUG=false` in production.

## 9. Copy-Paste Env Blocks

### Render Backend Env Vars

Use these key/value pairs in Render service environment settings:

```env
DATABASE_URL=<paste-neon-postgres-url>
DEBUG=false
DJANGO_SECRET_KEY=<generate-strong-random-secret>

ALLOWED_HOSTS=api.medicore.com,medicore.com,www.medicore.com

CORS_ALLOW_ALL_ORIGINS=false
CORS_ALLOWED_ORIGINS=https://medicore.com,https://www.medicore.com
CSRF_TRUSTED_ORIGINS=https://medicore.com,https://www.medicore.com

FRONTEND_APP_URL=https://medicore.com

PLATFORM_BASE_DOMAIN=medicore.com
PLATFORM_SUBDOMAIN_MODE=true
PLATFORM_HOSTS=medicore.com,www.medicore.com,api.medicore.com
ENABLE_TENANT_HOST_ENFORCEMENT=true
ENABLE_DYNAMIC_CORS_GUARD=true

DB_SSLMODE=require
DB_CONN_MAX_AGE=60

EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=<your-smtp-host>
EMAIL_PORT=587
EMAIL_HOST_USER=<your-smtp-user>
EMAIL_HOST_PASSWORD=<your-smtp-password-or-app-password>
EMAIL_USE_TLS=true
DEFAULT_FROM_EMAIL=<your-from-email>
ENABLE_PASSWORD_VALIDATORS=true
```

### Vercel Frontend Env Vars

Add this in Vercel project environment variables:

```env
NEXT_PUBLIC_API_URL=https://api.medicore.com/api/v1
```

### Optional Staging Example

If you create staging:

```env
# Render (staging)
ALLOWED_HOSTS=api-staging.medicore.com,staging.medicore.com
CORS_ALLOWED_ORIGINS=https://staging.medicore.com
CSRF_TRUSTED_ORIGINS=https://staging.medicore.com
FRONTEND_APP_URL=https://staging.medicore.com
PLATFORM_HOSTS=staging.medicore.com,api-staging.medicore.com

# Vercel (staging)
NEXT_PUBLIC_API_URL=https://api-staging.medicore.com/api/v1
```
