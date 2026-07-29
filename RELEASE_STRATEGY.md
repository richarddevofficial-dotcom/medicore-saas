# Release Strategy: dev -> staging -> main

This repository uses a 3-branch promotion model to reduce production risk:

1. `dev` for active fixes and feature integration
2. `staging` for pre-production verification
3. `main` for production only

## Branch Rules

1. Never push untested work directly to `main`.
2. All production changes must come from `staging`.
3. All staging changes must come from `dev`.
4. Prefer pull requests for every promotion step.

## Standard Workflow

### 1) Start Work on dev

```bash
git checkout dev
git pull origin dev
# make changes
git add .
git commit -m "Describe change"
git push origin dev
```

### 2) Validate on dev

Run the minimum required checks before promotion:

```bash
# frontend example
cd frontend
npm run lint
npm run build

# backend example
cd ../backend
python manage.py check
python manage.py test
```

### 3) Promote dev -> staging

Option A (recommended): PR from `dev` to `staging`.

Option B (direct merge if urgent):

```bash
git checkout staging
git pull origin staging
git merge --no-ff dev -m "Promote dev to staging"
git push origin staging
```

### 4) Validate on staging

Repeat release checks in a staging environment:

1. Authentication and login flows
2. Super-admin impersonation flow
3. Dashboard and platform routes
4. API health and key business paths

### 5) Promote staging -> main

Option A (recommended): PR from `staging` to `main`.

Option B (direct merge if approved):

```bash
git checkout main
git pull origin main
git merge --no-ff staging -m "Promote staging to main"
git push origin main
```

## Hotfix Workflow

1. Create hotfix branch from `main`.
2. Apply fix and test quickly.
3. Merge hotfix to `main`.
4. Back-merge hotfix into `staging` and `dev` to keep branches aligned.

## GitHub Branch Protection (Required)

Set these in repository settings:

1. Protect `main`:
   - Require pull request before merge
   - Require status checks to pass
   - Restrict direct pushes
2. Protect `staging`:
   - Require pull request before merge
   - Require status checks to pass
3. Optional for `dev`:
   - Require at least one review for larger changes

## Release Checklist

1. Code merged to `dev`
2. Dev checks passed
3. Promoted to `staging`
4. Staging verification passed
5. Promoted to `main`
6. Post-deploy smoke test passed

Keeping this sequence strict prevents accidental regressions in production.
