# 知识库 · 内容管道运维 PRD（KBOPS）

> **状态**：draft · 2026-07-09  
> **读者**：meiling-ui 前端、产品、联调同学  
> **前端对接（主文档）**：[knowledge-ops-frontend.md](../api/knowledge-ops-frontend.md)  
> **工作台总览**：[knowledge-workbench-frontend.md](../api/knowledge-workbench-frontend.md)  
> **HTTP 契约（后端仓库）**：[`moli-project-distribute/docs/api/KNOWLEDGE_API.md`](../../moli-project-distribute/docs/api/KNOWLEDGE_API.md) §4、§6  
> **技术路线图（后端仓库）**：[`moli-project-distribute/docs/design/kb-ops-roadmap.md`](../../moli-project-distribute/docs/design/kb-ops-roadmap.md)

---

## 1. 背景与定位

### 1.1 问题

知识库「markdown wiki → MySQL → Web 浏览/问答」管道已跑通，但**运维侧**仍存在：

| 痛点 | 影响 |
|------|------|
| Sync 失败在日志里不可见 | 运维以为成功，Web 与磁盘不一致 |
| 定时/手动 Sync 可并发 | 同一空间互相覆盖，难排查 |
| 治理/LLM 后端齐、前端按钮不全 | 日常靠 Swagger，SOP 落不了地 |
| 健康体检与 `lint.py` 检查项不一致 | 不知道以谁为准 |
| 三空间仅部分自动 Sync | `moli-ops-manual` / `jp-fe-ap-exam` 易漏 sync |

### 1.2 产品定义

**知识库内容管道运维**（KBOPS）面向 **知识库管理员 / 空间 editor**，保障：

1. **同步正确性** — wiki 磁盘与 DB 一致、失败可感知  
2. **内容质量** — Lint → 修复 → 复检 → Sync 闭环  
3. **LLM 可用性** — 平台级配置可管理、可探测  

> **边界**：不含 user-center「服务器运维」台账；不含平台 APM/ELK。与 **Ingest / Wiki 治理 / 健康体检** 是协作关系，不是替代。

### 1.3 非目标

- 不做全文向量检索上线（Meilisearch 另立规划）  
- 不替代 Cursor Agent 批量 Ingest  
- 不在本 PRD 内做服务器探活、凭据台账  

---

## 2. 用户与场景

| 角色 | 场景 | 期望 |
|------|------|------|
| **空间 admin** | 改完 wiki 后要 Web 可见 | 一键 Sync + 看见成功/失败 |
| **editor** | commit 后仍有断链 | 被引导到 Wiki 治理 → 修复 → 再 Sync |
| **平台 admin** | 配置 Ask/Ingest/治理用 LLM | LLM 配置页改 Key，无需重启 |
| **运维** | 夜间定时同步三空间 | 失败告警、日志可查、不并发踩库 |
| **CI** | PR 合并前门禁 | lint-strict + dry-run 拦截坏 wiki |

---

## 3. 产品结构

### 3.1 菜单与页面（meiling-ui）

| 菜单 | 路由 component | 状态 | KBOPS 关联 |
|------|----------------|------|------------|
| 健康体检 | `knowledge/lint/index` → `KnowledgeLintView` | ✅ O1–O4 + **O9** | Sync 区 + 质量 Tab 定时 scan 状态条 |
| Wiki 治理 | `knowledge/wiki-govern/index` → `KnowledgeWikiGovernView` | ✅ T16f 联调 + E2E AI 写盘 | 脚本 metadata 待含 `missing_dates` 样例 wiki |
| Ingest 工作台 | `knowledge/ingest/index` → `KnowledgeIngestWorkbenchView` | ✅ 三 Tab UI | **T20f** Tab1/3 直联 + 排版 |
| LLM 配置 | `system/kb-llm/index` 或 `knowledge/kb-llm/index` | ✅ T19d 联调验收 | DB Key 加密入库待运维 `KB_LLM_CONFIG_SECRET` |
| （P2）运维看板 | `knowledge/ops/dashboard` | ✅ 前端 | KBOPS-9 |

### 3.2 标准运维闭环

```text
改 wiki / Ingest commit
  → lint.py --strict（CLI 或治理页 lint-space）
  → Sync（手动 / 自动 / sync-all）
  → 健康体检 → 扫描并落库（kb_lint_issue）
  → 工单处理 → 再 Sync
```

流程图与 Sync 说明见后端仓库 [`wiki同步指南`](../../moli-project-distribute/moli-knowledge/kb/wiki-moli/ops/wiki同步指南.md)。

---

## 4. 功能需求与优先级

### P0 — 正确性与安全（后端为主，前端配合展示）

