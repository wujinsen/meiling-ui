# meiling-ui 多系统 SSO 前端开发与联调指南

最后更新: 2026-06-11  
适用范围: `meiling-ui` 对接 `moli-project-single`（moli-admin）多系统门户

> **给 AI / 开发者**：在 meiling-ui 仓库做 SSO 相关需求时，**先读本文**，再改代码。后端设计见同级目录 `../../moli-project-single/docs/multi-system-sso-design.md`。

## 1. 项目关系

| 项 | 说明 |
|----|------|
| 本仓库 | `meiling-ui` — Vue 3 + Vite + TypeScript + Tailwind |
| 后端仓库 | `moli-project-single` — Maven 模块目录 `moli-server`，**业务名即 moli-admin** |
| 后端地址 | 开发默认 `http://127.0.0.1:8888` |
| 状态管理 | composables，**不用 Pinia** |
| UI 库 | **不用 Element UI**，沿用 `AppModal`、`FormField`、`AppPagination` 等现有组件 |

命名约定：**不要把 moli-admin 和 moli-server 描述成两个产品**（后者只是 Maven 文件夹名）。

## 2. 本地联调前置

### 2.1 后端

1. MySQL 执行 `moli-project-single/sql/migrate_sys_system.sql`
2. `application.yml` 中 `sso.enabled: true`
3. 启动 moli-server，端口 **8888**
4. 测试账号建议用 `superadmin`（可见全部系统、进入后全菜单）

### 2.2 前端

```bash
cd meiling-ui
npm install
# .env.development 或 .env.local
# VITE_USE_MOCK_AUTH=false
npm run dev
```

浏览器访问 `http://127.0.0.1:5173`。

`vite.config.ts` 已代理：`/login`、`/logout`、`/system`、`/sso`、`/menu`、`/user` 等 → `8888`。

### 2.3 无前端时验后端（curl）

```bash
# 登录
curl -s http://127.0.0.1:8888/login \
  -H "Content-Type: application/json" \
  -d '{"userName":"superadmin","password":"你的密码"}'

# 后续请求在 Header 带 token（值为 sessionId）
curl -s http://127.0.0.1:8888/system/my -H "token: <sessionId>"

curl -s http://127.0.0.1:8888/system/enter \
  -H "Content-Type: application/json" -H "token: <sessionId>" \
  -d '{"systemId":1}'

curl -s http://127.0.0.1:8888/menu/getRouters -H "token: <sessionId>"
```

---

## 3. 已完成的前端（勿重复造轮子）

以下文件**已存在**（可能未 commit），扩展时请先阅读：

| 功能 | 路径 |
|------|------|
| 选系统页（按 `systemGroup` 分组） | `src/views/SystemSelectView.vue`、`src/constants/systemGroup.ts` |
| 顶栏系统切换 | `src/components/layout/SystemSwitcher.vue` |
| 门户状态与登录跳转 | `src/composables/useSystemPortal.ts` |
| 登录 | `src/composables/useAuth.ts`、`src/views/LoginView.vue` |
| 路由守卫 | `src/router/index.ts` |
| 用户「分配系统」 | `src/views/system/UserManageView.vue` |
| 按系统/按用户分配 | `src/views/system/SystemUserAssignView.vue`、`src/composables/useSystemUserMatrix.ts` |
| API（门户） | `src/api/system.ts` — `my` / `enter` / `switch` / `list` |
| API（用户系统） | `src/api/user.ts` — `getSystemByUserId` / `insertUserSystem` / `getUserBySystem` / `unauthorizedUsersBySystem` |
| 类型 | `src/types/system.ts`、`src/types/api.ts` |
| Session | `src/utils/authSession.ts` |
| 超管判断 | `src/utils/privilege.ts`（`superadmin`、`admin`） |
| i18n | `src/i18n/locales/zh.ts` 等 — `system.portal.*`、`system.user.assignSystem*` |
| 门户分组规范（后端） | `moli-project-single/docs/portal-system-group.md` |

---

## 3.1 选系统页分组（`systemGroup`）

**前端改造以专用文档为准（先看这篇）：**

👉 **[portal-system-group-ui.md](portal-system-group-ui.md)**

后端字段与枚举说明：`moli-project-single/docs/portal-system-group.md`

---

## 4. 核心业务规则（前后端一致）

### 4.1 超管 vs 普通用户

