# System select page — portal grouping (frontend)

> Backend spec: `../../moli-project-single/docs/portal-system-group.md`  
> Run SQL first: `moli-project-single/sql/patch_sys_system_group.sql`

## Scope

- `SystemSelectView.vue` — group cards by `systemGroup`; hide empty groups
- `SystemManageView.vue` — column, filter, form field for `systemGroup`
- `types/system.ts`, `constants/systemGroup.ts`, i18n `system.portal.group.*`

Do **not** change enter/switch, external redirect, or sidebar menus.

## API

`GET /system/my` → `systemGroup`. List/save support same field. Default: `business`.

## Groups (fixed order)

`governance` → `business` → `ai` → `tech` → `ops` → `data` → `office`

See Chinese doc: [portal-system-group-ui.md](portal-system-group-ui.md)

## Done when

Grouped portal UI works, registry CRUD/filter works, build passes.
