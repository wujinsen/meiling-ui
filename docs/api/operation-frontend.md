# 服务器运维 · 运营管理 · 前端对接说明（meiling-ui）

> **读者**：meiling-ui 前端（菜单「运营管理」· 驾驶舱 ops 页）。  
> **技术规划**：[server-ops-module-roadmap.md](../design/server-ops-module-roadmap.md)  
> **HTTP 契约索引**：[user-center-api-map.md](user-center-api-map.md) §4（接口路径与权限以该节为准）  
> **端口矩阵权威**：[`moli-project-distribute` production-checklist §2](../../moli-project-distribute/docs/ops/production-checklist.md)  
> **边界**：本文档是 **user-center `operation_*` 基础设施台账**；**不是**知识库内容管道运维（见 [knowledge-ops-frontend.md](knowledge-ops-frontend.md)）。

---

## 0. meiling-ui 代码落点（2026-07-11）

| 任务 | 页面 / 组件 | API / 工具 | 状态 |
|------|-------------|------------|------|
| **S0** 凭据 | `PlatformManageView` · `ComponentManageView` · `SecretManageModal` | `revealPlatformSecretApi` · `revealComponentSecretApi` | ✅ |
| **S1** 探测 | `ServerManageView` · `ComponentManageView` · `HealthStatusBadge` | `checkServerApi` · `checkComponentApi` · `operationHealth.ts` | ✅ |
| **S2** 拓扑 | `ServerManageView` 拓扑弹窗 | `getServerTopologyApi` | ✅ |
| **S3** 端口 | `PortAuditModal` · `PortMatchBadge` | `getPortAuditApi` · `operationPort.ts` | ✅ |
| **S4** 部署 | `ProjectManageView` 进程状态弹窗 | `getDeployStatusApi(serverId)` · `execDeployApi` · `resolveDeployServiceKey()` | ✅ |
| **S5** 驾驶舱 | `CandlelightDragon/cockpit/index` · `useCockpit` | `getOperationStatsApi`（`cockpit.ts`） | ✅ |
| **S5-4** envBreakdown | `CockpitOpsEnvChart` | ops 页环境分布饼图 · 点击钻取 | ✅ |
| **S6** 部署中心 | `DeployCenterView` · `DeployServerPicker` · `DeployTaskDrawer` | `getDeployPresetsApi` · `createDeployTaskApi` · `uploadFileApi` | ✅ |
| **S7** 批量探活 | `ServerManageView` · 驾驶舱 ops | `probeAllHealthApi` → `taskId` · `useProbeAllHealth` · `useOperationTaskPoll` | ✅ |
| **S9** 动态 serviceKey | `DeployCenterView` | `getDeployPresetsApi().serviceKeys`（回退 `MOLI_DEPLOY_SERVICES`） | ✅ |
| **S6-b** 多选服务器 | `ProjectManageView` · `ComponentManageView` · `OperationServerMultiSelect` | 提交 `serverIds`（首项主服务器）；`GET/PUT .../project|component/{id}/links` | ✅ |
| **S10** serverId 表单 | `ProjectManageView` · `ComponentManageView` · `OperationServerMultiSelect` | 多选 `serverIds` + 主 `serverId`；IP 由台账对齐 | ✅ |
| **S11** orphan 标记 | `OperationOrphanBadge` · `operationOrphan.ts` · `operationServerLinks.ts` | 无关联服务器时徽章 + 行底色（含 `serverIds` 为空） | ✅ |
| **S12** 端口矩阵 | `PortMatrixManageView` · `OperationPortMatrixAliasInput` | CRUD + 审计弹窗「管理端口矩阵」 | ✅ |
| **S13** 任务历史 | `TaskHistoryView` · `OperationTaskStatusBadge` | `listTaskApi` 分页 + 日志抽屉 + 部署中心入口 | ✅ |
| 公共 | `EnvironmentSelect` · `OperationPageHeader` · `AppSelect` | `src/types/operation.ts` · `src/api/operation.ts` · `operationErrors.ts` | ✅ |

