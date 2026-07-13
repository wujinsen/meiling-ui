# 运营管理 · 前端交付说明（给 moli-server / user-center 后端）

> **读者**：meiling-ui 前端、联调同学。  
> **更新**：2026-07-13（**对齐 monorepo `b4ac176a`**）  
> **后端 `:8888`**：commit **`b4ac176a`** 本地可联调 W1–W10；共享环境需 push+部署  
> **Monorepo 镜像**：[moli-project-distribute operation-frontend-handoff.md](../../moli-project-distribute/docs/api/operation-frontend-handoff.md)  
> **联合走查**：[test/operation-w1-w10-walkthrough.md](../test/operation-w1-w10-walkthrough.md)
> **前端仓库**：`meiling-ui` · 分支 `main`  
> **HTTP 索引**：[user-center-api-map.md](user-center-api-map.md) §4 · **UI 细节**：[operation-frontend.md](operation-frontend.md) §16

---

## 1. 结论（请后端优先看）

| 项 | 状态 |
|----|------|
| **SVR-25 / SVR-26b / SVR-28 前端** | ✅ **已全部落地**，可联调验收 |
| **S0–S13 / SVR-21d 前端** | ✅ 此前已完成 |
| **后端 API（user-center）** | ✅ **`b4ac176a`** 本地全集；共享需 push+部署；待 **W1–W10 联合走查** |
| **前端待改（Breaking）** | —（create 三实体返回 id · S-VO · W7–W10 均已对齐，2026-07-13） |

**S-VO 契约（必读）**：`serverCount === serverIds.length`（恒等）；**勿**为 chips 批量 `GET .../links`；links **仅**关联弹窗 GET/PUT。开工详稿：[`moli-project-distribute` operation-frontend-handoff §0–§2](../../moli-project-distribute/docs/api/operation-frontend-handoff.md)。

前端缺口清单（全仓）：[frontend-gaps.md](../frontend-gaps.md) §1.1（已完成）· §1.2（联合走查）。  
**W1–W10 走查稿（给后端）**：[test/operation-w1-w10-walkthrough.md](../test/operation-w1-w10-walkthrough.md)。  
**跨模块后端依赖**：[frontend-backend-dependencies.md](frontend-backend-dependencies.md) · §7 可复制转发。

---

## 2. SVR-25 / SVR-26 / SVR-28 前端交付对照

| 任务 ID | 前端页面 / 组件 | 消费的 HTTP | 后端任务 |
|---------|-----------------|-------------|----------|
| **SVR-25b** | `OperationTopologyGraphView` · `operation/topology/index` | `GET /operation/topology` | SVR-25a |
| **SVR-25c** | 菜单 407 · `operationSupplementRoutes.ts` | — | 执行 `docs/sql/28_operation_topology_menu.sql` |
| **SVR-25d** | `RelationDrawer` 增强展示 | `GET /operation/relations/{type}/{id}` | 25a 字段见 §3 |
| **SVR-26b** | `OperationProjectComponentLinksModal` | `GET/PUT /operation/project/{id}/component-links` | SVR-26a |
| **SVR-28c** | `OperationRelationChips` · `OperationRelationFilterChips` | relations + `list?serverId/projectId/componentId` | 28b + list 筛选 |
| **SVR-28d** | `OperationServerRelationLinksModal` | `GET/PUT /operation/server/{id}/links` | 22d 等 |
| **SVR-28e** | `OperationEntityLink` · `OperationRelationDrawerHost` | relations（部署中心/任务历史/端口审计/平台） | 28b |
| **SVR-28f** | 拓扑页实体搜索 + `?focus=s-{id}` | 全图客户端匹配 | 25a |

**已删除、前端不再调用**：

- ~~`GET /operation/server/{id}/topology`~~ → 统一 `GET /operation/relations/server/{id}`

---

## 3. 后端 VO 字段（前端已接线，请保证有值）

### 3.1 `GET /operation/relations/{type}/{id}` → `OperationRelationsVo`

前端 `RelationDrawer` / 导航抽屉依赖：

