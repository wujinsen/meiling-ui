# meiling-ui 前端缺口清单

> 更新：2026-07-13 · 与 **monorepo** `frontend-backend-dependencies` / 走查稿 **互相同步**。  
> **给后端**：monorepo [frontend-backend-dependencies.md](../../moli-project-distribute/docs/api/frontend-backend-dependencies.md) · 本仓 [api/frontend-backend-dependencies.md](api/frontend-backend-dependencies.md) §7。  
> **运营关联服务器**（列表 + 新增/编辑弹窗）前端已完成，依赖后端 §15.1 契约。  
> **SVR-25 / SVR-28 / SVR-26b** · **S-VO** · **DC-2** 前端已落地（见 §1.1）。

---

## 1. 运营管理（`operation_*`）

### 1.1 已完成（SVR-25 / SVR-28 / SVR-26b）

| 任务 ID | 前端落点 | 说明 |
|---------|----------|------|
| **SVR-25b** | `OperationTopologyGraphView` · `operation/topology/index` | ECharts 力导向全图；环境/角色/标签筛选 |
| **SVR-25c** | 菜单 407 · `docs/sql/28_operation_topology_menu.sql` | supplement 路由已注册；DB 执行 SQL 后重新登录 |
| **SVR-25d** | `RelationDrawer` | `deployRunning` · `PortMatchBadge` · `recentTasks` → `DeployTaskDrawer` |
| **SVR-26b** | `OperationProjectComponentLinksModal` | 项目行「组件依赖」· `GET/PUT .../component-links` |
| **SVR-28c** | `OperationRelationChips` · `RelationDrawer` | 服务器/项目/组件三管理页关联列 + URL 反向过滤 chip |
| **SVR-28d** | `ServerManageView` | 旧拓扑弹窗已移除；`OperationServerRelationLinksModal` 编辑关联 |
| **SVR-28e** | `OperationEntityLink` · `OperationRelationDrawerHost` | 部署中心 · 任务历史 · 端口审计 · 平台同环境抽屉 |
| **SVR-28f** | `OperationTopologyGraphView` | 实体搜索分组下拉 · `?focus=s-{id}` 深链高亮 |
| **S-VO** | 三管理页 · `operationServerLinks.ts` | `toVo()` `*Count`；去掉列表 links 水合（2026-07-13） |
| **DC-2** | `DeployCenterView` · `useDeployBatchTasks` | 项目优先 + 多服务器批量扇出（2026-07-13） |
| **W7–W10** | `operation.ts` · `DeployCenterView` · `DeployTaskDrawer` | server create 返回 id · 多机 deploy batch API · 任务取消（2026-07-13） |

契约与验收：[api/operation-frontend.md](api/operation-frontend.md) §10 · §16。  
**给后端**：[api/operation-frontend-handoff.md](api/operation-frontend-handoff.md) · **[test/operation-w1-w10-walkthrough.md](test/operation-w1-w10-walkthrough.md)**（W1–W10 走查稿）。

### 1.2 剩余（联合走查 · 非新代码）

| 类型 | 项 | 负责方 | 文档 |
|------|-----|--------|------|
| 点验 | **W1–W10** 浏览器走查 + §10/§16 | 前端 + 后端 | [operation-w1-w10-walkthrough.md](test/operation-w1-w10-walkthrough.md) |
| DBA | 菜单 407 SQL（老库未执行时 supplement 路由兜底） | DBA | `docs/sql/28_operation_topology_menu.sql` |

~~create serverIds / links 同步~~ → **后端 ✅**（2026-07-13）。详见 [operation-frontend-handoff.md](api/operation-frontend-handoff.md) §4。

### 1.3 可选增强

| 任务 ID | 优先级 | 前端落点 | 说明 | 参考 |
|---------|--------|----------|------|------|
| **DC-3** | P2 | `DeployCenterView.vue` · `OperationServerMultiPickModal.vue` | ✅ 追加台账服务器（2026-07-13） | [deploy-center-project-first.md](design/deploy-center-project-first.md) §5 |
| **DC-4** | P3 | `TaskHistoryView.vue` | 按 `projectId` 聚合/分组视图 | 同上 §5 · **需后端 · P3 可选** |
| **S-ERR-1** | P2 | `operationErrors.ts` | ✅ 10101–10109 Toast（2026-07-13） | [operation-frontend.md](api/operation-frontend.md) §3.6 |
| **S-DEPLOY-1** | P2 | `operationPort.ts` | ✅ order/bi 映射（2026-07-13） | handoff §4.2 |
| ~~**DC-BE-1**~~ | — | — | ✅ 由 `POST /deploy/batch/task`（`b4ac176a` + W9）覆盖 | — |

设计文档（镜像 distribute）：[`design/server-topology-visualization.md`](design/server-topology-visualization.md) · [`design/operation-relations-navigation.md`](design/operation-relations-navigation.md)

详见 [api/operation-frontend.md](api/operation-frontend.md) §0 · §15 · §15.1。

---

## 2. 知识库运维（`knowledge` / `kb:*`）

### 2.1 点验（代码已有）

