# 用户中心 HTTP API 地图（meiling-ui · 运维域摘要）

> **全量 ~70 接口**见 [`moli-project-distribute/docs/api/user-center-api-map.md`](../../moli-project-distribute/docs/api/user-center-api-map.md)（登录、RBAC、字典、日志等）。  
> **前端对接专稿**：[operation-frontend.md](operation-frontend.md)（排期 S0–S9、枚举、UI 要点、验收表）。  
> 本文 **§4** 为 meiling-ui 运营管理页联调的 HTTP 权威索引。

---

## 4. 运维域接口

> **前端对接专稿**：[operation-frontend.md](operation-frontend.md)（枚举、TypeScript、验收 S0–S5）

### 平台管理 `OperationPlatformController`（前缀 `/operation/platform`，6个）

- `GET /operation/platform/list`：`operation:platform:list`；返回 `OperationPlatformVo`（含 `passwordConfigured` / `passwordMask`，无明文）
- `POST`：`operation:platform:add` + `list`；`PUT`：`edit` + `list`；`DELETE`：`remove` + `list`
- `GET /operation/platform/{id}`：`operation:platform:list`；返回 VO
- `GET /operation/platform/{id}/secret`：`operation:secret:view`；返回 `{ password }` 明文（记审计日志）

### 服务器管理 `OperationServerController`（前缀 `/operation/server`，6个）

- `GET /operation/server/list`：`operation:server:list`；返回 `OperationServerVo`（含 `status` / `lastCheckTime`）
- `POST /operation/server`：`operation:server:add` + `list`
- `PUT /operation/server`：`operation:server:edit` + `list`
- `GET /operation/server/{id}`：`operation:server:list`
- `DELETE /operation/server/{ids}`：`operation:server:remove` + `list`
- ~~`GET /operation/server/{id}/topology`~~：**已删除**（2026-07）→ 改用 `GET /operation/relations/server/{id}`
- `POST /operation/server/{id}/check`：`operation:server:list`；TCP 探活（异步任务化时可能返回 `code=10107` + `data=taskId`）
- `POST /operation/health/probe-all`：`operation:server:list`；**返回 `data=taskId`**，非同步 `{ serversProbed, ... }`

### 关联导航 `OperationRelationsController`（前缀 `/operation/relations`）

- `GET /operation/relations/{type}/{id}`：`operation:server:list`（或对应实体 list 权限）；`type` = `server` | `project` | `component`；返回 `OperationRelationsVo`（entity + servers/projects/components + recentTasks）

### 全局拓扑图

- `GET /operation/topology`：`operation:server:list`；返回 `OperationTopologyGraphVo`（ECharts 全图 nodes + links，**非**单机 relations）

### 项目管理 `OperationProjectController`（前缀 `/operation/project`，5个）

- `GET /operation/project/list`：`operation:project:list`
- `POST /operation/project`：`operation:project:add` + `list`；body 可含 `serverIds` + 主 `serverId`（create 同步 N:N）
- `PUT /operation/project`：`operation:project:edit` + `list`
- `GET /operation/project/{id}`：`operation:project:list`
- `DELETE /operation/project/{ids}`：`operation:project:remove` + `list`
- `GET /operation/project/{id}/links`：`operation:project:list`；返回 `{ projectId, serverIds }`
- `PUT /operation/project/{id}/links`：`operation:project:edit` + `list`；body `{ serverIds }`（create/update 亦会 sync）

### 组件管理 `OperationComponentController`（前缀 `/operation/component`，9个）

- `GET /operation/component/list`：`operation:component:list`；返回 `OperationComponentVo`（含 `status` / `lastCheckTime` / `portMatchStatus` / `expectedPort`）
- `POST /operation/component`：`operation:component:add` + `list`；body 可含 `serverIds` + 主 `serverId`
- `PUT /operation/component`：`operation:component:edit` + `list`
- `GET /operation/component/{id}`：`operation:component:list`；返回 VO
- `GET /operation/component/{id}/secret`：`operation:secret:view`
- `DELETE /operation/component/{ids}`：`operation:component:remove` + `list`
- `POST /operation/component/{id}/check`：`operation:component:list`；TCP 探活，更新并返回 `OperationComponentVo`
- `GET /operation/component/{id}/links`：`operation:component:list`；返回 `{ componentId, serverIds }`
- `PUT /operation/component/{id}/links`：`operation:component:edit` + `list`；body `{ serverIds }`（create/update 亦会 sync）

### 端口矩阵 `OperationPortMatrixController`（前缀 `/operation/port-matrix`，5个）

- `GET /operation/port-matrix/list`：`operation:port-matrix:list`；分页；`matrixKey` / `displayName` / `enabled` 筛选
- `GET /operation/port-matrix/{id}`：`operation:port-matrix:list`
- `POST /operation/port-matrix`：`operation:port-matrix:add` + `list`
- `PUT /operation/port-matrix`：`operation:port-matrix:edit` + `list`
- `DELETE /operation/port-matrix/{ids}`：`operation:port-matrix:remove` + `list`

### 运维审计 `OperationAuditController`（前缀 `/operation/audit`，1个）

- `GET /operation/audit/port-matrix`：`operation:project:list`；对照 production-checklist 校验项目/组件端口

### 运维统计 `OperationStatsController`（前缀 `/operation`，1个）

- `GET /operation/stats`：`operation:project:list`；台账计数 + 端口不符数 + 健康 DOWN 数（驾驶舱 ops 用）

### 部署脚本 `OperationDeployController`（前缀 `/operation/deploy`，2个）

- `GET /operation/deploy/presets?serverId=`：`operation:server:list`；`pathPresets` · `actionPresets` · **`serviceKeys`**
- `GET /operation/deploy/{serviceKey}/status?serverId=`：`operation:server:list`；只读 `moli-service.sh status`
- `POST /operation/deploy/{serviceKey}/{action}?serverId=`：`operation:deploy:exec` + `list`；`start`/`stop`/`restart`
- `POST /operation/deploy/{serviceKey}/{action}/task?serverId=`：创建异步部署任务，返回 `taskId`

### 运维任务 `OperationTaskController`（前缀 `/operation/task`）

- `GET /operation/task/{id}?logOffset=`：轮询进度与增量日志（`DeployTaskDrawer`）
- `GET /operation/task/list`：`operation:server:list`；任务历史分页（`TaskHistoryView`）；可按 `taskType` / `serverId` / `projectId` 筛选

### 文件与命令（部署中心）

- `POST /operation/file/upload`：`operation:file:upload`；返回 `taskId`
- `POST /operation/command/exec/task`：`operation:command:exec`；返回 `taskId`

---

## 相关

- 前端排期与验收：[operation-frontend.md](operation-frontend.md)
- 端口矩阵契约：[operation-port-matrix-api.md](operation-port-matrix-api.md)
- 后端路线图：[server-ops-module-roadmap.md](../design/server-ops-module-roadmap.md)
- 全量 API 地图：[distribute user-center-api-map.md](../../moli-project-distribute/docs/api/user-center-api-map.md)
