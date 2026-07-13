# SSO 菜单隔离 · 前端开工手册（meiling-ui · SSO-MENU-1）

> **更新**：2026-07-13（**Q3/Q5 已定案** · 后端 P0/P1 **已实现** · 前端 F-SSO **已落地** · **联合走查通过**）  
> **任务 ID**：**SSO-MENU-1**（P2）  
> **前端仓库**：`meiling-ui` · 分支 `main`  
> **Monorepo 镜像**：[moli-project-distribute/docs/api/sso-menu-frontend-handoff.md](../../moli-project-distribute/docs/api/sso-menu-frontend-handoff.md)  
> **后端设计**：[sso-menu-system-isolation.md](../../moli-project-distribute/docs/design/sso-menu-system-isolation.md) · SQL：`moli-project-distribute/docs/sql/30_sso_menu_system_id.sql`  
> **本仓后端摘要**：[per-system-menu-isolation.md](../per-system-menu-isolation.md)（**已废弃**，以 monorepo 设计稿为准）  
> **给后端**：[frontend-backend-dependencies.md](frontend-backend-dependencies.md) §5  
> **走查**：[sso-menu-frontend-walkthrough.md](../test/sso-menu-frontend-walkthrough.md)  
> **SSO 总览**：[sso-frontend-dev-guide.md](../sso-frontend-dev-guide.md)

本地：`http://127.0.0.1:5141` → proxy `8888` · `admin`/`123456` · `VITE_USE_MOCK_AUTH=false`  
门户开关：`sso.enabled=true` 且 DB 有启用行 `sys_system`（见走查 §0）

---

## 0. 给前端一句话

> 1. **运行时菜单只看当前系统** — `enter`/`switch` 成功后**必须**再调 `GET /menu/getRouters`，**清空**旧动态路由后重建；勿长期缓存 login/enter 里的 `menuVoList`。  
> 2. **未选系统**（门户多系统、Session 无 `currentSystemId`）— `getRouters` 返回 **`[]`**（Q3-A）→ 路由守卫跳**选系统页** `/system-select`，勿用上一次系统的侧栏。  
> 3. **知识库 900** — 仍挂在 **moli-admin** 侧栏（Q5-A）；门户 enter **moli-knowledge(39)** 走 `redirectUrl`，与 admin 内嵌是**两条入口**，前端各走各的分支。  
> 4. **全量 E2E** 依赖后端 `system_id` 过滤上线；守卫与 `reloadRoutesFromServer` 可**先写**，用 mock 或旧后端自测守卫分支。

---

## 1. 前后端分工

| 侧 | 内容 | 状态 |
|----|------|------|
| **后端 P0/P1** | `sys_menu.system_id` · `resolveRoutersForCurrentSystem` · backfill SQL | ✅ 已实现 |
| **前端 F-SSO-1～6** | `reloadRoutesFromServer` · 守卫 · enter/switch · tab 清空 | ✅ 已落地 |
| **联合走查** | S1–S10 + F-SSO-1～6 | ✅ **已通过**（2026-07-13） |

**现状（2026-07-13）**：`useSystemPortal.applyEnterResult` 已在 enter/switch 后调用 `loadDynamicRoutes(true)`（即会再打 `getRouters`），但 **未** 统一封装、**未** 处理 Q3 空树、且 `getRoutersApi` 失败时会 **fallback 默认菜单**（与 Q3-A 冲突，见 F-SSO-1 注）。

---

## 2. 产品定案（实现必遵）

| # | 结论 | 前端影响 |
|---|------|----------|
| **Q3-A** | 门户开启且未 `enter` → `getRouters` = **`[]`** | 全局守卫：空树 + `portalEnabled` → `/system-select`；**禁止**展示缓存侧栏 |
| **Q5-A** | 900 段 `system_id=1`（admin 内嵌） | enter **moli-admin** 后侧栏**仍可有**「企业知识库」；enter **39** 不注册 KB 动态路由，只 `window.location` / `redirectUrl` |
| 门户关闭 | 过滤不生效，行为同现网 | 无需选系统；login 直出 `menuVoList` |
| 唯一 INTERNAL | login 自动 `enter`，有过滤后的菜单 | layout 仍应用 `reloadRoutesFromServer` 双保险 |

