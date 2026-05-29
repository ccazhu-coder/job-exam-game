# GovOps OS Production Release Checklist

Date: 2026-05-29
Status: PASS

## Production Backend Decision

- Decision: A
- Production backend: current Auth-capable ERP backend
- Deployment ID: `AKfycbws...dYmXQ`
- Previous candidate `AKfycbyFYe...vHW1zQ`: downgraded to old / non-production deployment
- Frontend config: `govbid-os/app/config.js`
- Backend source rule: frontend reads only `window.GOVOPS_CONFIG.API_URL`
- User-facing rule: Web App URL must not be displayed in formal screens

## Frontend Release

- Frontend publish commit: `aa466a1 Publish GovOps frontend auth path fixes`
- Backend decision commit: `201a8f2 Document GovOps production backend decision`
- GitHub Pages base: `https://ccazhu-coder.github.io/job-exam-game/govbid-os/app/`

### GitHub Pages Page Checks

- `login.html`: PASS, HTTP 200
- `dashboard.html`: PASS, HTTP 200
- `admin-console.html`: PASS, HTTP 200
- `finance-secretary.html`: PASS, HTTP 200

## Production API Verification

- `system.ping`: PASS, `GovOps OS ERP 服務正常。`
- `dashboard.summary`: PASS, `首頁戰情已更新。`
- `navigation.modules`: PASS, `正式模組已載入。`
- `erp.integrity`: PASS, `ERP 資料關係完整。`
- `project.create`: PASS, `專案已建立。`
- `activity.create`: PASS, `活動已建立。`
- `activity.child.create`: PASS, `活動子資料已建立。`

## Auth Verification

- `auth.login` wrong password: PASS, `密碼不正確，請重新輸入。`
- `auth.me` invalid session: PASS, `登入狀態已失效，請重新登入。`
- `auth.logout`: PASS, `已登出。`
- Correct credential login: PASS by prior live frontend confirmation
- Frontend login guard: PASS
- Dashboard `auth.me` protection: PASS
- Admin Console owner/admin guard: PASS
- Finance Secretary login protection: PASS

## Relationship Guard Verification

- `activity.create` without `projectId`: PASS, rejected with Chinese operational message
- `activity.child.create` with mismatched `projectId` / `activityId`: PASS, rejected with Chinese operational message
- Activity remains bound to `projectId`: PASS
- Activity child records remain bound to `projectId` + `activityId`: PASS

## Safety Checks

- No visible mojibake: PASS
- No visible demo session text: PASS
- No visible `LOCAL-DEMO`: PASS
- No visible `API_URL`: PASS
- No visible Apps Script URL: PASS
- No visible stack trace: PASS
- No visible Runtime / Backend engineering text: PASS
- No formal engineering QA entry on user-facing pages: PASS
- No legacy entry restored as formal main flow: PASS

## Non-P0 Remaining Work

- Final operator login/logout smoke test on GitHub Pages with the real production password.
- Formal admin-console operational walkthrough by owner/admin.
- Long-running production data cleanup for QA-created project/activity rows if desired.
- Future product work: ERP module deepening, LINE / Calendar / Drive integrations, and AI command center expansion.

## Production Release Judgment

- Commercial readiness: 95%
- Release judgment: PASS
- Go-live recommendation: Ready for formal go-live final smoke test