| | 普通用户 | 超管（`superadmin` / `admin`） |
|--|---------|-------------------------------|
| 是否要先选/进入一个系统 | ✅ | ✅（流程相同） |
| 可见系统 | `insertUserSystem` 分配的 | **全部已注册系统**（含停用） |
| 进入 INTERNAL 后菜单 | 按角色 | **全部菜单** |
| 接口权限 | 按 `perms` | `*:*:*` |

**超管也要选系统**，不能跳过门户；区别是可选范围与进入后权限。

### 4.2 INTERNAL vs EXTERNAL

| ssoMode | 含义 | 进入后前端行为 |
|---------|------|----------------|
| `INTERNAL` | 本项目内打开（如 `moli-admin`） | `enter` 返回 `menuVoList`，留本页加载路由 |
| `EXTERNAL` | 外部独立系统（CRM 等） | `enter` 返回 `redirectUrl?ticket=...`，`window.location` 跳转 |

### 4.3 登录后跳转

- `sso.enabled: false` 或门户降级 → 直接进主页，走 `getRouters`
- **仅 1 个 INTERNAL 系统** → 后端自动 `enter`，带 `currentSystem` + `menuVoList` → 进 `/`
- **多系统** → 无 `currentSystem` → 进 `/system-select`，用户点选后 `POST /system/enter`

---

## 5. 待开发任务

### 任务 A：系统注册管理页（优先，当前缺失）

超管维护 `sys_system` 登记表。后端 CRUD 已有，**前端无管理界面**。

#### 5.1 页面

- 新建 `src/views/system/SystemManageView.vue`
- 风格对齐 `UserManageView.vue`、`DictManageView.vue`

#### 5.2 功能

- 分页列表：系统名称、编码、ssoMode、baseUrl、状态、排序
- 搜索：`systemName`、`systemCode`、`status`
- 新增 / 编辑（`AppModal`）
- 批量删除（`confirm`）

#### 5.3 表单字段（`SysSystem`）

| 字段 | 说明 |
|------|------|
| `systemCode` | 新增必填；编辑只读 |
| `systemName` | 必填 |
| `baseUrl` | EXTERNAL 必填 |
| `ssoMode` | `INTERNAL` \| `EXTERNAL`，下拉 + 说明 |
| `entryPath` | EXTERNAL 可选，默认 `/sso/login` |
| `icon` | 可选 |
| `sort` | 排序 |
| `status` | 1 启用 / 0 停用 |
| `remark` | 备注 |

#### 5.4 权限

- 列表：`GET /system/list` 需 `system:system:list`（菜单 patch：`sql/patch_sys_menu_system_registry.sql`）
- 增删改：同上权限码，且后端要求当前用户为 **超管账号**，否则 `code=10009`
- UI：用 `isCurrentUserSuperAdmin()` 控制新增/编辑/删除按钮；非超管可隐藏菜单入口或只读

#### 5.5 API 补全（`src/api/system.ts`）

```ts
// POST /system        body: SysSystem
// PUT  /system        body: SysSystem（含 id）
// DELETE /system/{ids}  例 /system/1,2,3
```

`listSystemApi` 已存在。

#### 5.6 i18n

在 `zh.ts` / `en.ts` / `ja.ts` 增加 `system.manage.*`（标题、字段、ssoMode 说明、成功/失败提示）。

#### 5.7 菜单路由怎么填（后端 sys_menu / 菜单管理界面）

在 **系统管理 → 菜单管理** 新增，或与 `sql/patch_sys_menu_system_registry.sql` 保持一致：

| 字段 | 填写值 | 说明 |
|------|--------|------|
| 上级菜单 | 系统管理（`parent_id=1`） | 与用户管理同级 |
| 菜单类型 | **C**（菜单） | 不是目录 M |
| 菜单名称 | 系统注册 | |
| **路由地址 `path`** | **`system`** | 短路径；浏览器地址为 **`/system/system`** |
| **组件路径 `component`** | **`system/system/index`** | 对应 `viewRegistry.ts`，**必须带 `/index`** |
| **路由名称 `route_name`** | **`SystemRegistry`** | getRouters 的 `name`；勿与父级目录 `System` 重复 |
| 权限标识 `perms` | **`system:system:list`** | |
| 图标 | `layout-grid` | 可选 |
| 排序 | `11` | 建议放登录日志后 |
| 状态 | 启用 | |