---

## 3. API 契约（user-center `:8888`）

dev 直连：`/menu`、`/system`、`/login`（Vite proxy → `8888`，见 `vite.config.ts`）。经 Gateway 时前缀见 monorepo [frontend-routes-map.md](../../moli-project-distribute/docs/api/frontend-routes-map.md) §1。

### 3.1 `POST /login`

| 场景 | 关键字段 |
|------|----------|
| 门户关闭 | `menuVoList` + `permissions` 直出 |
| 门户开启 · 多系统 | `systemPortalEnabled=true`，`systemList[]`，**`menuVoList=[]`** |
| 门户开启 · 唯一 INTERNAL | 自动 enter：`currentSystem` + **已过滤** `menuVoList` |

### 3.2 `POST /system/enter` · `POST /system/switch`

| `ssoMode` | 响应 | 前端 |
|-----------|------|------|
| **INTERNAL** | `currentSystem` + `menuVoList`（过滤后）+ `permissions` | 见 §4.3：**仍要** `getRouters` 重建路由（勿仅信 `menuVoList`） |
| **EXTERNAL** | `menuVoList=[]`，`redirectUrl` | **不** `addRoute`；`window.location.href = redirectUrl` |

### 3.3 `GET /menu/getRouters`

| 项 | 说明 |
|----|------|
| 过滤依据 | Session **`currentSystemId`**（后端 SSO-MENU-1 后生效） |
| 未 enter | **`data: []`**（Q3-A） |
| 形状 | 不变，`MenuVo[]` 树 |
| 轮询 | 无；仅在 login / enter / switch / layout 恢复 / 手动刷新时调用 |

### 3.4 本仓 API 落点

```typescript
// src/api/menu.ts
import { request } from '@/api/http'
import type { MenuVo, MoliResult } from '@/types/api'

export async function getRoutersApi(): Promise<MoliResult<MenuVo[]>> {
  return request<MenuVo[]>('/menu/getRouters', { method: 'GET' })
}

// src/api/system.ts
import type { SystemEnterVo } from '@/types/system'

export async function enterSystemApi(systemId: number | string) {
  return request<SystemEnterVo>('/system/enter', {
    method: 'POST',
    body: jsonEntityBody({ systemId }),
  })
}

export async function switchSystemApi(systemId: number | string) {
  return request<SystemEnterVo>('/system/switch', {
    method: 'POST',
    body: jsonEntityBody({ systemId }),
  })
}
```

类型：`MenuVo` · `LoginVo` · `SystemEnterVo` → `src/types/api.ts`、`src/types/system.ts`。

---

## 4. 前端任务清单（F-SSO-1～6）

> 技术栈：**composables**（无 Pinia）。动态路由在 `usePermission.ts`；门户在 `useSystemPortal.ts`。

### F-SSO-1 · 统一「拉菜单 + 注册路由」`reloadRoutesFromServer`

抽一个函数，**唯一**入口负责：

1. `GET /menu/getRouters`
2. 若 `data.length === 0` 且门户开启且无 `currentSystem` → 走 F-SSO-2，**return false**
3. `resetDynamicRoutes()` → `applyMenusToRouter`（或 `loadDynamicRoutesFromMenus`）
4. 写入侧栏 `menus`（`saveMenus`）

**调用点**（至少）：

- `useSystemPortal.applyEnterResult`（INTERNAL 分支，替换裸调 `loadDynamicRoutes(true)`）
- `router/index.ts` 守卫里 `loadDynamicRoutes()` 改为 `reloadRoutesFromServer()`（或内部委托）
- 应用 layout **首次挂载**（有 token、已 enter）— 可选与守卫合并

**实现示例**（新建 `src/composables/reloadRoutesFromServer.ts` 或并入 `usePermission.ts`）：

