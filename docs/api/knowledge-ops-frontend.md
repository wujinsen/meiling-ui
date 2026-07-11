# 知识库 · 内容管道运维 · 前端对接说明（meiling-ui）

> **读者**：meiling-ui 前端（知识库管理员 / 平台 admin 相关页面）。  
> **产品 PRD**：[knowledge-ops-prd.md](../product/knowledge-ops-prd.md)  
> **HTTP 契约**：[KNOWLEDGE_API.md](../../moli-project-distribute/docs/api/KNOWLEDGE_API.md) §4（体检/Sync）、§3.5（LLM）  
> **工作台总览**：[knowledge-workbench-frontend.md](knowledge-workbench-frontend.md)

---

## 0. meiling-ui 现状审计（2026-07-11）

| 模块 | 代码落点 | 状态 | 与目标差距 |
|------|----------|------|------------|
| 健康体检 · 质量 | `KnowledgeLintView.vue` | ✅ | — |
| 健康体检 · Sync | `KbSyncOpsPanel.vue`（`KbSyncPanel` 别名） | ✅ O1–O4 | KBOPS-1/2 后端 `running` 轮询细节可增强；前端 O1–O4 已验收 |
| Wiki 治理 | `KnowledgeWikiGovernView.vue` + `GovernFixPanel` | ✅ T16f 联调验收 | `ai-batch-fix` E2E 写盘已通过；`script-fix` 待含 metadata issue 样例 |
| LLM 配置 T19d | `src/views/system/kb-llm/index.vue` | ✅ 联调验收通过 | 见 [kb-llm-platform-frontend.md §14](kb-llm-platform-frontend.md#14-验收清单前端自测) |
| Ingest 三 Tab T20f | `KnowledgeIngestWorkbenchView.vue` | ✅ UI + 直联 | Tab1 `KbRawUploadPanel`、Tab3 `KbWikiImportPanel` 排版与联调就绪；`VITE_MOCK_KB_IMPORT=false` |
| Sync API | `src/api/knowledge.ts` | ✅ | 类型在 `src/types/knowledge.ts`；状态归一化 `src/utils/kbSyncStatus.ts` |
| 空间解析 | `src/utils/kbSyncScope.ts` | ✅ | 已禁止静默默认 enterprise-kb |

**本轮完成（2026-07-10）**：健康体检 Sync **O1–O4**（`KbSyncOpsPanel`）、Ingest Tab1/3 **表单排版**（冲突策略横排、成品导入单卡布局）、治理页 **工作流旁路链接**（`KbGovernWorkflowLinks`）。

---

## 1. 开发优先级（给前端排期）

| 优先级 | 模块 | 路由 component | 文档 | 后端 | 前端 |
|--------|------|----------------|------|------|------|
| **P0** | 健康体检 · Sync 增强 | `knowledge/lint/index` | **本文 §3** | ✅ 可用 · KBOPS-1/2 轮询可增强 | ✅ **O1–O4** |
| **P0** | Wiki 治理全链路 | `knowledge/wiki-govern/index` | [wiki-govern-frontend.md](wiki-govern-frontend.md) | ✅ | ✅ **W2/W4/W5/W7** · T16f E2E |
| **P1** | 平台 LLM 设置 | `system/kb-llm/index` | [kb-llm-platform-frontend.md](kb-llm-platform-frontend.md) | ✅ T19 | ✅ **T19d** 联调验收（新 Key 入库待 `KB_LLM_CONFIG_SECRET`） |
| **P1** | Ingest 三 Tab | `knowledge/ingest/index` | [kb-import-entry-frontend.md](kb-import-entry-frontend.md) | ✅ T20a/b/e | ✅ **T20f** Tab1/3 UI + 直联 |
| **P2** | 运维 Dashboard | `knowledge/ops/dashboard` | **本文 §8** | ✅ KBOPS-9 | ✅ 前端聚合 |

**建议迭代顺序**：Ingest Expert LLM 降级、Tab1 `raw-prefixes` 下拉（P1 可选）→ 运维增强；**O1–O4、T16f、T20f、T19d、Dashboard 前端已完成**（`npm run kb:e2e` + `kb:e2e:extended`，`KB_BASE=8090`，2026-07-11 **18/18**）。

**网关前缀**：`{VITE_API_BASE_URL}/KnowledgeServer`（开发代理 `vite.config.ts` → `http://127.0.0.1:8888`）

---

## 2. 页面分工（勿混淆）

| 页面 | 数据源 | 用户动作 |
|------|--------|----------|
| **Wiki 治理** | 磁盘 `POST /kb/wiki/lint-space` | 修 **文件**（script/AI/auto） |
| **健康体检 · 质量** | MySQL `GET /kb/lint` | 看 **DB 快照**；Scan 写工单 |
| **健康体检 · Sync** | `POST /kb/sync/trigger` | wiki → DB；日志 `GET /kb/sync/logs` |

```text
治理修文件 → (可选 syncAfter) → Sync → 健康体检 Scan → 处理 kb_lint_issue
```

Ingest `commit/publish` 默认 **auto-sync**（`kb.ingest.commit-auto-sync=true`）；失败时用户来 **健康体检 · Sync Tab** 看 O1–O4。

---

## 3. P0 · 健康体检页 Sync 增强（O1–O4）

> **背景**：KBOPS-1 修复后，`SyncTriggerVo` / `kb_sync_log` 返回真实 `status` 与 `message`。现有 `KbSyncPanel` 主要解析 `outputTail`，需对齐字段，避免「恒成功」错觉。

### 3.1 建议布局

当前：`KnowledgeLintView` 用 `SegmentControl` 切换 **质量体检** / **Wiki 同步** Tab，Sync Tab 内嵌 `KbSyncPanel`。

目标（可在同 Tab 内增强，不必改信息架构）：

```text
KnowledgeLintView.vue
├─ KbSpaceSelector
├─ [Tab: 质量] Lint 摘要 + 工单表 + 扫描并落库
└─ [Tab: Sync] KbSyncOpsPanel（由 KbSyncPanel 演进）
     ├─ O1 状态卡片
     ├─ O2 触发 + 并发锁
     └─ O3/O4 日志表 + 失败态
```

### 3.2 KbSyncOpsPanel 行为

| ID | 功能 | API | UI |
|----|------|-----|-----|
| **O1** | 当前 Sync 状态 | `GET /kb/sync/status?spaceId=` | 展示 `running` / `lastBatchNo` / `lastStatus` / `lastMessage` / `failCount` |
| **O2** | 触发 Sync | `POST /kb/sync/trigger?spaceId=&spaceCode=` | 按钮；`running` 时 disabled；需 `kb:sync:trigger` |
| **O3** | 最近日志 | `GET /kb/sync/logs?spaceId=&pageSize=10` | 表格：batchNo、**status**、createTime、message 摘要 |
| **O4** | 失败态 | 同上 + trigger 响应 | `status=fail` 行 danger 色 + 展开 message；Toast「Sync 失败，请查看日志」 |

**三空间快捷（可选）**：平台 admin 在 Sync Tab 顶栏展示 `enterprise-kb` / `moli-ops-manual` / `jp-fe-ap-exam` 快捷切换（复用 `KbSpaceSelector` 或 chip）。

**现有实现对照**：

- 已有：`getKbSyncStatusApi` / `getKbSyncLogsApi` / `triggerKbSyncApi`（`knowledge.ts`）  
- 已有：`resolveKbSyncParams`（`kbSyncScope.ts`）  
- 待补：status 类型字段、`running` 轮询、日志行按 `KbSyncLog.status` 着色  

### 3.3 TypeScript

**现状**（`src/types/knowledge.ts`）：

```typescript
export type KbSyncStatus = {
  batchNo?: string
  spaceId?: number | string
  lastSyncTime?: string
  total?: number
  actionCounts?: Record<string, number>
  failCount?: number
}

export type KbSyncTrigger = {
  success: boolean
  exitCode: number
  spaceCode?: string
  outputTail?: string
}

export type KbSyncLog = {
  id: number | string
  batchNo?: string
  spaceId?: number | string
  sourcePath?: string
  action?: string
  status?: string
  message?: string
  createTime?: string
}
```

**KBOPS-1 后建议扩展**（可与后端 `SyncStatusVo` 对齐后再改）：

```typescript
export type KbSyncStatus = {
  running?: boolean
  lastBatchNo?: string
  lastStatus?: 'success' | 'fail' | 'running'
  lastMessage?: string
  lastFinishTime?: string
  failCount?: number
  successCount?: number
  // …保留现有 batchNo / actionCounts
}

export type KbSyncTrigger = {
  success: boolean
  exitCode: number
  batchNo?: string
  status?: string
  message?: string
  stdoutTail?: string
  spaceCode?: string
  outputTail?: string
  nextSteps?: KbWorkflowHintVo[]
}
```

类型可继续放在 `knowledge.ts`，或拆 `src/types/knowledge/kbSync.ts`。

### 3.4 API 封装

**现状**（`src/api/knowledge.ts`）：

```typescript
export async function getKbSyncStatusApi(spaceId?: number | string)
export async function getKbSyncLogsApi(params?: { spaceId?; batchNo?; pageNum?; pageSize? })
export async function triggerKbSyncApi(params?: { spaceId?; spaceCode? })  // timeoutMs: 320_000
```

无需改路径；O1–O4 主要是**消费字段**与 UI。可选拆 `src/api/knowledge/kbSync.ts` 便于治理页复用。

### 3.5 权限与错误

| 场景 | 处理 |
|------|------|
| 无 `kb:sync:trigger` | 不展示 Sync Tab（已实现：`KnowledgeLintView` `canSync`） |
| 未选空间 | `resolveKbSyncParams` 返回 null → 提示 `knowledge.sync.needSpace` |
| KBOPS-2 并发锁 | HTTP 200 + 业务码「同步进行中」→ 禁用按钮 + 轮询 `status.running` |
| 脚本失败 KBOPS-1 | 展示 `message` / `outputTail`；**勿**仅凭 `success` 覆盖为绿勾 |

### 3.6 验收 O1–O4

- [x] 选空间后加载 status + 最近 10 条 log  
- [x] trigger 成功 → status 刷新、log 新增 success 行  
- [x] trigger 失败（运维配合制造）→ fail 行可见、Toast  
- [x] `running` 时不能重复 trigger  
- [x] 三空间切换后 status/logs 随 `spaceId` 刷新  

---

## 4. P0 · Wiki 治理（T16f / KBOPS-6）

**完整规格** → [wiki-govern-frontend.md](wiki-govern-frontend.md)

**运维闭环必做（W2/W4/W5/W7）**：

| 按钮 | API | meiling-ui |
|------|-----|------------|
| 脚本修复 W2 | `POST /kb/wiki/govern/script-fix` | `GovernFixPanel` → `runScriptFix` |
| 一键修复 W4/W5 | `POST /kb/wiki/govern/auto-fix` | `relintAfter` + 可选 **`syncAfter`** |
| 合并提示 W7 | `POST /kb/wiki/govern/merge-hint` | `dup_slug` → 复制 Cursor 指令 |
| 修复后 Sync | `syncAfter: true` 或跳转健康体检 **O2** | `GovernSyncPanel` / `KbSyncPanel` |

交叉引用：[knowledge-workbench-frontend.md §8.4](knowledge-workbench-frontend.md#84-wiki-治理-script--auto-fix--mergew1w8-subset)（联调结论）。

---

## 5. P1 · 平台 LLM 设置（T19d / KBOPS-7）

→ 全文 **[kb-llm-platform-frontend.md](kb-llm-platform-frontend.md)**

| 项 | 值 |
|----|-----|
| 路由 | `system/kb-llm/index`（`viewRegistry` 亦注册 `knowledge/kb-llm/index`） |
| 组件 | `src/views/system/kb-llm/index.vue` |
| 权限 | `kb:platform:llm` |
| API | `getKbPlatformLlmConfigApi` / `saveKbPlatformLlmConfigApi` / `testKbPlatformLlmConfigApi` |

治理页 AI 修复依赖 LLM；保存后 `GET /kb/wiki/govern/options` 的 `llmAvailable` 应变 true。

---

## 6. P1 · Ingest 三 Tab（T20f）

→ 契约 **[kb-import-entry-frontend.md](kb-import-entry-frontend.md)**（本仓库 meiling-ui 版，含 UI 排版说明）

| Tab | 组件 | API | 联调 |
|-----|------|-----|------|
| Tab1 投喂 Raw | `KbRawUploadPanel` | `POST /kb/ingest/raw-upload` | `VITE_MOCK_KB_IMPORT=false` 直联；冲突策略三列横排 |
| Tab2 选源入库 | 页内 Expert/Express | 现有 Ingest API | [ingest-workbench-frontend.md](ingest-workbench-frontend.md) |
| Tab3 成品导入 | `KbWikiImportPanel` | `POST /kb/wiki/page/import` | 单卡表单 + 右侧结果区（约 2:1）；Sync 需 `kb:sync:trigger` |

`commit/publish` 响应 **`nextSteps`** → `KbWorkflowNextSteps.vue`（`wiki_govern_lint` / `kb_health_scan`）。

验收：distribute 文档 **T20-F1～F7**；Tab1 权限种子 `16_kb_import_entry_menu.sql`。

---

## 7. 共享组件

| 组件 | 用途 | 复用页 |
|------|------|--------|
| `KbWorkflowNextSteps.vue` | 入库/Sync 后 CTA | Ingest、（待接）Sync trigger 响应 |
| `KbSyncPanel.vue` → **`KbSyncOpsPanel.vue`** | status + trigger + logs（O1–O4） | 健康体检、治理 `GovernSyncPanel` |
| `KbSpaceSelector` | 空间选择 | 全部 KB 写操作页 |
| `kbSyncScope.ts` | 解析 trigger 参数 | Sync 相关页 |

---

## 8. P2 · 运维 Dashboard（规划 · KBOPS-9）

**路由建议**：`knowledge/ops/dashboard` · perm `kb:ops:dashboard`（SQL 待补）

| 区块 | 数据源 | 说明 |
|------|--------|------|
| Sync 趋势 D1 | `GET /kb/sync/logs` 聚合 | 近 7 日 success/fail 计数 |
| 待处理工单 D2 | `GET /kb/lint/issues` + `resolved=0` | 按 space / issueType |
| LLM 可用 D3 | `GET /kb/ask/llm-config` | available 指示灯 |
| 断链 Top N D4 | lint issues `broken_link` | P2 可选 |

后端 Dashboard 专用 API **尚未实现**；当前由 `KnowledgeOpsDashboardView` 聚合 `sync/logs`、`lint/issues`、`ask/llm-config`。

| 区块 | 前端落点 | 状态 |
|------|----------|------|
| D1 Sync 趋势 | `KbOpsSyncTrendChart` + `aggregateSyncTrendByDay` | ✅ |
| D2 待处理工单 | `aggregatePendingIssues` | ✅ |
| D3 LLM 可用 | `getKbLlmConfigApi` 指示灯 | ✅ |
| D4 断链 Top N | `topBrokenLinkIssues` | ✅ |

菜单 SQL：`docs/sql/13_kb_ops_dashboard_menu.sql`；未执行时由 `knowledgeSupplementRoutes` 补侧栏。

---

## 9. 配置项（联调须知）

| 配置 | 默认 | 前端影响 |
|------|------|----------|
| `kb.ingest.commit-auto-sync` | `true` | publish 后可能已 Sync，O1 仍要展示最后批次 |
| `kb.sync.schedule-enabled` | `false` | 定时 Sync 默认关 |
| `kb.sync.space-code` | 单空间 | KBOPS-4 后可能变多空间 |
| `VITE_USE_MOCK_KNOWLEDGE` | — | `true` 时 Sync API 走 mock |
| `VITE_MOCK_KB_IMPORT` | — | Tab1/3 mock，与 Tab2 独立 |

---

## 10. 验收总表（运维前端）

| ID | 模块 | 项 | 优先级 |
|----|------|-----|--------|
| O1 | Sync | 状态卡片 | P0 | ✅ |
| O2 | Sync | 触发按钮 + 锁 | P0 | ✅ |
| O3 | Sync | 日志列表 | P0 | ✅ |
| O4 | Sync | 失败展示 | P0 | ✅ |
| W1–W8 | 治理 | 见 wiki-govern §13 | P0 | ✅ |
| T19d | LLM | 见 kb-llm-platform | P1 | ✅ |
| T20f | Ingest | 见 kb-import-entry §10 | P1 | ✅ |
| D1–D4 | Dashboard | §8 四区块 | P2 | ✅ |

---

## 11. 代码落点（meiling-ui）

| 路径 | 职责 |
|------|------|
| `src/api/knowledge.ts` | Sync / LLM / govern API（§3.4） |
| `src/types/knowledge.ts` | `KbSyncStatus` / `KbSyncTrigger` / `KbSyncLog` |
| `src/components/knowledge/KbSyncOpsPanel.vue` | Sync Tab O1–O4（`KbSyncPanel` 重导出） |
| `src/components/knowledge/KbSyncPanel.vue` | 兼容别名 → `KbSyncOpsPanel` |
| `src/views/knowledge/KnowledgeLintView.vue` | 质量 + Sync 双 Tab |
| `src/views/knowledge/KnowledgeWikiGovernView.vue` | 治理主页面 |
| `src/components/knowledge/govern/GovernFixPanel.vue` | W2/W4/W5 |
| `src/components/knowledge/govern/GovernSyncPanel.vue` | 治理页 Sync（可复用 Ops 面板） |
| `src/views/system/kb-llm/index.vue` | T19d |
| `src/views/knowledge/KnowledgeOpsDashboardView.vue` | KBOPS-9 运维看板 D1–D4 |
| `src/utils/kbOpsDashboard.ts` | Dashboard 前端聚合（Sync 趋势 / 工单 / 断链 Top N） |
| `src/components/knowledge/KbOpsSyncTrendChart.vue` | D1 近 7 日堆叠柱状图 |
| `scripts/kb-e2e-walkthrough.mjs` | T19d + T16f + T20f 主链路 E2E（`npm run kb:e2e`） |
| `scripts/kb-e2e-extended.mjs` | AI 写盘 / Tab3 冲突 / rawUpload 权限（`npm run kb:e2e:extended`） |
| `src/utils/kbSyncStatus.ts` | Sync 状态/日志归一化 |
| `src/utils/kbImport.ts` | Raw/Wiki 导入校验与冲突判定 |
| `src/utils/kbWorkflowRoutes.ts` | nextSteps 路由跳转 |
| `src/utils/kbSyncScope.ts` | 三空间 trigger 参数 |
| `src/constants/permissions.ts` | `KB_SYNC_TRIGGER` / `KB_LINT_SCAN` / `KB_OPS_DASHBOARD` |

菜单 SQL（本仓库）：`docs/sql/12_kb_platform_llm_menu.sql`、`docs/sql/13_kb_ops_dashboard_menu.sql`；Ingest Tab1 见 distribute `16_kb_import_entry_menu.sql`。

---

## 12. 联调环境

1. 启动 gateway + `moli-knowledge-server`（`VITE_USE_MOCK_AUTH=false`）  
2. `npm run dev` → 默认 **http://localhost:5141**（Windows 保留端口段见 `vite.config.ts` 注释）  
3. 部署机存在 `kb/tools/sync_to_db.py`、`lint.py`  
4. 测试空间：`900000000000000001` enterprise-kb · `900000000000000003` moli-ops-manual · `900000000000000002` jp-fe-ap-exam  
5. LLM：完成 T19d 或 yml 配 `kb.llm`  
6. Tab1/3：`VITE_MOCK_KB_IMPORT=false` 且后端 T20a/b 就绪后直联  
7. **E2E**：`npm run kb:e2e` + `npm run kb:e2e:extended`（见根目录 `AGENTS.md`）；`KB_BASE` 指向 knowledge-server 实际端口  
8. **运维看板**：执行 `docs/sql/13_kb_ops_dashboard_menu.sql` 后重新登录（或依赖 supplement 菜单）  

---

## 13. 相关文件（后端仓库）

| 路径 | 说明 |
|------|------|
| `KbSyncController.java` | `/kb/sync/*` |
| `KbInsightController.java` | `/kb/lint*` |
| `KbSyncServiceImpl.java` | trigger + 日志 + KBOPS-1/2 |
| `kb/tools/sync_to_db.py` | Sync 脚本 |
| `docs/design/kb-ops-roadmap.md` | 后端 KBOPS 排期 |

---

## 14. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-11 | §1 排期表 O1–O4 / W2–W7 标 ✅；§3.6 / §10 验收勾选；E2E 复验 18/18（`KB_BASE=8090`） |
| 2026-07-10 | **KBOPS-9** `KnowledgeOpsDashboardView` D1–D4；E2E 脚本 walkthrough + extended（12/12 + 7/7）；`13_kb_ops_dashboard_menu.sql` |
| 2026-07-10 | O1–O4、`KbSyncOpsPanel`、T20f Tab1/3 UI 排版、治理工作流链接；验收表标 ✅ |
| 2026-07-09 | meiling-ui 版：§0 现状审计、代码落点对齐仓库、5141 联调说明 |
| 2026-07-09 | distribute 初稿：O1–O4、排期、Dashboard |