常见错误（会导致 404 或白屏）：

- `path` 写成 `system/system/index` 或 `sysSystem` — 错误
- `component` 写成 `SystemManageView` 或漏掉 `/index` — 错误
- `component` 与 `viewRegistry` 不一致 — 错误

前端已注册：

- 动态：`viewRegistry['system/system/index']` → `SystemManageView.vue`
- 静态兜底：`staticRoutes` 中 `path: 'system/system'`，`name: 'SystemRegistry'`（与 getRouters 的 `name` 一致）

执行顺序：`patch_sys_menu_route_name.sql` → `patch_sys_menu_system_registry.sql`。保存菜单后 **重新登录** 拉取 `getRouters`。

菜单管理界面已支持 **路由名称** 字段（`routeName`）；留空时后端按 component 自动生成（`system/system/index` → `SystemRegistry`）。

#### 5.8 验收

- [ ] 超管可 CRUD 系统登记
- [ ] EXTERNAL 未填 `baseUrl` 时有表单校验
- [ ] `npm run build` 通过

---

### 任务 B：SSO 门户联调修补

在任务 A 之外，验证并修复（不破坏已有逻辑）：

#### B.1 登录响应类型

`src/types/api.ts` 的 `LoginVo` 补充：

```ts
fullPermission?: boolean  // 后端已返回，超管为 true
permissions?: string[]    // P1 动作权限：门户关 / 单系统自动进时随登录下发（见任务 C）
```

`SystemEnterVo`（enter/switch 响应）同步：

```ts
permissions?: string[]
fullPermission?: boolean
```

#### B.2 登录 → 选系统 → 主页

1. `useAuth.login` → `useSystemPortal.handlePostLogin`
2. 多系统无 `currentSystem` → `/system-select`
3. 选 INTERNAL → `loadDynamicRoutesFromMenus`
4. 选 EXTERNAL → 外链跳转

#### B.3 路由守卫（`router/index.ts`）

- 门户开启且未选系统 → **一律** 重定向 `/system-select`（含超管）
- **不要**用超管跳过菜单路径校验；超管应在 `enter` 后拿到全量 `menuVoList`

#### B.4 顶栏 `SystemSwitcher`

- `POST /system/switch`，INTERNAL 刷新菜单，EXTERNAL 跳转

#### B.5 用户管理「分配系统」

- 目标用户为超管：勾选只读 + 文案 `system.user.assignSystemSuperAdminHint`（已有则确认）

---

### 任务 C：动作权限与 permissions 缓存（P1，后端规范先行）

> 完整设计：`moli-project-single/docs/action-permission-design.md` §5.5、§6.6。  
> 与 SSO 门户的关系：多系统显式 enter 走 `SystemEnterVo`；**门户关闭**与**单 INTERNAL 自动进**不走前端 enter，须从 **`LoginVo.permissions`** 写入缓存。

#### C.1 缓存模块 `usePermissions`

