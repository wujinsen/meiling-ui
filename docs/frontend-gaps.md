# meiling-ui 前端缺口清单

> 更新：2026-07-12 · 汇总各模块文档与 PRD 验收项，区分「代码未做」与「待联调/环境阻塞」。

---

## 1. 运营管理（`operation_*`）

| 状态 | 说明 |
|------|------|
| ✅ **无前端缺口** | S0–S13、SVR-21d 端口矩阵、S6-b 多选关联、S6-b+ 关联列展示均已落地 |

详见 [api/operation-frontend.md](api/operation-frontend.md) §0。

---

## 2. 知识库运维（`knowledge` / `kb:*`）

| 优先级 | 项 | 状态 | 说明 |
|--------|-----|------|------|
| P0 | Sync 失败行 UI（O4） | ⏳ 待点验 | 代码已有 fail 着色；`kb:prd` 环境无 fail 日志样本，需运维造失败后复验 |
| P0 | 浏览体裁/分类多选 facet | ⏳ 待后端 | 前端 `useKbDocFilter` 已传 `categoryIds` / `kbTypes`；facet 计数与分页需后端对齐，见 [kb-browse-multi-select-filter.md](kb-browse-multi-select-filter.md) §7 |
| P1 | 平台 LLM 新 Key 入库 | ⏳ 环境 | T19d UI ✅；PUT 加密入库需运维配置 `KB_LLM_CONFIG_SECRET` |
| P1 | 平台 LLM「清除 DB Key」 | ⏳ 待补测 | 仅 `persistedInDatabase=true` 时显示；当前环境 Key 在 yaml |
| P1 | 治理页 LLM 关闭态 | ⏳ 待点验 | `GovernFixPanel` 已有 `llmReady` 禁用 AI 按钮 + 文案；PRD §8.3 需在 LLM 关闭环境 UI 点验 |
| P2 | Lint `unassignedOnly` 服务端筛选 | 🔧 前端兜底 | 后端未实现参数；`normalizeLintIssuesResponse` 客户端过滤 |
| P2 | Lint 工单真分页 / 批量 API | 🔧 部分兜底 | 批量 PUT 并行 + 404 降级；理想态依赖后端分页与 batch 接口 |
| P2 | `GET /kb/lint/scan/status` | 🔧 降级 | 404 时用 `issues?status=0` 计数；完整 O9 需后端部署 |
| P2 | 运维 Dashboard 专用 API | — 可选 | 当前 `KnowledgeOpsDashboardView` 前端聚合，功能可用 |

详见 [api/knowledge-ops-frontend.md](api/knowledge-ops-frontend.md) · [product/knowledge-ops-prd.md](product/knowledge-ops-prd.md) §8。

---

## 3. SSO / 系统门户

| 优先级 | 项 | 状态 | 说明 |
|--------|-----|------|------|
| — | 系统注册管理 `SystemManageView` | ✅ | 见 [sso-frontend-dev-guide.md](sso-frontend-dev-guide.md) §6.2 |
| P2 | 按系统隔离菜单（后端方案） | ⏳ 架构 | 前端过渡方案见 [per-system-menu-isolation.md](per-system-menu-isolation.md)；推荐后端按 `currentSystem` 裁剪 `getRouters` |

---

## 4. 其它

| 项 | 状态 | 说明 |
|----|------|------|
| 动态菜单占位页 | 按需 | 未注册 `viewRegistry` 的菜单仍走 `PlaceholderView` |
| `knowledge.ts` 大文件拆分 | ✅ 部分 | `kbLint` / `kbIngest` / `kbWiki` 已拆；Sync 等仍在 `knowledge.ts` |

---

## 5. 建议下一步（前端可主动推进）

1. **浏览多选 facet**：与后端对齐 `GET /kb/document/search` 多值参数与 facet 响应后，去掉 Mock 侧过滤兜底（若有）。
2. **Sync fail 样本**：配合运维在测试空间触发一次 fail Sync，截图验收 O4。
3. **LLM 关闭态点验**：测试环境 `kb.llm.enabled=false`，确认治理页 AI / auto-fix 禁用与文案。
4. **Lint 批量/分页**：后端 batch API 就绪后，移除并行 PUT 与客户端 `unassignedOnly` 过滤。