权限常量：`src/constants/permissions.ts` → `PERM.OP_*` · `OP_SECRET_VIEW` · `OP_DEPLOY_EXEC` · `OP_FILE_UPLOAD` · `OP_COMMAND_EXEC`。

---

## 1. 开发优先级（给前端排期）

| 优先级 | 模块 | meiling-ui 路由（建议） | 后端 | 前端任务 ID |
|--------|------|-------------------------|------|-------------|
| **P0** | 凭据安全 | `operation/platform/index`、`operation/component/index` | ✅ SVR-1/2/3 | **S0** 密码掩码 + 明文 reveal |
| **P1** | 健康探测 | `operation/server/index`、`operation/component/index` | ✅ SVR-4 | **S1** 状态灯 + 行内探测 |
| **P1** | 服务器拓扑 | `operation/server/index` | ✅ SVR-5/6 | **S2** 拓扑弹窗 |
| **P2** | 端口矩阵校验 | `operation/project/index`、`operation/component/index` | ✅ SVR-7 | **S3** 端口校验弹窗 + 组件列 badge |
| **P2** | 部署进程状态 | `operation/project/index` | ✅ SVR-8 | **S4** 进程状态（只读） |
| **P2** | 驾驶舱 ops KPI | `CandlelightDragon/cockpit/index`（tab=ops） | ✅ SVR-9 | **S5** 合并 `/operation/stats` |

**建议迭代顺序**：**S0 → S1/S2 → S3 → S4 → S5**

**网关 / 联调前缀**：

| 环境 | 请求前缀 |
|------|----------|
| 本地 dev（meiling-ui vite proxy） | `/operation/*` → user-center `http://127.0.0.1:8888` |
| 经网关（若统一入口） | `{gateway}/UserCenterServer/operation/*`（以 distribute [gateway-routes.md](../../moli-project-distribute/docs/api/gateway-routes.md) 为准） |

**统一响应**：`MoliResult<T>` → `{ code: 200, data: T, msg?: string }`；分页 `data` 为 `PageRes<T>` → `{ list, total, pageNum, pageSize }`。

---

## 2. 菜单 ↔ 路由 ↔ 权限

父菜单 **运营管理**（`sys_menu.id = 400`）。

| 页面 | 菜单 component | 列表权限（C 菜单 perms） | 写操作额外权限 |
|------|----------------|--------------------------|----------------|
| 项目管理 | `operation/project/index` | `operation:project:list` | `add` / `edit` / `remove` + **list** |
| 服务器管理 | `operation/server/index` | `operation:server:list` | 同上 |
| 平台管理 | `operation/platform/index` | `operation:platform:list` | 同上 |
| 组件管理 | `operation/component/index` | `operation:component:list` | 同上 |
| 任务历史 | `operation/task/index` | `operation:server:list` | 只读列表 + 日志抽屉（与部署中心同权） |
| 端口矩阵 | `operation/port-matrix/index` | `operation:port-matrix:list` | `add` / `edit` / `remove` + **list** |

**跨域权限**（非菜单 perms，需角色 `sys_action` 绑定）：

| perm | 用途 |
|------|------|
| `operation:secret:view` | `GET .../secret` 查看平台/组件密码明文 |
| `operation:secret:edit` | 列表行「密码管理」；`PUT` 携带 `password` 修改凭据 |
| `operation:deploy:exec` | `POST /operation/deploy/{key}/{action}` 执行 start/stop/restart |

> **角色授权 UI**：上述两项挂在父菜单 **运营管理（id=400）**；勾选其下任一子页面后，右侧会出现 **「运营管理 · 模块通用」** 标签，在此勾选（非平台管理 3 个 CRUD 按钮里）。

迁移脚本（已有库需执行）：[`17_operation_secret_view.sql`](../../moli-project-distribute/docs/sql/17_operation_secret_view.sql)、[`18_operation_health_columns.sql`](../../moli-project-distribute/docs/sql/18_operation_health_columns.sql)、[`19_operation_deploy_exec.sql`](../../moli-project-distribute/docs/sql/19_operation_deploy_exec.sql)、[`20_operation_secret_edit.sql`](../sql/20_operation_secret_edit.sql)。