| 字段路径 | 用途 |
|----------|------|
| `entity` | 抽屉标题 |
| `servers[]` | 服务器 Tab；`status` · `serverRole` · `tags` |
| `projects[]` | 项目 Tab；**`deployRunning`** · **`portMatchStatus`** · `port` |
| `components[]` | 组件 Tab；`portMatchStatus` · `status` |
| **`recentTasks[]`** | 任务 Tab → 点击打开 `DeployTaskDrawer` |

### 3.2 `GET /operation/topology` → `OperationTopologyGraphVo`

| 字段 | 用途 |
|------|------|
| `servers` / `projects` / `components` / `links` | ECharts 力导向图 |
| 节点 id 约定 | 前端深链：`s-{id}` · `p-{id}` · `c-{id}` |

### 3.3 `GET /operation/project/{id}/component-links`

| 字段 | 用途 |
|------|------|
| `projectId` | 弹窗上下文 |
| `componentIds[]` | 多选组件依赖维护 |

### 3.4 列表 / 详情 enrichment（行内展示）

| 接口 | 字段 | 前端展示 |
|------|------|----------|
| `GET /operation/project/list` · **`GET /operation/project/{id}`** | `deployRunning` · `portMatchStatus` · `expectedPort` · **`serverCount`** · **`componentCount`** | 列表徽章 |
| `GET /operation/component/list` · **`GET /operation/component/{id}`** | `portMatchStatus` · `expectedPort` · **`serverCount`** · **`projectCount`** | 列表徽章 |
| `GET /operation/server/list` · **`GET /operation/server/{id}`** | **`projectCount`** · **`componentCount`** | 关联 chips 数字 |

### 3.5 任务历史 / 部署中心

| 接口 | 字段 | 前端 |
|------|------|------|
| `GET /operation/task/list` | `serverId` · `projectId` · `targetName` | `OperationEntityLink` 点开 relations |
| `POST /operation/file/upload` | 返回 `taskId` | `DeployTaskDrawer` 轮询；dev **走 Vite → 8888** |
| `POST /operation/deploy/batch/task` | 返回单父 `taskId` | 部署中心多机 **restart/stop/start**（W9） |
| `POST /operation/task/{id}/cancel` | `status=cancelled` | 任务抽屉「取消任务」（W10） |

---

## 4. 前端已对齐（2026-07-13 ✅）

### 4.1 Breaking · `POST` create 返回 id

| API | `data` | 前端 |
|-----|--------|------|
| `POST /operation/project` | 新建 **id** | `addProjectApi` → `request<number \| string>` ✅ |
| `POST /operation/component` | 新建 **id** | `addComponentApi` → `request<number \| string>` ✅ |
| `POST /operation/server` | 新建 **id** | `addServerApi` → `request<number \| string>` ✅（**W7**） |

三管理页创建时均校验 `result.data` 非空。

### 4.2 后端契约（请持续保证）

| 项 | 状态 | 说明 |
|----|------|------|
| create 带 `serverIds` | ✅ | N:N；主 `serverId` = `serverIds[0]` |
| `PUT/GET .../links` 同步 | ✅ | 主表 IP 字段一致 |
| L7/L8 关联回归 | ✅ | 单选 1 台无幽灵计数 |
| `presets.serviceKeys` | ✅ | 含 order、bi |
| `GET /{id}` `*Count` | ✅ | `toVo()`；`serverCount === serverIds.length` |

### 4.3 S-VO（关系计数 · W1–W6）

| ID | 落点 | 状态 |
|----|------|------|
| S-VO-1 | `src/types/operation.ts` | ✅ |
| S-VO-2 | 三管理页 `loadList` | ✅ 无 `enrichRowsWithLinks` 计数 |
| S-VO-3 | 编辑弹窗 | ✅ 仅 `GET /{id}` |
| S-VO-4 | `OperationRelationChips` | ✅ VO `*Count` |
| S-VO-5 | 关联弹窗 | ✅ 仅 `GET/PUT .../links` |

### 4.4 部署与任务（W7–W10）

| ID | API | 前端落点 | 状态 |
|----|-----|----------|------|
| **W7** | `POST /operation/server` → id | `addServerApi` · `ServerManageView` | ✅ |
| **W8** | `POST /operation/file/upload` → taskId | `uploadFileApi` · `DeployCenterView` 单机 → `DeployTaskDrawer` | ✅ |
| **W9** | `POST /operation/deploy/batch/task` | `createDeployBatchTaskApi` · 多机 deploy 单父任务 | ✅ |
| **W10** | `POST /operation/task/{id}/cancel` | `cancelOperationTaskApi` · `useOperationTaskPoll` · `DeployTaskDrawer` | ✅ |