```typescript
import { getRoutersApi } from '@/api/menu'
import { ensurePermissionsLoaded } from '@/composables/useActionPermissions'
import { loadDynamicRoutesFromMenus, resetDynamicRoutes } from '@/composables/usePermission'
import { getStoredCurrentSystem, isPortalEnabledStored } from '@/utils/authSession'
import { API_SUCCESS_CODE } from '@/types/api'
import { getDefaultMenus } from '@/router/defaultMenus'

const FALLBACK_MSG = '使用前端默认菜单'

export async function reloadRoutesFromServer(): Promise<boolean> {
  const portalOn = isPortalEnabledStored()
  const current = getStoredCurrentSystem()

  const result = await getRoutersApi()
  const isDevFallback = result.msg === FALLBACK_MSG
  const menus = result.code === API_SUCCESS_CODE ? (result.data ?? []) : []

  // Q3-A：门户开启、未 enter、后端真返回空树（非 dev fallback）
  if (!menus.length && portalOn && !current?.id && !isDevFallback) {
    await resetDynamicRoutes()
    const { router } = await import('@/router')
    await router.replace({ name: 'system-select' })
    return false
  }

  await resetDynamicRoutes()
  const source = isDevFallback ? getDefaultMenus() : menus
  if (source.length) {
    await loadDynamicRoutesFromMenus(source)
  }
  await ensurePermissionsLoaded()
  return true
}
```

> **注**：当前 `getRoutersApi` 在 catch 时返回 `getDefaultMenus()`（`msg: 使用前端默认菜单`）。SSO-MENU-1 联调前须区分 **「后端空树 `[]`」** 与 **「dev fallback」**，避免 Q3 守卫失效。

### F-SSO-2 · 未 enter 守卫（Q3-A）

| 条件 | 动作 |
|------|------|
| `portalEnabled && !currentSystem?.id` | 除白名单外 → **`/system-select`** |
| `getRouters` 返回 `[]` 且门户开启、非 fallback | 同上；**禁止** `saveMenus` 保留旧树 |

白名单（已有）：`login`、`system-select`（`meta.skipMenuGuard`）。

`src/router/index.ts` 已有：

```typescript
if (isPortalEnabledStored() && !getStoredCurrentSystem() && to.name !== 'system-select') {
  return { path: '/system-select' }
}
```

**补强**：`reloadRoutesFromServer` 返回 `false` 时守卫不再 `loadDynamicRoutes` 灌入默认菜单。

### F-SSO-3 · enter / switch 后强制刷新（P2 核心）

`useSystemPortal.ts` 改造要点：

```typescript
import { reloadRoutesFromServer } from '@/composables/reloadRoutesFromServer'

async function applyEnterResult(data: SystemEnterVo) {
  if (data.redirectUrl) {
    window.location.href = data.redirectUrl
    return 'external' as const
  }
  persistPortalState(systemList.value, data.currentSystem, portalEnabled.value)
  if (hasPermissionsPayload(data.permissions, data.fullPermission)) {
    savePermissions(data.permissions, data.fullPermission)
  }
  resetPageTabs()
  try {
    await reloadRoutesFromServer()
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : '加载系统菜单失败')
  }
  return 'internal' as const
}
```

`SystemSelectView` / `SystemSwitcher` 继续调 `enterSystem` / `switchToSystem` 即可。

### F-SSO-4 · 切换系统清理态

| 项 | 本仓落点 |
|----|----------|
| 动态路由 | `resetDynamicRoutes()`（F-SSO-1 已含） |
| 页签 | `resetPageTabs()`（`useSystemPortal` 已有） |
| Session 菜单缓存 | `clearMenus()` / `saveMenus`（`authSession.ts`） |
| `permissions` | enter/switch 带 payload 则 `savePermissions`；否则 `ensurePermissionsLoaded()` |

### F-SSO-5 · login 多系统分支

`handlePostLogin` 要点：