| 任务 ID | 优先级 | 项 | 前端动作 | 阻塞 |
|---------|--------|-----|----------|------|
| **KB-O4** | **P0** | Sync 失败行 UI | ✅ 着色 + 展开 +「仅显示失败」 | 本地 dev O4 样本已就绪 · `kb:prd-acceptance` |
| **KB-BROWSE-1** | **P0** | 浏览体裁/分类多选 facet | ✅ 已接入 | `kb:prd` P0-browse-v3 |
| **KB-GOV-LLM** | **P1** | 治理页 LLM 关闭态 | ✅ `GovernFixPanel` 禁用态 | 8090 关 LLM 时点验 |
| **KB-LLM-DB** | **P1** | 平台 LLM Key 入库 / 清 DB | UI 已有 | 本地 dev `encryptionReady=true` |
| **KB-LINT-SCAN** | **P2** | `GET /kb/lint/scan/status` | ✅ 8090 已部署；404 降级 | — |

### 2.2 可选增强（前端可排期 · 未开工）

| 任务 ID | 优先级 | 前端落点 | 说明 | 阻塞 |
|---------|--------|----------|------|------|
| **KB-LINT-1** | P3 | `KnowledgeLintView.vue` · `normalizeLintIssuesResponse` | 服务端 `unassignedOnly` + 分页 | 后端分页字段 |
| **KB-LINT-2** | P3 | `KnowledgeLintView.vue` | 工单真分页 | 后端稳定分页 |
| **KBOPS-2** | P3 | `KnowledgeOpsDashboardView.vue` | 切运维 Dashboard **专用 API** | 后端可选 API |

详见 [api/knowledge-ops-frontend.md](api/knowledge-ops-frontend.md) · [product/knowledge-ops-prd.md](product/knowledge-ops-prd.md) §8。

---

## 3. SSO / 系统门户

| 任务 ID | 优先级 | 项 | 前端动作 | 阻塞 |
|---------|--------|-----|----------|------|
| **SSO-REG** | — | 系统注册 `SystemManageView` | ✅ 已完成 | — |
| **SSO-MENU-1** | **P2** | 按系统隔离菜单 | ✅ **F-SSO-1～6 已落地**（`reloadRoutesFromServer`）；待后端 `system_id` + [走查](test/sso-menu-frontend-walkthrough.md) | distribute [sso-menu-system-isolation.md](../../moli-project-distribute/docs/design/sso-menu-system-isolation.md) |

见 [sso-frontend-dev-guide.md](sso-frontend-dev-guide.md) · [per-system-menu-isolation.md](per-system-menu-isolation.md) · 走查 [sso-menu-frontend-walkthrough.md](test/sso-menu-frontend-walkthrough.md)。

---

## 4. 其它 / 技术债

| 任务 ID | 项 | 前端动作 | 优先级 |
|---------|-----|----------|--------|
| **DEBT-KB-API** | `knowledge.ts` Sync 等未拆文件 | 可拆 `kbSync.ts`，非功能缺口 | P3 |
| **DEBT-MENU** | 动态菜单 `PlaceholderView` | 新菜单注册 `viewRegistry` 时替换 | 按需 |

---

## 5. 建议执行顺序

### 5.1 点验（优先）

1. **运营** S-VO W1–W10 + §10/§16（`:8888` 本地最新版已重启即可走查）
2. **KB** `kb:prd-acceptance`（KB-O4 · KB-BROWSE-1）
3. **KB** KB-LLM-DB · `kb:prd-acceptance`（8090 本地 dev 通常已满足 secret + O4）

### 5.2 可选增强（有空再做）

| 顺序 | 任务 ID | 模块 | 状态 |
|------|---------|------|------|
| — | **DC-3** · **S-ERR-1** · **S-DEPLOY-1** | 运营 | ✅ 2026-07-13 |
| 1 | **DC-4** | 任务历史 project 聚合 | 待做 · P3 可选 |
| 2 | **KB-LINT-1** · **KB-LINT-2** | Lint 分页收紧 | 待做 · P3 可选 |
| 3 | **KBOPS-2** | 运维 Dashboard 专用 API | 待做 · P3 可选 |
| — | **SSO-MENU-1** | 按系统隔离菜单 | 前端 ✅ · **待联合走查**（后端 P0/P1） |

**运营主功能**：SVR-25/28/26b · S-VO · DC-2/3 · **W7–W10** 均已落地；联合走查见 [operation-w1-w10-walkthrough.md](test/operation-w1-w10-walkthrough.md)。

### 5.3 需后端配合（转发清单）

详见 **[frontend-backend-dependencies.md](api/frontend-backend-dependencies.md)** §2 · §7 · **§8.4 后端回复** · 走查 **[operation-w1-w10-walkthrough.md](test/operation-w1-w10-walkthrough.md)**。

| 类型 | 任务 ID |
|------|---------|
| **点验**（无新 API） | **W1–W10**、运营 §10/§16、KB-O4、KB-BROWSE-1、KB-GOV-LLM、KB-LLM-DB、KB-LINT-SCAN、407 SQL · **SSO-MENU-1 走查**（待后端） |
| **需后端开发** | **SSO-MENU-1** 后端过滤 · **DC-4** / **KB-LINT-1/2** / **KBOPS-2**（**P3 可选**） |
| ~~**DC-BE-1**~~ | ✅ 由 `batch/task` 覆盖 |
| **纯前端** | ~~DC-3、S-ERR-1、S-DEPLOY-1~~ ✅ 2026-07-13 |
