# Public Assets Guide

This folder holds static assets served directly by the app.

## Recommended Structure

- brand/
- icons/
- images/auth/
- images/empty-states/
- images/placeholders/
- images/email/
- images/print/
- fonts/brand/

## Naming Conventions

Use kebab-case and stable names.

### Brand

- brand/logo-light.svg
- brand/logo-dark.svg
- brand/logo-icon.svg
- brand/hospital-default-logo.svg

### Icons and App Manifest Assets

- icons/favicon.ico
- icons/icon-16.png
- icons/icon-32.png
- icons/icon-180.png
- icons/icon-192.png
- icons/icon-512.png
- icons/apple-touch-icon.png
- icons/maskable-512.png

### Auth and Marketing-like Screens

- images/auth/login-hero.webp
- images/auth/register-hero.webp

### Empty States

- images/empty-states/patients-empty.svg
- images/empty-states/appointments-empty.svg
- images/empty-states/billing-empty.svg
- images/empty-states/lab-empty.svg
- images/empty-states/insurance-empty.svg

### Placeholders

- images/placeholders/avatar-staff.png
- images/placeholders/avatar-patient.png
- images/placeholders/hospital-logo.png

### Email and Print

- images/email/receipt-header.png
- images/email/receipt-footer.png
- images/print/report-watermark.png

## Format Recommendations

- Logos and icons: SVG where possible.
- Photos/illustrations: WEBP first, PNG fallback only when transparency or compatibility requires it.
- Keep large files compressed before commit.

## Cleanup Recommendation

Remove starter demo files when no longer used:

- file.svg
- globe.svg
- next.svg
- vercel.svg
- window.svg
