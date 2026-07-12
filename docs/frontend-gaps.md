# meiling-ui 前端缺口清单

> 更新：2026-07-12（晚）· 汇总各模块文档与 PRD 验收项。  
> **运营关联服务器**（列表 + 新增/编辑弹窗）前端已完成，依赖后端 §15.1 契约。

---

## 1. 运营管理（`operation_*`）

| 状态 | 说明 |
|------|------|
| 🟢 **SVR-25 / SVR-28 已完成** | 28d 去旧拓扑弹窗、25d 抽屉增强、平台同环境 tab 已接 |

| 优先级 | 项 | 前端 | 后端 / 菜单 |
|--------|-----|------|-------------|
| **P1** | **SVR-25b** `TopologyGraphView` | ✅ `OperationTopologyGraphView`（ECharts + 筛选 + 详情） | `GET /operation/topology` ✅ |
| **P1** | **SVR-25c** 拓扑菜单 | supplement 路由已注册 | 执行 `docs/sql/28_operation_topology_menu.sql` 后重新登录 |
| **P1** | **SVR-28c** `RelationDrawer` | ✅ chips + URL 过滤 chip + 反向 list 参数 | `GET /operation/relations/{type}/{id}` ✅ |
| P2 | **SVR-25d** 拓扑弹窗增强 | ✅ RelationDrawer：部署状态徽章、任务行→DeployTaskDrawer | topology VO 补字段 |
| P2 | **SVR-28d** 服务器拓扑按钮 | ✅ RelationDrawer + `OperationServerRelationLinksModal` 编辑关联 | — |
| P2 | **SVR-28e** 部署/任务/端口矩阵/平台 | ✅ 部署中心·任务历史·端口审计·平台同环境抽屉 | — |
| P2 | **SVR-28f** 拓扑页实体搜索下拉 | ✅ 分组下拉 + `?focus=` 深链 | — |
| P2 | **SVR-26b** 项目组件依赖维护 | ✅ `OperationProjectComponentLinksModal` | `component-links` API ✅ |

| 类型 | 项 | 负责方 |
|------|-----|--------|
| 联调 | `POST` create 接受 `serverIds` 并写 N:N | **后端** |
| 联调 | `PUT/GET .../links` 顺序与主 `serverId`/`serverIp` 同步 | **后端** |
| 可选 | `POST` 返回新建 `id`，便于失败时补调 `PUT links` | 后端增强 |

设计文档：[`design/server-topology-visualization.md`](design/server-topology-visualization.md) · [`design/operation-relations-navigation.md`](design/operation-relations-navigation.md)（镜像自 distribute）

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

**运营模块**：SVR-25/28 首版已可联调；完整验收见设计文档 §验收用例。
