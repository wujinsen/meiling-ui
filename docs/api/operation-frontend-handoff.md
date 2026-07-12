# 运营管理 · 前端交付说明（给 moli-server / user-center 后端）

> **读者**：`moli-project-single`（模块 `moli-server`）后端、联调同学。  
> **更新**：2026-07-13  
> **前端仓库**：`meiling-ui` · 分支 `main`（领先 origin 若干 commit，含 SVR-25/26/28 交付）  
> **HTTP 索引**：[user-center-api-map.md](user-center-api-map.md) §4 · **UI 细节**：[operation-frontend.md](operation-frontend.md) §16

---

## 1. 结论（请后端优先看）

| 项 | 状态 |
|----|------|
| **SVR-25 / SVR-26b / SVR-28 前端** | ✅ **已全部落地**，可联调验收 |
| **S0–S13 / SVR-21d 前端** | ✅ 此前已完成 |
| **阻塞后端的开发项** | **无**（接口已按 25a/26a/28a/28b 消费） |
| **剩余** | 见 §4「需后端联调/增强」— 多为 **links 同步** 与 **create 带 serverIds** |

前端缺口清单（全仓）：[frontend-gaps.md](../frontend-gaps.md) §1.1（已完成）· §1.2（后端项）。

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

### 3.4 列表 enrichment（行内展示）

| 接口 | 字段 | 前端展示 |
|------|------|----------|
| `GET /operation/project/list` | `deployRunning` · `portMatchStatus` · `expectedPort` | 列表徽章 |
| `GET /operation/component/list` | `portMatchStatus` · `expectedPort` | 列表徽章 |
| `GET /operation/server/list` | `projectCount` · `componentCount`（或等价） | 关联 chips 数字 |

### 3.5 任务历史 / 部署中心

| 接口 | 字段 | 前端 |
|------|------|------|
| `GET /operation/task/list` | `serverId` · `projectId` · `targetName` | `OperationEntityLink` 点开 relations |
| `POST /operation/file/upload` | 返回 `taskId` | `DeployTaskDrawer` 轮询；dev **走 Vite → 8888**，勿经 Gateway 大文件上传 |

---

## 4. 需后端联调 / 增强（前端在等）

| 优先级 | 项 | 前端期望 | 验证方式 |
|--------|-----|----------|----------|
| **P1** | create 带 `serverIds` | `POST /operation/project` · `POST /operation/component` body 含 `serverIds` + 主 `serverId`，写入 N:N | 新增项目/组件后列表关联列立即正确 |
| **P1** | links 与主字段同步 | `GET/PUT .../links` 有序 `serverIds`；`PUT` 后同步 `serverId` / `serverIp` / `innerIp` | 改关联后列表主服务器名·IP 与 `+N` 一致 |
| P2 | create 返回 `id` | 当前 `add` 仅 `boolean`；有 `id` 可补 create 失败时 `PUT links` | 可选增强 |
| — | 菜单 407 | DBA 执行 `docs/sql/28_operation_topology_menu.sql` | 侧栏出现「拓扑图」 |

详细契约：[operation-frontend.md](operation-frontend.md) §15.1。

---

## 5. 联调 smoke（后端自测清单）

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
# dev 前端路径：/operation/file/upload → Vite proxy → 8888（不经 21000 Gateway）
```

前端验收表：[operation-frontend.md](operation-frontend.md) §10 · §16.3。

---

## 6. 相关文件（meiling-ui）

| 类型 | 路径 |
|------|------|
| API | `src/api/operation.ts` |
| 类型 | `src/types/operation.ts` |
| 拓扑图 | `src/views/operation/OperationTopologyGraphView.vue` |
| 关联抽屉 | `src/components/operation/RelationDrawer.vue` |
| 组件依赖 | `src/components/operation/OperationProjectComponentLinksModal.vue` |
| 菜单 SQL | `docs/sql/28_operation_topology_menu.sql` |

---

## 7. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-13 | 初版：SVR-25/26/28 前端交付对照 + 后端联调待办 |