多机 **上传/远程命令** 仍用 `useDeployBatchTasks` 扇出（设计如此，非 W9 范围）。

**联合走查步骤**：见 [test/operation-w1-w10-walkthrough.md](../test/operation-w1-w10-walkthrough.md)。

### 4.5 环境

| 项 | 值 |
|----|-----|
| 后端 | `http://127.0.0.1:8888` |
| 前端 dev | `http://127.0.0.1:5141`（proxy `/operation` → 8888） |
| 登录 | `admin` / `123456` |

~~§4 旧「需后端联调 / 前端必改」项均已关闭。~~

---

## 5. 联合走查 W1–W10（前后端）

**主文档**：[test/operation-w1-w10-walkthrough.md](../test/operation-w1-w10-walkthrough.md)（含记录表 §5，联调后勾选转发）。

| 组 | ID | 后端关键接口 |
|----|-----|--------------|
| S-VO | W1–W6 | `list` `*Count` · `GET /{id}` · `relations` · `links` · `topology` |
| 部署 | W7–W10 | `POST /server` · `file/upload` · **`deploy/batch/task`** · **`task/{id}/cancel`** |

---

## 6. 联调 smoke（后端自测清单）

在 `8888` 启动 user-center，`meiling-ui` 设 `VITE_USE_MOCK_AUTH=false`：

```bash
# 1. 单机关联（替代旧 topology）
GET /operation/relations/server/201
# 期望：projects/components 非空；projects 含 deployRunning/portMatchStatus；含 recentTasks（可为空数组）

# 2. 全局拓扑
GET /operation/topology
# 期望：servers/projects/components/links 可渲染

# 3. 项目组件依赖
GET /operation/project/{id}/component-links
PUT /operation/project/{id}/component-links  { "componentIds": [...] }

# 4. 列表反向过滤（28c）
GET /operation/project/list?serverId=201
GET /operation/component/list?projectId=xxx

# 5. 大文件上传（部署中心）
POST /operation/file/upload  (multipart)

# 6. 批量滚动重启（W9）
POST /operation/deploy/batch/task  { "steps": [...], "projectId": ... }

# 7. 任务取消（W10）
POST /operation/task/{id}/cancel
```

前端验收表：[operation-frontend.md](operation-frontend.md) §10 · §16.3。

---

## 7. 相关文件（meiling-ui）

| 类型 | 路径 |
|------|------|
| API | `src/api/operation.ts` |
| 类型 | `src/types/operation.ts` |
| 拓扑图 | `src/views/operation/OperationTopologyGraphView.vue` |
| 关联抽屉 | `src/components/operation/RelationDrawer.vue` |
| 组件依赖 | `src/components/operation/OperationProjectComponentLinksModal.vue` |
| 走查稿 | `docs/test/operation-w1-w10-walkthrough.md` |
| 任务轮询/取消 | `src/composables/useOperationTaskPoll.ts` |

---

## 8. 前端仍依赖后端（跨模块）

运营契约、KB 环境、SSO 菜单等待办已汇总至专稿，便于一次性转发后端：

**[frontend-backend-dependencies.md](frontend-backend-dependencies.md)**

---

## 9. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-13 | 对齐 monorepo `b4ac176a` · §8.4③ · DC-BE-1 关闭 |
| 2026-07-13 | **W7–W10** 前端完工；走查稿 |
| 2026-07-13 | **S-VO**：去掉列表 links 水合；chips 用 `toVo()` `*Count` |
| 2026-07-13 | `GET /operation/{project,component,server}/{id}` 回填 `*Count`；见 [frontend-backend-dependencies.md](frontend-backend-dependencies.md) |
| 2026-07-13 | 新增跨模块依赖专稿 `frontend-backend-dependencies.md` |
| 2026-07-13 | 后端联调通过：create 返回 id · links 同步 · order/bi；前端改 `addProjectApi`/`addComponentApi` 返回 `number` |
