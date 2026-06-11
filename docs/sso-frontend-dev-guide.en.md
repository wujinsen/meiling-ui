# meiling-ui Multi-System SSO Frontend Dev Guide

Last updated: 2026-06-11  
Scope: `meiling-ui` integrating with `moli-project-single` (moli-admin) portal SSO

> **For AI / developers**: When working on SSO in **meiling-ui**, read this file first. Backend design: `../../moli-project-single/docs/multi-system-sso-design.md`.

## Quick reference

- **Frontend**: Vue 3 + Vite + TS + Tailwind; composables only (no Pinia); no Element UI
- **Backend**: `moli-project-single` / module `moli-server`; product name **moli-admin**
- **Dev API**: `http://127.0.0.1:8888`; Vite proxies `/system`, `/login`, `/sso`, etc.
- **Env**: `VITE_USE_MOCK_AUTH=false`

## Already implemented (do not rebuild)

- `SystemSelectView.vue`, `SystemSwitcher.vue`, `useSystemPortal.ts`, `useAuth.ts`
- `router/index.ts` portal guards, `UserManageView.vue` system assignment
- `SystemUserAssignView.vue` — by-system tab uses `GET /user/getUserBySystem` + `unauthorizedUsersBySystem`; by-user tab uses `getSystemByUserId` / `insertUserSystem`
- `api/system.ts` (my/enter/switch/list), `api/user.ts` (system user APIs), `utils/privilege.ts`, i18n `system.portal.*`
- Portal grouping: `SystemSelectView.vue`, `constants/systemGroup.ts`, `SystemManageView` `systemGroup` field
- Backend spec: `moli-project-single/docs/portal-system-group.md`

## Portal grouping (`systemGroup`)

Read: [portal-system-group-ui.en.md](portal-system-group-ui.en.md)

## Business rules

- **Super admin and normal users both must pick/enter one system**; super admin sees all systems and gets full menus + `*:*:*` on INTERNAL enter
- **INTERNAL**: stay in app, load `menuVoList`; **EXTERNAL**: redirect with ticket
- Login: single INTERNAL system → auto enter; multiple systems → `/system-select`

## Priority task A: System registry admin page (missing)

Create `src/views/system/SystemManageView.vue` — CRUD for `sys_system`:

- APIs: `GET /system/list`, `POST /system`, `PUT /system`, `DELETE /system/{ids}`
- Fields: systemCode, systemName, baseUrl, ssoMode, entryPath, icon, sort, status, remark
- Mutations require super admin (`superadmin` / `admin`); use `isCurrentUserSuperAdmin()`
- Extend `api/system.ts`, i18n `system.manage.*`, match `UserManageView` style

**Menu route fields** (sys_menu / Menu Manage UI):

| Field | Value |
|-------|-------|
| Parent | System admin (`parent_id=1`) |
| Type | C (menu) |
| path | `system` → browser URL `/system/system` |
| component | `system/system/index` (must match `viewRegistry.ts`) |
| perms | `system:system:list` |

SQL: `moli-project-single/sql/patch_sys_menu_system_registry.sql`

## Task B: Portal integration fixes

- Add `fullPermission?: boolean` to `LoginVo` in `types/api.ts`
- Do **not** bypass portal or menu guards for super admin
- Verify login → system-select → enter → switch flow

## Deliverables

- [ ] SystemManageView + API + i18n
- [ ] Portal E2E works with backend on :8888
- [ ] `npm run build` passes

Chinese full spec: [sso-frontend-dev-guide.md](sso-frontend-dev-guide.md)
