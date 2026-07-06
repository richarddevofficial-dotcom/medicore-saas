# Deployment and Environment Checklist

## 1. Prerequisites

- Python 3.10+ with a virtual environment
- Node.js 18+ and npm
- SQLite is already configured for local development

## 2. Backend setup

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 127.0.0.1:8001
```

## 3. Frontend setup

```powershell
cd frontend
npm install
npm run dev -- --hostname 127.0.0.1 --port 3002
```

## 4. Environment notes

- Frontend API base URL should point to the backend API root:
  - Example: http://127.0.0.1:8001/api/v1
- Backend is currently configured for local development with SQLite and permissive CORS.
- For production, change:
  - SECRET_KEY
  - DEBUG
  - ALLOWED_HOSTS
  - database settings
  - CORS policy

## 5. Verified local login

- Superuser email: drichigroup@gmail.com
- Password: group@123

## 6. Verification commands

```powershell
cd backend
.\venv\Scripts\python.exe manage.py check
.\venv\Scripts\python.exe manage.py test billing.tests

cd frontend
npm run lint
```

## 7. Production readiness reminders

- Replace the insecure Django secret key
- Use a production database such as PostgreSQL
- Configure proper HTTPS and domain settings
- Set up environment-based configuration instead of hard-coded values
- Add CI/CD and automated deployment checks