---

## 3. 枚举与字段约定

### 3.1 环境 `environment`

| 值 | 含义 | i18n |
|----|------|------|
| `1` | dev | `operation.env.dev` |
| `2` | test | `operation.env.test` |
| `3` | pre | `operation.env.pre` |
| `4` | pro | `operation.env.pro` |

列表筛选：query 传 `environment`；空或不传表示全部。工具：`src/utils/operationEnv.ts`。

### 3.2 健康状态 `status`（服务器 / 组件）

| 值 | 含义 | UI 建议 |
|----|------|---------|
| `0` | 未知（未探测） | 灰色 |
| `1` | 可达（TCP 连通） | 绿色 |
| `2` | 不可达 | 红色 |
| `3` | 跳过（缺 IP 或端口） | 琥珀色 |

探测接口会**写库**并返回更新后的 VO：`POST /operation/server/{id}/check`、`POST /operation/component/{id}/check`。常量见 `src/utils/operationHealth.ts`。

### 3.3 端口校验 `portMatchStatus`（组件列表 VO）

| 值 | 含义 | UI 建议 |
|----|------|---------|
| `0` | 未映射（名称不在端口矩阵） | 灰色 |
| `1` | 与矩阵一致 | 绿色 |
| `2` | 与矩阵不符 | 红色，可展示 `expectedPort` |
| `3` | 跳过（台账端口为空或 `-`） | 琥珀色 |