- `permissions: string[]`、`fullPermission: boolean`
- `savePermissions(perms, full)` — enter/switch/**登录**成功后覆盖写入
- `ensurePermissionsLoaded()` — 缓存空且已进业务页时调 `GET /auth/capabilities`（兜底）
- `refreshPermissions()` — P2 角色变更后显式刷新

**禁止** `handlePostLogin` / `enterSystem` 与 capabilities **并行**请求后「谁后返回谁写入」。

#### C.2 `handlePostLogin`（`useSystemPortal.ts`）

| 登录结果 | 动作 |
|----------|------|
| `loginData.permissions` 存在或 `fullPermission === true` | `savePermissions(...)`，**不调** capabilities |
| 已进业务页（门户关 / 有 `currentSystem`）但无 permissions | `await ensurePermissionsLoaded()` |
| 多系统无 `currentSystem` | 不写 permissions，等 `/system-select` → enter |

#### C.3 `enterSystem` / `switchToSystem`

响应含 `permissions` → `savePermissions`；否则 `ensurePermissionsLoaded()`。

#### C.4 路由守卫 / F5

Session 有效、内存 permissions 空 → `ensurePermissionsLoaded()`（不重复 enter）。

#### C.5 按钮预检与 10009

- `assertAction(code)`：常显按钮，点击预检（§6.1–6.2）
- Axios：`code === 10009` 且 Shiro 通用文案 → Toast「无权限操作」；业务细分 msg 原样展示

#### C.6 验收

- [ ] 门户关闭登录后 `permissions` 非空（或 capabilities 兜底一次）
- [ ] 单系统自动进登录后 `permissions` 非空
- [ ] 多系统选系统 enter 后 `permissions` 非空
- [ ] F5 后 capabilities 补拉成功
- [ ] 切换系统后 permissions 更新

## 6. 后端接口速查（moli-server）

### 6.1 门户（已实现）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/login` | 返回 `token`、`user`、`systemPortalEnabled`、`systemList`、`currentSystem?`、`menuVoList?`、`fullPermission?`；**P1** 增 `permissions?` |
| GET | `/system/my` | 当前用户可访问系统 |
| POST | `/system/enter` | body: `{ systemId }`；**P1** 响应增 `permissions`、`fullPermission` |
| POST | `/system/switch` | 同 enter |
| GET | `/auth/capabilities` | **P1** 补拉 permissions（F5 / 缓存缺失） |

### 6.2 系统注册管理（已实现）

| 方法 | 路径 | 权限 |
|------|------|------|
| GET | `/system/list` | `system:system:list`，分页查询参数同 `SysSystem` |
| POST | `/system` | `system:system:list` + 超管 |
| PUT | `/system` | `system:system:list` + 超管 |
| DELETE | `/system/{ids}` | `system:system:list` + 超管，ids 逗号分隔；不可删 `moli-admin` |

返回格式统一 `MoliResult<T>`，成功 `code: 200`；无权限 `code: 10009`。

### 6.3 用户系统分配（已实现）

| 方法 | 路径 |
|------|------|
| GET | `/user/getSystemByUserId/{userId}` |
| PUT | `/user/insertUserSystem` |

### 6.4 SSO Ticket（外部系统用）

| 方法 | 路径 |
|------|------|
| POST | `/sso/validate` | 匿名；可带 `X-Sso-Secret`；响应含 `fullPermission` |

---

## 7. 类型参考

### SysSystem（`src/types/system.ts`，已存在，可扩展）

```ts
{
  id?, systemCode?, systemName?, baseUrl?, icon?, sort?,
  status?,  // 1 启用 0 停用
  ssoMode?, // INTERNAL | EXTERNAL
  entryPath?, remark?,
  pageNum?, pageSize?
}
```

### SystemEnterVo

```ts
{
  currentSystem: SystemVo
  menuVoList?: MenuVo[]      // INTERNAL
  redirectUrl?: string       // EXTERNAL
  hubToken?: string
  permissions?: string[]     // P1
  fullPermission?: boolean   // P1
}
```

### LoginVo（P1 与 SystemEnterVo 对齐）

```ts
{
  token: string
  user: SysUser
  systemPortalEnabled?: boolean
  systemList?: SystemVo[]
  currentSystem?: SystemVo | null
  menuVoList?: MenuVo[]
  fullPermission?: boolean
  permissions?: string[]     // 门户关 / 单系统自动进时下发
}
```

---

## 8. 开发约束

- 最小改动，匹配现有 composables / API / i18n 风格
- 不引入 Element UI、Pinia
- 改完执行 `npm run build`
- 非用户要求不提交 git
- API 行为变更时同步后端 `moli-project-single/docs/api-iteration-map.md`（在后端仓库改）

---

## 9. 交付清单

- [ ] `SystemManageView.vue` 超管 CRUD
- [ ] `api/system.ts` 增删改 API
- [ ] i18n zh / en / ja
- [ ] `LoginVo.fullPermission` 类型补齐
- [ ] **P1** `LoginVo.permissions` / `SystemEnterVo.permissions` + `usePermissions` + `handlePostLogin` 写入（任务 C）
- [ ] 登录 → 选系统 → 主页 → 切换系统 联调通过
- [ ] `npm run build` 通过

---

## 10. 相关文档

| 文档 | 位置 |
|------|------|
| 动作权限设计 | `moli-project-single/docs/action-permission-design.md` |
| 多系统 SSO 设计 | `moli-project-single/docs/multi-system-sso-design.md` |
| 外部系统接入 | `moli-project-single/docs/subsystem-sso-integration.md` |
| 接口地图 | `moli-project-single/docs/api-iteration-map.md` |
| 库表迁移 | `moli-project-single/sql/migrate_sys_system.sql` |
