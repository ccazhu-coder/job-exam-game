# GovOps OS Production Backend Decision

Date: 2026-05-29
Status: Decision A adopted

## Production Backend

GovOps OS now uses a single Production Backend for the formal frontend in `govbid-os/app/config.js`.

- Production deploymentId: `AKfycbws...dYmXQ`
- Frontend config source: `window.GOVOPS_CONFIG.API_URL`
- User-facing screens must not display the Web App URL.

## Decision

The current login-capable backend is promoted to Production Backend because it passed the required Auth and ERP checks:

- `system.ping`
- `auth.login`
- `auth.me`
- `auth.logout`
- `dashboard.summary`
- `navigation.modules`
- `project.create`
- `activity.create`
- `activity.child.create`
- `erp.integrity`

The prior candidate deployment `AKfycbyFYe...vHW1zQ` is downgraded to old / non-production deployment because Auth is not available there and `dashboard.summary` is not stable enough for production.

## Guardrails

- Do not add a second production backend.
- Do not switch the frontend between backend URLs.
- Do not expose initialization actions through Web App routes.
- Do not expose passwords, secrets, password hashes, raw stack traces, Apps Script URLs, or runtime details to users.
- Do not let activity data exist without `projectId`.
- Do not let activity child data exist without both `projectId` and `activityId`.