矩阵服务名与期望端口见 [§7](#7-端口矩阵对照表)。常量见 `src/utils/operationPort.ts` · 展示 `PortMatchBadge`。

**`expectedPort` 来源**：后端端口矩阵（如 `moli-server` → 期望 `8888`），**非前端写死**；前端仅展示接口返回的 `expectedPort`。

### 3.4 运维错误码 `10101`–`10109`

| code | 常量 | 典型场景 | 前端 |
|------|------|----------|------|
| `10101` | SSH 未配置 | 远程操作前未配 SSH | `operation.errors.10101` |
| `10102` | SSH 连接失败 | 网络/凭据错误 | `operation.errors.10102` |
| `10103` | 部署脚本不可用 | 本机无 `moli-service.sh` | `operation.errors.10103` |
| `10104` | 上传路径拒绝 | 不在白名单 | `operation.errors.10104` |
| `10105` | 任务不存在 | 任务 ID 无效 | `operation.errors.10105` |
| `10106` | 服务器不存在 | ID 无效 | `operation.errors.10106` |
| `10107` | 服务器任务进行中 | 单台 `check` 与批量探活/部署互斥 | Toast + 若有 `data=taskId` 打开 `DeployTaskDrawer` |
| `10108` | 命令权限不足 | 无 `operation:command:exec` | `operation.errors.10108` |
| `10109` | 本机部署未启用 | `ops.deploy.enabled=false` | `operation.errors.10109` |

映射：`src/constants/operationErrors.ts` · `operationErrorI18nKey()`。

### 3.5 密码字段（平台 / 组件）

| 场景 | 行为 |
|------|------|
| `GET list` / `GET {id}` | **永不**返回 `password` 明文；返回 `passwordConfigured`、`passwordMask` |
| `POST` / `PUT` | 请求体可带 `password`；**留空表示保留原密码**（仅更新场景） |
| `GET {id}/secret` | 需 `operation:secret:view`；返回 `{ password: string }`；记审计日志 |

---

## 4. P0 · 凭据安全（S0）

### 4.1 涉及页面

- `src/views/operation/PlatformManageView.vue`
- `src/views/operation/ComponentManageView.vue`
- `src/components/operation/SecretManageModal.vue`

### 4.2 API

```http
GET  /operation/platform/list
GET  /operation/platform/{id}
GET  /operation/platform/{id}/secret     # operation:secret:view
POST /operation/platform
PUT  /operation/platform

GET  /operation/component/list
GET  /operation/component/{id}
GET  /operation/component/{id}/secret      # operation:secret:view
POST /operation/component
PUT  /operation/component
```

### 4.3 UI 要点

| ID | 要求 |
|----|------|
| **S0-1** | 列表/表单展示 `passwordMask` 或「未配置」；不展示历史明文 |
| **S0-2** | 编辑时独立密码输入框；hint：留空保存 = 保留原密码 |
| **S0-3** | 列表行「密码管理」需 `operation:secret:edit`（或兼容 `platform:edit` / `component:edit`）；弹窗内查看明文需 `operation:secret:view` |
| **S0-4** | 无 reveal 权限时隐藏按钮，勿静默调 secret 接口 |

### 4.4 TypeScript（`src/types/operation.ts`）

```typescript
export type OperationPlatform = {
  id?: number | string
  platformName?: string
  url?: string
  account?: string
  password?: string              // 仅 POST/PUT 提交
  passwordConfigured?: boolean
  passwordMask?: string | null
  environment?: 1 | 2 | 3 | 4
  remark?: string
  createTime?: string | number
}

export type OperationSecretReveal = { password?: string }
```

---

## 5. P1 · 健康探测与拓扑（S1 / S2）

### 5.1 服务器列表 + 探测（S1）

```http
GET  /operation/server/list?pageNum=1&pageSize=10&serverName=&ip=&environment=
POST /operation/server/{id}/check
```

**`OperationServer` 增量字段**：

```typescript
export type OperationServer = {
  // ...serverName, ip, innerIp, port, environment, remark
  status?: 0 | 1 | 2 | 3 | null
  lastCheckTime?: string | number | null
}
```

| ID | UI |
|----|-----|
| **S1-1** | 列表增加「健康状态」列（`HealthStatusBadge` + 可选 `lastCheckTime`） |
| **S1-2** | 行操作「探测」→ `checkServerApi`；成功后就地更新该行 `status` / `lastCheckTime` |

### 5.2 组件列表 + 探测（S1）

```http
GET  /operation/component/list?...
POST /operation/component/{id}/check
```

`OperationComponent` 同样含 `status`、`lastCheckTime`（另含 §3.3 端口字段）。

### 5.3 服务器拓扑（S2）

```http
GET /operation/server/{id}/topology
```

**响应 `OperationServerTopology`**：

```typescript
export type OperationServerTopology = {
  server?: OperationServer
  projects?: OperationTopologyProject[]
  components?: OperationTopologyComponent[]
}
```

| ID | UI |
|----|-----|
| **S2-1** | 服务器行操作「拓扑」→ 弹窗展示 `server` 摘要 + 关联 `projects` / `components` 列表 |
| **S2-2** | 拓扑内组件行可带 `HealthStatusBadge`（与列表一致） |

**种子数据 smoke**：`GET /operation/server/201/topology` 应含项目 401/406、组件 306/307/304（以库内 seed 为准）。

---

## 6. P2 · 端口校验 / 部署状态 / 驾驶舱（S3 / S4 / S5）

### 6.1 端口矩阵校验（S3）

```http
GET /operation/audit/port-matrix
```

权限：`operation:project:list`（与项目管理列表相同）。

**响应 `OperationPortAudit`**：

```typescript
export type OperationPortAudit = {
  total?: number
  matched?: number
  mismatched?: number
  unmapped?: number
  skipped?: number
  matrix?: { key?: string; expectedPort?: string; source?: string }[]
  items?: OperationPortAuditItem[]
}
```

| ID | UI |
|----|-----|
| **S3-1** | 项目/组件页工具栏「端口校验」→ `PortAuditModal`：顶部汇总 + 矩阵表 + 明细表 |
| **S3-2** | 组件列表行内 `portMatchStatus` / `expectedPort`（`GET list` 已 enrichment） |
| **S3-3** | `portMatchStatus === 2` 高亮；项目列表暂无行内字段，以弹窗为准 |

### 6.2 部署进程状态（S4）

```http
GET  /operation/deploy/{serviceKey}/status?serverId={id}
POST /operation/deploy/{serviceKey}/{action}?serverId={id}
```

**`serviceKey`**：默认白名单 `user-center` | `gateway` | `knowledge`；部署中心从 `getDeployPresetsApi().serviceKeys` 动态渲染（S9）。

**`serverId`（Breaking）**：项目行「进程状态」必须传台账 `project.serverId`；无 `serverId` 时按钮禁用并提示 `operation.project.deployNeedsServerId`。

**项目名 → serviceKey 映射（`src/utils/operationPort.ts` · `resolveDeployServiceKey`）**：

| 台账 `projectName`（不区分大小写） | serviceKey |
|-----------------------------------|------------|
| `user-center`、`moli-user-center`、`user-center-server`、`moli-server` | `user-center` |
| `gateway`、`moli-gateway` | `gateway` |
| `knowledge`、`moli-knowledge`、`knowledge-server` | `knowledge` |

**响应 `OperationDeployStatus`**：

```typescript
export type OperationDeployStatus = {
  serviceKey?: string
  action?: string
  available?: boolean      // 脚本是否可调用
  running?: boolean        // 解析输出推断是否运行中
  output?: string          // 脚本 stdout
  message?: string
}
```

| ID | UI |
|----|-----|
| **S4-1** | 可映射的项目行显示「进程状态」；`getDeployStatusApi(key, row.serverId)` |
| **S4-2** | `available === false` 时展示 `message`（Windows 开发机 / 脚本不存在等） |
| **S4-3** | 进程状态弹窗内 **启动 / 停止 / 重启**（`execDeployApi` + `serverId`）；需 `operation:deploy:exec` |

### 6.3 批量探活异步任务（S7）

```http
POST /operation/health/probe-all    # 返回 data = taskId（number），非同步统计
GET  /operation/task/{id}           # 轮询进度与增量日志
```

| ID | UI |
|----|-----|
| **S7-1** | `ServerManageView` / 驾驶舱 ops「批量探活」→ `useProbeAllHealth` 创建任务并打开 `DeployTaskDrawer` |
| **S7-2** | 任务完成后自动刷新列表 / 驾驶舱 stats；Toast：`probeAllStarted` → `probeAllFinished` |
| **S7-3** | 单台 `POST .../check` 若返回 `10107` 且 `data=taskId`，提示并打开同一任务抽屉 |

### 6.4 部署中心（S6 / S9）

```http
GET  /operation/deploy/presets?serverId={id}   # pathPresets · actionPresets · serviceKeys
POST /operation/deploy/{key}/{action}/task?serverId={id}
POST /operation/file/upload
POST /operation/command/exec/task
```

| ID | UI |
|----|-----|
| **S6-1** | `DeployServerPicker`：搜索 / 环境筛选 / 分页（百台级服务器） |
| **S6-2** | 文件发布：`app-upload-dropzone` + 任务抽屉 |
| **S9-1** | moli 服务卡片按 `presets.serviceKeys` 渲染，无则回退 `MOLI_DEPLOY_SERVICES` |

### 6.5 驾驶舱 ops KPI（S5）

```http
GET /operation/stats
```

权限：`operation:project:list`。

**响应 `OperationStats`**：

```typescript
export type OperationStats = {
  projects?: number
  servers?: number
  platforms?: number
  components?: number
  portMismatches?: number
  healthDown?: number
  envBreakdown?: { env: 1 | 2 | 3 | 4; count: number }[]
}
```

| ID | UI |
|----|-----|
| **S5-1** | 驾驶舱 `tab=ops` 时请求 `getOperationStatsApi`，用真实计数覆盖 Mock KPI |
| **S5-2** | 映射：`projects/servers/components/platforms` → 对应 KPI 卡片；点击跳转 `/operation/*` |
| **S5-3** | `portMismatches + healthDown` 可合并展示为「告警」类 KPI |
| **S5-4** | ops 页 `CockpitOpsEnvChart` 展示 `envBreakdown` 环境分布饼图 |

---

## 7. 端口矩阵对照表

> **SVR-21 后**：运行时权威改为 DB + 运维台「端口矩阵」菜单（`operation/port-matrix/index`）。下表为**初始种子**；改端口请在管理页维护，无需发版。设计：[`operation-port-matrix-config.md`](../../moli-project-distribute/docs/design/operation-port-matrix-config.md)。

权威来源：distribute [production-checklist.md §2](../../moli-project-distribute/docs/ops/production-checklist.md) + 表 `operation_port_matrix`。

| matrixKey | 期望端口 | 匹配别名（名称归一化后） |
|-----------|----------|--------------------------|
| gateway | 21000 | gateway, moli-gateway |
| user-center | 8888 | user-center, moli-user-center, user-center-server, **moli-server** |
| order | 8087 | order, moli-order |
| knowledge | 8090 | knowledge, moli-knowledge, knowledge-server |
| bi | 1128 | bi, moli-bi |
| nacos | 8848 | nacos |
| mysql | 3306 | mysql |
| redis | 6379 | redis |

**预期 demo**：种子中 `moli-server` 端口 `9080` → 审计为 **不符**（期望 8888）；`MySQL:3306` → **一致**。

---

## 8. 建议 API 模块（`src/api/operation.ts`）

当前实现已包含 CRUD + 扩展接口，核心片段：

```typescript
import { request } from '@/api/http'
import type { PageRes } from '@/types/page'
import type {
  OperationComponent,
  OperationPlatform,
  OperationProject,
  OperationServer,
  OperationServerTopology,
  OperationPortAudit,
  OperationStats,
  OperationDeployStatus,
  OperationSecretReveal,
} from '@/types/operation'

// CRUD：/operation/project|server|platform|component — list|get|add|update|remove

export const checkServerApi = (id: number | string) =>
  request<OperationServer | number>(`/operation/server/${id}/check`, { method: 'POST' })

export const probeAllHealthApi = () =>
  request<number>('/operation/health/probe-all', { method: 'POST', timeoutMs: 15_000 })

export const getDeployStatusApi = (serviceKey: string, serverId?: number | string | null) => {
  const qs = serverId != null && serverId !== '' ? `?serverId=${serverId}` : ''
  return request<OperationDeployStatus>(`/operation/deploy/${serviceKey}/status${qs}`, { method: 'GET', timeoutMs: 30_000 })
}

export const getDeployPresetsApi = (serverId?: number | string | null) => {
  const qs = serverId != null && serverId !== '' ? `?serverId=${serverId}` : ''
  return request<OperationDeployPresets>(`/operation/deploy/presets${qs}`, { method: 'GET' })
}

// OperationDeployPresets.serviceKeys?: string[]  — 部署中心动态服务列表（S9）
```

---

## 9. 联调 checklist

| 步骤 | 检查 |
|------|------|
| 1 | user-center 启动（`:8888`），`OPS_SECRET_KEY` 已配置（P0 加密） |
| 2 | DB 已执行 `17_*`、`18_*`；需要部署按钮权限时执行 `19_*` |
| 3 | meiling-ui proxy `/operation` → `8888`；`VITE_USE_MOCK_AUTH=false`；登录角色含 `operation:*:list` |
| 4 | 平台/组件：列表只见 mask；reveal 需 `operation:secret:view` |
| 5 | 服务器/组件：探测后 `status` / `lastCheckTime` 更新 |
| 6 | 服务器 id=201：拓扑含关联项目与组件 |
| 7 | 端口校验：`mismatched >= 1`（种子 moli-server 9080） |
| 8 | 驾驶舱 ops：`/operation/stats` 计数与库内台账一致 |
| 9 | 批量探活：返回 `taskId`，抽屉轮询至 `finished`，列表自动刷新 |
| 10 | 项目进程状态：有 `serverId` 的项目可查询；部署中心 `serviceKeys` 与 presets 一致 |

---

## 10. 验收总表

| ID | 场景 | 通过标准 |
|----|------|----------|
| S0 | 密码 | 列表无明文；reveal 受权限控制；空密码更新保留原值 |
| S1 | 探测 | 行内探测更新状态灯；失败 Toast |
| S2 | 拓扑 | 弹窗展示 projects + components；空列表友好提示 |
| S3 | 端口 | 弹窗汇总与明细正确；组件/项目列 badge 展示 `expectedPort`（后端矩阵） |
| S4 | 部署 | `getDeployStatusApi` 带 `serverId`；无 serverId 禁用按钮 |
| S5 | 驾驶舱 | ops KPI 使用真实 stats，非纯 Mock |
| S6 | 部署中心 | 服务器分页选择；上传/命令/启停走任务抽屉 |
| S7 | 批量探活 | 异步 taskId + 轮询；完成后刷新 |
| S9 | serviceKeys | 部署中心服务列表来自 presets，非仅前端常量 |
| S10 | 多选服务器 | 项目/组件弹窗 `OperationServerMultiSelect`；提交 `serverIds` + 主 `serverId` |
| S11 | orphan 标记 | 无 `serverIds` 且无 `serverId` 时琥珀色徽章 + 行底色；列表 `+N` 显示额外关联数 |
| S12 | 端口矩阵管理 | `PortMatrixManageView` · CRUD `/operation/port-matrix/*`；审计弹窗跳转 |
| S13 | 任务历史 | `TaskHistoryView` · `GET /operation/task/list`；筛选 + 日志抽屉 |

---

## 14. 端口矩阵管理页（SVR-21d）

> **后端契约**：[operation-port-matrix-api.md](operation-port-matrix-api.md) · **方案**：[operation-port-matrix-config.md](../../moli-project-distribute/docs/design/operation-port-matrix-config.md)

| 项 | 值 |
|----|-----|
| 菜单 id | 406（父 400） |
| 路由 | `operation/port-matrix/index` → `/operation/port-matrix` |
| 列表权限 | `operation:port-matrix:list` |
| 写权限 | `add` / `edit` / `remove` + **list** |

### 14.1 页面能力

| 功能 | 实现 |
|------|------|
| 分页列表 | `PortMatrixManageView` · `GET /operation/port-matrix/list` |
| 新增/编辑弹窗 | `POST` / `PUT` · `OperationPortMatrixAliasInput` 别名 Tag |
| 删除 | `DELETE /operation/port-matrix/{ids}` |
| 端口校验 | 工具栏「端口校验」→ `PortAuditModal`（`operation:project:list`） |
| 未执行 SQL 种子时 | `operationSupplementRoutes.ts` 补菜单 406 + 路由 `port-matrix` / `task` |
| matrixKey 校验 | `operationPortMatrix.ts` 归一化 + `^[a-z][a-z0-9-]*$` |

保存成功后**无需重启** user-center；可立即打开端口校验验证 `portMatchStatus` 变化。

### 14.2 与 S3 审计弹窗联动

项目/组件管理页 `PortAuditModal` 底部「管理端口矩阵」→ `/operation/port-matrix`（需 `operation:port-matrix:list`）。审计 API 权限与矩阵 CRUD 权限分离。

---

## 15. 项目/组件多选服务器（S6-b / SVR-22d）

| 项 | 说明 |
|----|------|
| 表单组件 | `OperationServerMultiSelect`（摘要 +「管理关联服务器」）→ `OperationServerLinksModal`（分页搜索多选） |
| 提交字段 | `serverIds: string[]` + 主 `serverId`（`serverIds[0]`） |
| 列表展示 | 主服务器 IP + `+N` 徽章（额外关联数）；无关联时 orphan 行样式 |
| 独立 links API | `GET/PUT /operation/project/{id}/links` · `GET/PUT /operation/component/{id}/links` |
| 工具 | `src/utils/operationServerLinks.ts` |

保存项目/组件时后端 `create`/`update` 会同步 N:N 关联表；前端在弹窗提交 `serverIds` 即可，无需单独调 links API。

---

## 11. 相关

- 后端路线图：[server-ops-module-roadmap.md](../design/server-ops-module-roadmap.md)
- **端口矩阵 HTTP 契约（SVR-21）**：[operation-port-matrix-api.md](operation-port-matrix-api.md)
- API 全量列表：[user-center-api-map.md](user-center-api-map.md) §4
- 部署脚本：`moli-project-distribute/deploy/linux/moli-service.sh`（S4 服务端调用）
- 知识库运维（另一条线）：[knowledge-ops-frontend.md](knowledge-ops-frontend.md)
