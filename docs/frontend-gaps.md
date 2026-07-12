# meiling-ui 前端缺口清单

> 更新：2026-07-12（晚）· 汇总各模块文档与 PRD 验收项。  
> **运营关联服务器**（列表 + 新增/编辑弹窗）前端已完成，依赖后端 §15.1 契约。

---

## 1. 运营管理（`operation_*`）

| 状态 | 说明 |
|------|------|
| ✅ **无待开发项** | S0–S13、SVR-21d、S6-b 多选关联、S6-b+ 列表/表单展示均已落地 |

| 类型 | 项 | 负责方 |
|------|-----|--------|
| 联调 | `POST` create 接受 `serverIds` 并写 N:N | **后端** |
| 联调 | `PUT/GET .../links` 顺序与主 `serverId`/`serverIp` 同步 | **后端** |
| 可选 | `POST` 返回新建 `id`，便于失败时补调 `PUT links` | 后端增强 |

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

1. **Sync fail 点验**：测试空间故意制造 fail，用「仅显示失败」验收 O4（P0）
2. **LLM 关闭态点验**：关 `kb.llm.enabled` 看治理页 AI / 一键禁用（P1）
3. **平台 LLM DB Key**：配置 `KB_LLM_CONFIG_SECRET` 后补测 T19d 入库 / 清除 UI（P1）
4. **Lint 去兜底**：后端全量返回 `current`/`size` 后去掉裸数组客户端 slice（P2）

**运营模块**：前端无需再排期；联调按 [operation-frontend.md §15.1](api/operation-frontend.md#151-后端联调要点关联保存后-ui-必对) 与后端对齐即可。
