# meiling-ui 前端缺口清单

> 更新：2026-07-13 · 汇总各模块文档与 PRD 验收项。  
> **运营关联服务器**（列表 + 新增/编辑弹窗）前端已完成，依赖后端 §15.1 契约。  
> **SVR-25 / SVR-28 / SVR-26b** 前端已全部落地（见 §1.1）。

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

契约与验收：[api/operation-frontend.md](api/operation-frontend.md) §5.3 · §16 · §10。  
**给后端**：[api/operation-frontend-handoff.md](api/operation-frontend-handoff.md)（交付对照 + 联调待办 §4）。

### 1.2 剩余（联调 / 后端）

| 类型 | 项 | 负责方 |
|------|-----|--------|
| 联调 | `POST` create 接受 `serverIds` 并写 N:N | **后端** |
| 联调 | `PUT/GET .../links` 顺序与主 `serverId`/`serverIp` 同步 | **后端** |
| 可选 | `POST` 返回新建 `id`，便于失败时补调 `PUT links` | 后端增强 |

设计文档（镜像 distribute）：[`design/server-topology-visualization.md`](design/server-topology-visualization.md) · [`design/operation-relations-navigation.md`](design/operation-relations-navigation.md)

详见 [api/operation-frontend.md](api/operation-frontend.md) §0 · §15 · §15.1。

---

## 2. 知识库运维（`knowledge` / `kb:*`）— 前端待办

| 优先级 | 项 | 前端动作 | 阻塞 |
|--------|-----|----------|------|
| **P0** | Sync 失败行 UI（O4） | ✅ 着色 + 展开 +「仅显示失败」筛选；Mock 含 fail 样本 | **环境点验**：monorepo `docs/ops/kb-sync-failure-runbook.md` §9 → `npm run kb:prd-acceptance` P0-O4 |
| **P0** | 浏览体裁/分类多选 facet | ✅ 前端已接入；`kb:prd` P0-browse-v3 探针验收 | — |
| **P1** | 治理页 LLM 关闭态 | ✅ `GovernFixPanel` AI/一键禁用 + 仅 AI 选中提示 | 环境 LLM 常开时点验 |
| **P1** | 平台 LLM 新 Key 入库 / 清除 DB Key | `persistedInDatabase` 场景补测 UI | `KB_LLM_CONFIG_SECRET` |
| **P2** | Lint `unassignedOnly` | 服务端 `current`+`size` 分页时不再二次过滤；裸数组仍客户端兜底 | 后端全量分页字段 |
| **P2** | Lint 工单真分页 / 批量 API | batch API 已接入；无 `current`/`size` 时仍客户端 slice | 后端 |
| **P2** | `GET /kb/lint/scan/status` | ✅ 8090 已部署（`kb:prd` P0-O9）；仅 HTTP 404 时降级 | — |
| — | 运维 Dashboard 专用 API | 无必须；当前前端聚合可用 | 可选 |

详见 [api/knowledge-ops-frontend.md](api/knowledge-ops-frontend.md) · [product/knowledge-ops-prd.md](product/knowledge-ops-prd.md) §8。

---

## 3. SSO / 系统门户

| 优先级 | 项 | 前端动作 | 阻塞 |
|--------|-----|----------|------|
| — | 系统注册 `SystemManageView` | ✅ 已完成 | — |
| **P2** | 按系统隔离菜单 | 仅过渡方案（路径前缀裁剪）；**推荐后端** `getRouters` 按 `currentSystem` 下发 | 架构 |

见 [sso-frontend-dev-guide.md](sso-frontend-dev-guide.md) · [per-system-menu-isolation.md](per-system-menu-isolation.md)。

---

## 4. 其它 / 技术债

| 项 | 前端动作 | 优先级 |
|----|----------|--------|
| `knowledge.ts` Sync 等未拆文件 | 可拆 `kbSync.ts`，非功能缺口 | P3 |
| 动态菜单 `PlaceholderView` | 新菜单注册 `viewRegistry` 时替换 | 按需 |
| `addProjectApi` 返回 `boolean` | 若后端改返回 VO含 `id`，可补 create 后 `PUT links` 兜底 | 随后端 |

---

## 5. 建议执行顺序（仅前端可推进）

1. **Sync fail 点验**（P0 O4）
2. **LLM 关闭态 / 平台 LLM DB Key** 点验（P1）

**运营模块**：SVR-25/28/26b 前端已完成；完整验收见 [operation-frontend.md](api/operation-frontend.md) §10 · §16。
