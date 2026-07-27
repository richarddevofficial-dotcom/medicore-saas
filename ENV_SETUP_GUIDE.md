# Environment Setup Guide

## Quick Start for Local Development

### 1. Copy the template

```bash
cd /medicore-saas
cp .env.example .env
```

### 2. Verify .env exists

```bash
ls -la .env
cat .env
```

### 3. Restart Docker containers

```bash
docker compose down
docker compose up -d
```

### 4. Verify setup

```bash
# Check containers running
docker compose ps

# Verify backend loaded environment
docker compose exec backend python manage.py check

# Run migrations
docker compose exec backend python manage.py migrate

# Create superuser
docker compose exec backend python manage.py createsuperuser
```

---

## File Descriptions

| File                      | Purpose                          | Commit?                 |
| ------------------------- | -------------------------------- | ----------------------- |
| `.env`                    | Your local development variables | ❌ NO (in .gitignore)   |
| `.env.example`            | Template for local development   | ✅ YES (safe to commit) |
| `.env.production.example` | Template for production          | ✅ YES (safe to commit) |

---

## Environment Variables Explained

### Core Configuration

- `DEBUG` - Enable debug mode (true for dev, false for prod)
- `DJANGO_SECRET_KEY` - Secret key for Django (generate a new one!)
- `ENVIRONMENT` - Environment name (development, staging, production)
- `ALLOWED_HOSTS` - Comma-separated list of allowed hostnames

### Database

- `DATABASE_URL` - PostgreSQL connection string
- Format: `postgresql://user:password@host:port/database`

### Cache & Queue

- `REDIS_URL` - Redis connection for cache and Celery
- Format: `redis://host:port/db_number`

### Security & Encryption

- `ENCRYPTION_KEY` - For encrypting sensitive data (national_id, passport, etc)
- `BACKUP_ENCRYPTION_KEY` - For encrypting database backups
- Generate with: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`

### CORS & CSRF

- `CORS_ALLOWED_ORIGINS` - Which domains can access the API
- `CSRF_TRUSTED_ORIGINS` - Which domains are trusted for CSRF validation

### Email

- `EMAIL_BACKEND` - Mail backend type
  - Local dev: `django.core.mail.backends.console.EmailBackend` (prints to console)
  - Production: `django.core.mail.backends.smtp.EmailBackend` (sends real emails)

### Frontend

- `NEXT_PUBLIC_API_URL` - Backend API URL (used by Next.js)
- `NEXT_PUBLIC_APP_URL` - Frontend app URL

---

## Generate Required Keys

```bash
# Generate DJANGO_SECRET_KEY
python -c "from django.core.management.utils import get_random_secret_key; print('DJANGO_SECRET_KEY=' + get_random_secret_key())"

# Generate ENCRYPTION_KEY
python -c "from cryptography.fernet import Fernet; print('ENCRYPTION_KEY=' + Fernet.generate_key().decode())"

# Generate BACKUP_ENCRYPTION_KEY
python -c "from cryptography.fernet import Fernet; print('BACKUP_ENCRYPTION_KEY=' + Fernet.generate_key().decode())"
```

---

## Production Deployment

### 1. Create .env for production

```bash
cd /path/to/medicore-saas
cp .env.production.example .env.production
```

### 2. Edit with real values

```bash
nano .env.production
# Update all <PLACEHOLDER> values
```

### 3. Load in Docker (on DigitalOcean)

```bash
# Use production .env
cp .env.production .env

# Restart containers
docker compose down
docker compose up -d

# Run migrations
docker compose exec backend python manage.py migrate
```

---

## Troubleshooting

### Variables not loading?

```bash
# Check file exists
test -f .env && echo "✓ .env exists" || echo "✗ .env missing"

# Check permissions
ls -la .env

# Verify Django can read them
docker compose exec backend python -c "import os; print(os.getenv('DEBUG'))"
```

### Containers won't start?

```bash
# Check logs
docker compose logs backend

# Verify syntax
python -m py_compile backend/config/settings.py

# Rebuild
docker compose build --no-cache
docker compose up -d
```

### Database connection error?

```bash
# Test connection
docker compose exec backend python -c "from django.db import connection; connection.ensure_connection()"

# Check DATABASE_URL format
docker compose exec backend python -c "import os; print(os.getenv('DATABASE_URL'))"
```

---

## Security Best Practices

✅ **DO:**

- Generate NEW keys for production (don't reuse development keys)
- Add `.env` to `.gitignore` (never commit secrets)
- Use strong email credentials (API keys, not passwords)
- Enable SSL in production (`SECURE_SSL_REDIRECT=true`)
- Rotate keys periodically
- Use managed services (AWS Secrets Manager, HashiCorp Vault)

❌ **DON'T:**

- Commit `.env` files to Git
- Reuse development secrets in production
- Store credentials in source code
- Use hardcoded values in settings.py
- Disable security headers in production
- Allow all CORS origins (`*`)

---

## Next Steps

1. ✅ Copy `.env` from `.env.example`
2. ✅ Restart Docker: `docker compose down && docker compose up -d`
3. ✅ Run migrations: `docker compose exec backend python manage.py migrate`
4. ✅ Create superuser: `docker compose exec backend python manage.py createsuperuser`
5. ✅ Test API: `curl http://localhost:8000/api/v1/`
6. ✅ Access admin: `http://localhost:8000/admin/`
7. ✅ Access app: `http://localhost:3000/`

---

**Questions?** Check the Docker Compose logs:

```bash
docker compose logs -f
```