- 多系统无 `currentSystem` → 返回 `/system-select`，**不**注册动态路由
- 唯一 INTERNAL 有 `currentSystem` → `reloadRoutesFromServer()` 双保险
- 门户关闭 → `reloadRoutesFromServer()` 或保留 `loadDynamicRoutes(true)`

确认：login 后 **不会** 在 `menuVoList=[]` 时仍显示上一轮系统的侧栏。

### F-SSO-6 · 知识库 · Q5-A 验收点

| 场景 | 期望 |
|------|------|
| enter **moli-admin** + 角色有 KB 权限 | 侧栏有 **900 企业知识库**；`/knowledge/browse` 可进 |
| enter **moli-knowledge (39)** | `redirectUrl` 跳转；meiling-ui **不**依赖 900 出现在 `getRouters` |
| 从 admin 切到其它 INTERNAL（若有 BI 等） | 侧栏**无** 900（900 仅 `system_id=1`） |

知识库数据 API 仍走 `8090` / `KnowledgeServer`；本任务**只改菜单来源与路由刷新**，不改 KB 页面。`viewRegistry` 已注册 `knowledge/*/index`。

---

## 5. 建议改动文件（meiling-ui）

| ID | 区域 | 文件 |
|----|------|------|
| F-SSO-1 | API | `src/api/menu.ts`、`src/api/system.ts` |
| F-SSO-1 | 路由核心 | `src/composables/usePermission.ts` · 新建 `reloadRoutesFromServer.ts` |
| F-SSO-2 | 守卫 | `src/router/index.ts` |
| F-SSO-3 | 门户 | `src/composables/useSystemPortal.ts` |
| F-SSO-3 | UI | `src/views/SystemSelectView.vue`、`src/components/layout/SystemSwitcher.vue` |
| F-SSO-4 | Session | `src/utils/authSession.ts`、`src/composables/usePageTabs.ts` |
| F-SSO-5 | 登录 | `src/composables/useAuth.ts` |
| F-SSO-6 | — | 无 KB 页改动；验 `knowledgeSupplementRoutes` 不与 Q5 冲突 |

单测建议：`reloadRoutesFromServer` mock `getRoutersApi` → `[]` + portal on → 断言 `resetDynamicRoutes` + 跳转选系统。

---

## 6. 验收 / 走查

完整勾选表：[sso-menu-frontend-walkthrough.md](../test/sso-menu-frontend-walkthrough.md)

| ID | 场景 | 通过 |
|----|------|------|
| S4 | switch 后 `getRouters` | 侧栏菜单集变化，无串台 |
| S10 | 未 enter 调 `getRouters` | 空树 → 跳选系统 |
| S3 | enter admin | 有运营/系统段；**有 900**（有权限时）；**无** 500/600 段 |
| S5 | enter knowledge 39 | `redirectUrl`，无动态路由注册 |

---

## 7. 联调顺序

```text
① 前端合入 F-SSO-1～5（reloadRoutesFromServer + 守卫 + enter/switch）
② 后端合入 SSO-MENU-1 P0+P1 + 执行 30_sso_menu_system_id.sql
③ 8888 重启 · 门户开启 · 多系统账号走查 S1–S10
④ npm run build · 登录 → 选系统 → 切换 不回归
```

---

## 8. 相关文档

| 文档 | 用途 |
|------|------|
| [sso-menu-system-isolation.md](../../moli-project-distribute/docs/design/sso-menu-system-isolation.md) | 后端算法 · Q3/Q5 · 测试 S1–S10 |
| [per-system-menu-isolation.md](../per-system-menu-isolation.md) | 给后端的变更说明（本仓） |
| [sso-frontend-dev-guide.md](../sso-frontend-dev-guide.md) | 门户 · enter/switch · 权限 |
| [portal-system-group-ui.md](../portal-system-group-ui.md) | 选系统页 `systemGroup` |
| [user-center-api-map.md](user-center-api-map.md) | System / Menu HTTP 索引 |
| [frontend-gaps.md](../frontend-gaps.md) §3 | SSO-MENU-1 排期 |
