---
name: meiling-add-menu-page
description: >-
  Adds a new meiling-ui page wired to backend sys_menu: SQL seed, viewRegistry,
  Vue view, i18n zh/en/ja, and PERM guards. Use when creating menus, replacing
  PlaceholderView, writing docs/sql/*_menu.sql, or registering operation/knowledge routes.
---

# meiling-ui · 新菜单页

## 前置

1. 确认 `sys_menu.component` 字符串（与后端菜单一致，如 `operation/topology/index`）
2. 确认 `perms`（复用已有 list 权限优先，避免新权限码）
3. 读同类 SQL 样板：`docs/sql/28_operation_topology_menu.sql`

## 清单

```
- [ ] 1. SQL：docs/sql/NN_<module>_<name>_menu.sql
- [ ] 2. viewRegistry：src/router/viewRegistry.ts → CRM_VIEWS
- [ ] 3. 视图：src/views/<module>/<Name>View.vue
- [ ] 4. i18n：zh.ts / en.ts / ja.ts 同路径 key
- [ ] 5. 权限：PERM 常量 + assertAction/guardAction
- [ ] 6. （可选）supplement 路由：operationSupplementRoutes.ts
- [ ] 7. 执行 SQL → 用户重新登录
- [ ] 8. npm run build
```

## Step 1 · SQL

```sql
INSERT INTO sys_menu (id, ..., menu_name, menu_name_en, menu_name_ja,
  parent_id, path, component, route_name, menu_type, perms, status, icon, order_num)
VALUES (...)
ON DUPLICATE KEY UPDATE ...;

INSERT INTO sys_role_menu (id, role_id, menu_id) VALUES (...)
ON DUPLICATE KEY UPDATE ...;
```

- `component` **必须**与 `viewRegistry` 键完全一致
- `menu_type`：`C` 菜单 / `F` 按钮
- 文件头注释：parent_id、设计文档、执行后重新登录

## Step 2 · viewRegistry

在 `src/router/viewRegistry.ts` 的 `CRM_VIEWS` 增加：

```typescript
'operation/foo/index': () => import('@/views/operation/FooView.vue'),
```

未注册 → `PlaceholderView`（页面空白占位）。

## Step 3 · 视图骨架

- 运营页：复用 `OperationPageHeader`、`.operation-search-form`、`AppPagination`
- 知识库：见 `KnowledgeBrowseView.vue` 布局
- 权限：`guardAction(PERM.XXX)` 控制按钮；列表页用 `assertAction` 控制入口

## Step 4 · operation supplement（仅运营子路由）

若菜单可能未执行 SQL，在 `src/router/operationSupplementRoutes.ts` 补：
- `*_ROUTE`（RouteRecordRaw）
- `*_MENU`（MenuVo，component 与 viewRegistry 一致）

参考 `OPERATION_TOPOLOGY_ROUTE` / `OPERATION_TOPOLOGY_MENU`。

## Step 5 · 验证

1. `npm run build`
2. 重新登录后侧栏可见
3. 点击菜单非 PlaceholderView
4. 无权限账号按钮隐藏/禁用

## 常见错误

| 现象 | 原因 |
|------|------|
| PlaceholderView | `component` 与 `CRM_VIEWS` 键不匹配 |
| 菜单不显示 | SQL 未执行或 `sys_role_menu` 未授权 |
| 按钮无权限仍可见 | 未用 `guardAction` / 未重新登录拿新 perm |

## 延伸阅读

- [meiling-i18n-sync](../meiling-i18n-sync/SKILL.md)
- [meiling-task-closeout](../meiling-task-closeout/SKILL.md)
