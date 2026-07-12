---
name: meiling-sso-system-page
description: >-
  Implements meiling-ui SSO portal, system registry, and system-user assignment.
  Use for SystemSelectView, SystemManageView, enterSystem, switchSystem, INTERNAL
  vs EXTERNAL, systemGroup, or login-to-portal flow changes.
---

# meiling-ui · SSO / 系统门户

## 必读

1. [docs/sso-frontend-dev-guide.md](../../docs/sso-frontend-dev-guide.md)（完整）
2. [docs/portal-system-group-ui.md](../../docs/portal-system-group-ui.md)（选系统分组 UI）
3. [docs/per-system-menu-isolation.md](../../docs/per-system-menu-isolation.md)（菜单隔离过渡方案）

后端设计：`../moli-project-single/docs/multi-system-sso-design.md`

## 联调

```bash
# 后端 8888，sso.enabled: true
# 前端
VITE_USE_MOCK_AUTH=false
npm run dev   # http://127.0.0.1:5141
```

`vite.config.ts` 代理：`/login` `/system` `/sso` `/menu` `/user` → 8888

## 主流程（勿破坏）

```
登录 → （多系统）/system-select → POST /system/enter → 加载菜单路由 → 顶栏 switch
```

收尾必须冒烟：[meiling-task-closeout](../meiling-task-closeout/SKILL.md)

## 核心规则

| 规则 | 说明 |
|------|------|
| 超管也要选系统 | 可见全部系统；进入后 `*:*:*` |
| INTERNAL | `enter` 返回 `menuVoList`，留本应用 |
| EXTERNAL | `enter` 返回 `redirectUrl?ticket=`，`window.location` 跳转 |
| 单 INTERNAL 系统 | 后端可自动 enter，跳过选系统页 |
| 门户降级 | `sso.enabled: false` → 直接 `getRouters` |

## 代码落点

| 功能 | 路径 |
|------|------|
| 选系统页 | `src/views/SystemSelectView.vue` · `src/constants/systemGroup.ts` |
| 顶栏切换 | `src/components/layout/SystemSwitcher.vue` |
| 门户状态 | `src/composables/useSystemPortal.ts` |
| 登录/守卫 | `src/composables/useAuth.ts` · `src/router/index.ts` |
| 系统注册 CRUD | `src/views/system/SystemManageView.vue` |
| 用户↔系统 | `src/views/system/SystemUserAssignView.vue` · `useSystemUserMatrix.ts` |
| API | `src/api/system.ts`（my/enter/switch/list）· `src/api/user.ts`（系统分配） |
| Session | `src/utils/authSession.ts` · `src/utils/privilege.ts` |

## 系统注册页（SystemManageView）

- 路由：`system/system/index` · 权限 `system:system:list`
- 增删改需 **超管账号**（`isCurrentUserSuperAdmin()`），否则后端 `10009`
- 表单：`systemCode` · `systemName` · `ssoMode` · `baseUrl` · `status` · `systemGroup`
- i18n：`system.manage.*`（三语）

## 新页面 / 菜单

系统内新菜单仍走动态 `getRouters` + [meiling-add-menu-page](../meiling-add-menu-page/SKILL.md) 的 `viewRegistry`。

**不要**用路径前缀裁剪替代后端按系统下发菜单（见 `per-system-menu-isolation.md`）。

## 验证

1. `superadmin`：见全部系统、进入后全菜单
2. 普通用户：仅分配系统；EXTERNAL 正确跳转
3. 切换系统后菜单与 `currentSystem` 一致
4. Token 失效回登录带 `redirect`

## API 速查

```http
GET  /system/my
POST /system/enter      { systemId }
POST /system/switch     { systemId }
GET  /menu/getRouters
```

Header：`Authorization: <sessionId>`（`http.ts` 自动带）