| ID | 需求 | 用户价值 | 验收要点 |
|----|------|----------|----------|
| **KBOPS-1** | Sync **失败可观测** | 失败不再「假成功」 | `kb_sync_log.status=fail`；脚本非 0 退出；Web `failCount>0` |
| **KBOPS-2** | Sync **并发锁** | 同空间不并行踩库 | 第二个 trigger 被拒绝；前端轮询 `running` |
| **KBOPS-3** | **权限码对齐** | 菜单权限与 API 一致 | `kb:sync:trigger` / `kb:lint:scan` enforce |

**前端配合（O1–O4）**：健康体检 Sync 区展示真实 `status`、`message`、最近批次；失败 Toast + 日志行高亮。详见 [knowledge-ops-frontend.md §3](../api/knowledge-ops-frontend.md#3-p0--健康体检页-sync-增强o1o4)。

### P1 — 闭环与界面

| ID | 需求 | 用户价值 | 验收要点 |
|----|------|----------|----------|
| **KBOPS-4** | 定时 **sync-all 三空间** | 手册/Certify 不漏 sync | 配置化 `space-codes` |
| **KBOPS-5** | Sync **失败告警** | 夜间失败有人知 | webhook 可开关 |
| **KBOPS-6** | **Wiki 治理全链路 UI**（T16f） | 不用 Swagger 修 wiki | W1–W8 → [wiki-govern-frontend.md](../api/wiki-govern-frontend.md) |
| **KBOPS-7** | **平台 LLM 设置页**（T19d） | 管 Key、测连通 | [kb-llm-platform-frontend.md](../api/kb-llm-platform-frontend.md) |
| **T20f** | Ingest **三 Tab** | raw 上传 + 成品导入 | distribute [`kb-import-entry-frontend.md`](../../moli-project-distribute/docs/api/kb-import-entry-frontend.md) |

### P2 — 增强（按需）

| ID | 需求 | 说明 |
|----|------|------|
| **KBOPS-8** | 体检工单增强 | assignee、批量、定时 scan | **O5–O8** ✅ `KbLintIssuesPanel`；**O9** ✅ `KbLintScanStatusBar` |
| **KBOPS-9** | 运维 Dashboard | Sync 趋势、Lint 工单、LLM 调用率 → [§8](../api/knowledge-ops-frontend.md#8-p2--运维-dashboard规划--kbops-9) |
| **KBOPS-10** | Web 体检对齐 lint.py | 或文档明确「文件 vs DB」分工（见 §5） |

---

## 5. 与 Ingest / 治理 / 体检的分工

| 产品线 | 做什么 | 数据源 | 典型出口 |
|--------|--------|--------|----------|
| **Ingest** | 投喂新 raw → 草稿 → commit | raw 树 + 批次 | 默认 auto-sync；`nextSteps` 引导治理/体检 |
| **Wiki 治理** | 修**已有** wiki 文件 | 磁盘 `POST /kb/wiki/lint-space` | `syncAfter` 或跳转健康体检 Sync |
| **健康体检** | DB 快照 + 工单 | MySQL `GET /kb/lint` | Scan 写 `kb_lint_issue`；**Sync Tab** 做 wiki→DB |
| **单页编辑** | 改一篇 wiki 源文件 | `PUT /kb/wiki/page` | 保存后手动/自动 Sync |

**分工铁律（勿混淆）**：

| 页 | 数据源 | 典型 API |
|----|--------|----------|
| Wiki 治理 | **文件真值** | `lint-space`、`govern/*-fix` |
| 健康体检 · 质量 Tab | **DB 快照** | `GET /kb/lint`、`POST /kb/lint/scan` |
| 健康体检 · Sync Tab | **同步管道** | `GET /kb/sync/status`、`POST /kb/sync/trigger` |

> 「扫描并落库」≠ Sync。「重新体检」只读 DB，不写 wiki。

---

## 6. 三空间 Sync

| wiki 目录 | space_code | 典型 spaceId（联调） |
|-----------|------------|----------------------|
| `kb/wiki/` | `enterprise-kb` | `900000000000000001` |
| `kb/wiki-moli/` | `moli-ops-manual` | `900000000000000003` |
| `kb/wiki-jp-exam/` | `jp-fe-ap-exam` | `900000000000000002` |

**产品要求**：

- 手动 trigger、定时任务、CI 应支持**三空间**或明确勾选目标空间  
- `resolveKbSyncParams` **禁止**静默默认 `enterprise-kb`（meiling-ui 已实现）  
- 平台 admin 可在 Sync 区提供三空间快捷切换（O1 可选增强）

配置映射：`kb.wiki.space-dirs`（见 KNOWLEDGE_API §6）。

---

## 7. 权限

| 权限码 | 用途 | meiling-ui 常量 |
|--------|------|-----------------|
| `kb:sync:trigger` | 触发 Sync | `PERM.KB_SYNC_TRIGGER` |
| `kb:lint:scan` | 扫描并落库 | `PERM.KB_LINT_SCAN` |
| `kb:wiki:govern:list` | Wiki 治理菜单 | 菜单 910 |
| `kb:platform:llm` | 平台 LLM 设置 | T19d |
| `kb:ingest:rawUpload` | Ingest Tab1 上传 | T20f · SQL `16_kb_import_entry_menu.sql` |
| 空间 **editor** | lint-space / govern 写盘 | `KbAccessibleSpace.canEdit` |

无 `kb:sync:trigger` 时：Ingest/Tab3 可**仅落盘**不 Sync（文案见 i18n `syncNoPermission`）。

---

## 8. 验收（产品级）

### 8.1 P0 发布门槛

- [ ] 故意制造 Sync 失败 → 日志 `status=fail`，健康体检 Sync 区可见（O4）— 2026-07-12 `kb:prd` 近 30 条无 fail 样本，需运维造失败后 UI 复验  
- [x] 同空间并发 trigger → 第二个有明确提示（O2 + KBOPS-2）— 2026-07-12 `kb:prd` codes=200,10012  
- [x] 三空间各 trigger 一次 → browse 抽样 slug 与磁盘一致 — 2026-07-12 `kb:prd` 各抽 3 slug  

### 8.2 P1 发布门槛

- [x] Wiki 治理：script-fix / auto-fix / merge-hint / syncAfter 可点通（W2/W4/W5/W7）— 2026-07-10 API 联调；AI/脚本写盘成功路径待 LLM Key + metadata 样例  
- [x] 平台 LLM：保存、脱敏展示、test 连通（T19d）— 2026-07-10 联调；新 Key 入库 / 清除 DB Key 待 secret + 持久化后补测  
- [x] Ingest Tab1 上传 raw + Tab3 成品 import UI（T20f 前端）  
- [x] commit/publish 后 `nextSteps` 跳转治理/体检（端到端联调）— `kb:e2e` publish/import 均含 `wiki_govern_lint` + `kb_health_scan`  

### 8.3 回归场景

- [x] sync-all 后三空间 browse 各抽 3 slug — 2026-07-12 `kb:prd` P0-3space  
- [x] 治理修复 → Sync → 体检 scan 工单减少 — 2026-07-12 `kb:prd` moli-ops-manual 390→390（无 script 样例，scan 未新增）  
- [x] 体检工单筛选 / 指派 / 批量 / 分页（O5–O8）— 2026-07-12 `kb:prd` P2-O5～O8  
- [x] 定时 scan 状态条（O9）— 2026-07-12 `kb:prd` P0-O9  
- [x] 浏览体裁多选（browse v3）— 2026-07-12 `kb:prd` P0-browse-v3  
- [ ] LLM 关闭时治理页 AI 按钮 disabled + 文案 — 2026-07-12 环境 LLM 启用；`kb:prd` 跳过改写，需 UI 点验  

---

## 9. 文档地图

| 类型 | meiling-ui 路径 | 说明 |
|------|-----------------|------|
| **本 PRD** | `docs/product/knowledge-ops-prd.md` | 产品优先级与验收 |
| **前端主文档** | `docs/api/knowledge-ops-frontend.md` | O1–O4、排期、代码落点 |
| 工作台总览 | `docs/api/knowledge-workbench-frontend.md` | Ingest + 治理入口 |
| Wiki 治理细则 | `docs/api/wiki-govern-frontend.md` | W1–W8 |
| Ingest 选源入库 | `docs/api/ingest-workbench-frontend.md` | Tab2 Expert/Express |
| Ingest 三 Tab | distribute `docs/api/kb-import-entry-frontend.md` | Tab1/3 契约（meiling-ui 副本见本仓库同名） |
| LLM 设置 | `docs/api/kb-llm-platform-frontend.md` | T19d |
| HTTP 契约 | distribute `docs/api/KNOWLEDGE_API.md` | 权威字段 |
| 技术路线图 | distribute `docs/design/kb-ops-roadmap.md` | KBOPS-1~10 后端项 |
| 联调入口 | `AGENTS.md` · `docs/sso-frontend-dev-guide.md` | 网关、Mock 开关 |

---

## 10. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-12 | 健康体检 **O9**：质量 Tab 展示 `kb.lint.schedule-enabled`、最近 scan 落库、待处理工单数（`KbLintScanStatusBar`） |
| 2026-07-10 | T16f Wiki 治理全链路 API 联调（lint/merge-hint/sync/auto-fix） |
| 2026-07-10 | T19d 平台 LLM 联调验收（GET/PUT/test、权限、脱敏、provider 预设） |
| 2026-07-10 | 前端：O1–O4、`KbSyncOpsPanel`、T20f Tab1/3 UI、治理 `KbGovernWorkflowLinks` |
| 2026-07-09 | meiling-ui 版：从 distribute PRD 适配，补代码现状与文档地图 |
| 2026-07-09 | distribute 初稿 |
