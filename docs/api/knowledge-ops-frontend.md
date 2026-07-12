# 知识库 · 内容管道运维 · 前端对接说明（meiling-ui）

> **读者**：meiling-ui 前端（知识库管理员 / 平台 admin 相关页面）。  
> **产品 PRD**：[knowledge-ops-prd.md](../product/knowledge-ops-prd.md)  
> **HTTP 契约**：[KNOWLEDGE_API.md](../../moli-project-distribute/docs/api/KNOWLEDGE_API.md) §4（体检/Sync）、§3.5（LLM）  
> **工作台总览**：[knowledge-workbench-frontend.md](knowledge-workbench-frontend.md)

---

## 0. meiling-ui 现状审计（2026-07-12）

| 模块 | 代码落点 | 状态 | 与目标差距 |
|------|----------|------|------------|
| 健康体检 · 质量 | `KnowledgeLintView.vue` + `KbLintIssuesPanel.vue` | ✅ O9 + **O5–O8** | — |
| 健康体检 · Scan 状态 | `KbLintScanStatusBar.vue` | ✅ **O9** | 只读；`kb.lint.schedule-enabled` 由运维改 yml/Nacos |
| 健康体检 · Sync | `KbSyncOpsPanel.vue`（`KbSyncPanel` 别名） | ✅ O1–O4 | `running` 轮询 + 日志 fail 着色已实现 |
| Wiki 治理 | `KnowledgeWikiGovernView.vue` + `GovernFixPanel` | ✅ T16f 联调验收 | `script-fix` / `ai-batch-fix` E2E 写盘已通过（`kb:e2e:script-fix` / `kb:e2e:extended`） |
| LLM 配置 T19d | `src/views/system/kb-llm/index.vue` | ✅ 联调验收通过 | 见 [kb-llm-platform-frontend.md §14](kb-llm-platform-frontend.md#14-验收清单前端自测) |
| Ingest 三 Tab T20f | `KnowledgeIngestWorkbenchView.vue` | ✅ UI + 直联 | Tab1 `KbRawUploadPanel`、Tab3 `KbWikiImportPanel` 排版与联调就绪；`VITE_MOCK_KB_IMPORT=false` |
| Lint / Sync API | `src/api/knowledge/kbLint.ts` + `knowledge.ts`（Sync） | ✅ | 类型在 `src/types/knowledge.ts`；Sync 归一化 `src/utils/kbSyncStatus.ts` |
| 空间解析 | `src/utils/kbSyncScope.ts` | ✅ | 已禁止静默默认 enterprise-kb |

**本轮完成（2026-07-12 晚）**：O4 日志「仅显示失败」筛选 + Mock fail 样本；`kbLint` 服务端分页信任 + `scan/status` 仅 HTTP 404 降级；`GovernFixPanel` LLM 关闭时仅-AI 选中提示；`kb:prd` 增 `P2-O5-unassigned` · `P0-browse-v3` 探针（17 项 / 15 通过）。

**本轮完成（2026-07-12）**：健康体检 **O9** 定时 scan 状态条（`KbLintScanStatusBar` + `GET /kb/lint/scan/status`）；Lint API 拆至 `src/api/knowledge/kbLint.ts`；`KnowledgeLintView` 质量 Tab 布局（工具栏 → O9 条 → 概览 → 工单表）。

**上轮完成（2026-07-10）**：健康体检 Sync **O1–O4**（`KbSyncOpsPanel`）、Ingest Tab1/3 **表单排版**、治理页 **工作流旁路链接**（`KbGovernWorkflowLinks`）。

---

## 1. 开发优先级（给前端排期）

| 优先级 | 模块 | 路由 component | 文档 | 后端 | 前端 |
|--------|------|----------------|------|------|------|
| **P0** | 健康体检 · Sync 增强 | `knowledge/lint/index` | **本文 §3** | ✅ 可用 | ✅ **O1–O4** |
| **P0** | 健康体检 · Scan 可见 | 同上 · 质量 Tab | **本文 §3.8** | ✅ `GET /kb/lint/scan/status` | ✅ **O9** |
| **P0** | Wiki 治理全链路 | `knowledge/wiki-govern/index` | [wiki-govern-frontend.md](wiki-govern-frontend.md) | ✅ | ✅ **W2/W4/W5/W7** · T16f E2E |
| **P1** | 平台 LLM 设置 | `system/kb-llm/index` | [kb-llm-platform-frontend.md](kb-llm-platform-frontend.md) | ✅ T19 | ✅ **T19d** 联调验收（新 Key 入库待 `KB_LLM_CONFIG_SECRET`） |
| **P1** | Ingest 三 Tab | `knowledge/ingest/index` | [kb-import-entry-frontend.md](kb-import-entry-frontend.md) | ✅ T20a/b/e | ✅ **T20f** Tab1/3 UI + 直联 |
| **P2** | 运维 Dashboard | `knowledge/ops/dashboard` | **本文 §8** | ✅ KBOPS-9 | ✅ 前端聚合 |

**建议迭代顺序**：**O1–O4 + O9** ✅ → **O5–O8** ✅ → T16f ✅ → T19d ✅ → T20f ✅ → Dashboard ✅。E2E 基线：`npm run kb:e2e` + `kb:e2e:extended`（`KB_BASE=8090`，2026-07-11 **18/18**）。

**网关前缀**：`{VITE_API_BASE_URL}/KnowledgeServer`（开发代理 `vite.config.ts` → `http://127.0.0.1:8888`）

---

## 2. 页面分工（勿混淆）

| 页面 | 数据源 | 用户动作 |
|------|--------|----------|
| **Wiki 治理** | 磁盘 `POST /kb/wiki/lint-space` | 修 **文件**（script/AI/auto） |
| **健康体检 · 质量** | MySQL `GET /kb/lint` | 看 **DB 快照**；Scan 写工单；**O9** 展示定时 scan 开关与最近落库 |
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
├─ [Tab: 质量]
│    ├─ toolbar：重新体检 / 扫描并落库
│    ├─ KbLintScanStatusBar（O9）
│    ├─ 概览卡片 + 三类问题列表
│    └─ KbLintIssuesPanel（O5–O8）
└─ [Tab: Sync] KbSyncOpsPanel（由 KbSyncPanel 重导出）
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
| **O4** | 失败态 | 同上 + trigger 响应 | `status=fail` 行 danger 色 + 展开 message；日志表「仅显示失败」筛选；Mock 含 fail 样本；Toast「Sync 失败，请查看日志」 |

**三空间快捷（可选）**：平台 admin 在 Sync Tab 顶栏展示 `enterprise-kb` / `moli-ops-manual` / `jp-fe-ap-exam` 快捷切换（复用 `KbSpaceSelector` 或 chip）。

**现有实现对照**：

- 已有：`getKbSyncStatusApi` / `getKbSyncLogsApi` / `triggerKbSyncApi`（`knowledge.ts`）  
- 已有：`resolveKbSyncParams`（`kbSyncScope.ts`）、`deriveKbSyncBatchStatus` / `isKbSyncLogFailed`（`kbSyncStatus.ts`）  
- 已实现：`running` 时 4s 轮询 status + 首页 logs；日志行按 `KbSyncLog.status` fail 着色 + 展开 message；**「仅显示失败」**客户端筛选（当前页）

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
export async function triggerKbSyncApi(params?: { spaceId?; spaceCode?; async? })  // async=true 时 30s 超时 + 轮询
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
- [x] trigger 失败（运维配合制造）→ fail 行可见、Toast；可用「仅显示失败」筛选定位  
- [x] `running` 时不能重复 trigger  
- [x] 三空间切换后 status/logs 随 `spaceId` 刷新  

---

## 3.7 P2 · 健康体检 · 工单增强（O5–O8）

> **背景**：`POST /kb/lint/scan` 将问题写入 `kb_lint_issue` 表；运维需在 **健康体检 · 质量** Tab 筛选、分页、指派与批量处理工单。  
> **组件**：`KbLintIssuesPanel.vue`（内嵌于 `KnowledgeLintView.vue` 概览卡片下方）。  
> **API 模块**：`src/api/knowledge/kbLint.ts`（由 `knowledge.ts` re-export）。

### 3.7.1 功能对照

| ID | 功能 | API | UI |
|----|------|-----|-----|
| **O5** | 筛选 | `GET /kb/lint/issues?spaceId=&status=&issueType=&resolved=0` | 类型下拉、状态下拉、「仅未指派」勾选 |
| **O6** | 指派 | `PUT /kb/lint/issue/{id}?assigneeId=` | 指派人列下拉（`listUserApi`）+「指派给我」 |
| **O7** | 批量 | `PUT /kb/lint/issues/batch`（`ids` + `status` / `assigneeId` / `clearAssignee`） | 多选 + 批量忽略 / 标记修复 / 批量指派 |
| **O8** | 分页 | 传 `pageNum` / `pageSize`；后端分页或全量数组 | `AppPagination`；`normalizeLintIssuesResponse` 兼容 slice |

**后端对接（knowledge-server ≥ 2026-07-12）**：

- `GET /kb/lint/scan/status` ✅（8090 已部署，`kb:prd` P0-O9）；**仅 HTTP 404** 时 `getKbLintScanStatusApi` 降级（`scheduleEnabled=false` + 待处理工单数）。  
- `GET /kb/lint/issues` 支持 `issueType`、`resolved=0`、`unassignedOnly`、`pageNum`/`pageSize`（`current`+`size` 时前端信任服务端分页）；全量数组仍兼容客户端 slice。  
- `unassignedOnly` 查询参数 ✅（`kb:prd` P2-O5-unassigned）；裸数组响应仍走 `normalizeLintIssuesResponse` 客户端过滤。  
- `PUT /kb/lint/issue/{id}?status=&assigneeId=` ✅  
- `PUT /kb/lint/issues/batch` ✅ · `batchUpdateKbLintIssuesApi` 直接调批量端点（响应 `data` 为更新条数 → 映射 `{ okCount, failCount }`）。

### 3.7.2 TypeScript

`src/types/knowledge.ts`：

```typescript
export type KbLintIssue = {
  id: number | string
  spaceId?: number | string
  documentId?: number | string
  issueType: string
  detail?: string
  status: KbLintIssueStatus  // 0 待处理 | 1 已忽略 | 2 已修复
  assigneeId?: number | string | null
  priority?: number
  scanTime?: string
  createTime?: string
  updateTime?: string
}

export type KbLintIssueQuery = {
  spaceId?: number | string
  status?: KbLintIssueStatus
  issueType?: string
  assigneeId?: number | string
  resolvedOnly?: boolean   // → query resolved=0
  unassignedOnly?: boolean // → query unassignedOnly=true；服务端分页时信任后端
  pageNum?: number
  pageSize?: number
}
```

### 3.7.3 API 封装（`kbLint.ts`）

```typescript
getKbLintIssuesApi(params?)      // → MoliPage<KbLintIssue>
updateKbLintIssueApi(id, patch)  // status 和/或 assigneeId
batchUpdateKbLintIssuesApi({ ids, status?, assigneeId? })
  // → PUT /kb/lint/issues/batch；assigneeId=null 时 body.clearAssignee=true
```

`getKbLintIssuesApi` 统一返回 `{ records, total, current, size }`，无论后端给数组还是 `MoliPage`。

### 3.7.4 权限

| 场景 | 处理 |
|------|------|
| 查看工单 | 健康体检页进入权限（与现有 lint 菜单一致） |
| 扫描落库 | `kb:lint:scan`（`PERM.KB_LINT_SCAN`） |
| 更新 / 指派 / 批量 | 同单条 PUT；无单独 perm（依赖后端鉴权） |

### 3.7.5 关联页面

- **运维看板 D2**：`KnowledgeOpsDashboardView` 消费 `getKbLintIssuesApi({ status: 0 }).data.records`。  
- **Wiki 编辑修复**：`KnowledgeWikiEditView` 保存后 `updateKbLintIssueApi(issueId, 2)` 仍兼容。  
- **O9 定时 scan 状态**：`KbLintScanStatusBar` + `getKbLintScanStatusApi`（只读，独立于 O5–O8）。

### 3.7.6 验收 O5–O8

- [x] 选空间后工单表加载；切换 `issueType` / `status` 刷新列表 — 2026-07-12 `kb:prd` P2-O5  
- [x] 「仅未指派」勾选后列表仅显示 `assigneeId` 为空行 — 前端 `normalizeLintIssuesResponse` 过滤  
- [x] 单条指派下拉 +「指派给我」→ PUT 成功、列表刷新 — 2026-07-12 `kb:prd` P2-O6  
- [x] 多选 → 批量忽略 / 标记修复 / 批量指派（`PUT /kb/lint/issues/batch`） — 2026-07-12 `kbLint.ts` 改调批量 API  
- [x] 分页切换 `pageNum` / `pageSize`；全量响应时总数与切片正确 — 2026-07-12 `kb:prd` P2-O8  
- [ ] 扫描并落库后工单表自动刷新 — UI 点验（`issuesPanelRef.loadIssues` 已接）

---

## 3.8 P0 · 健康体检 · 定时 Scan 状态可见（O9）

> **背景**：生产默认定时 scan 关闭（`kb.lint.schedule-enabled=false`）；运维按需开启后，空间管理员应在 **健康体检 · 质量 Tab** 看见开关状态、最近落库时间与待处理工单数，避免误以为「没扫过」或「扫了但没入库」。  
> **组件**：`KbLintScanStatusBar.vue`（工具栏下方、概览卡片上方）。  
> **与 O5–O8 关系**：O9 **只读**；手动「扫描并落库」仍走 `POST /kb/lint/scan`（`PERM.KB_LINT_SCAN`），成功后刷新 O9 条与工单表。

### 3.8.1 功能对照

| ID | 功能 | API | UI |
|----|------|-----|-----|
| **O9** | 定时 scan 状态 | `GET /kb/lint/scan/status?spaceId=` | 徽章：`scheduleEnabled`；`lastScanTime`；`openIssueCount`；DB 快照说明 tooltip |

**展示字段**（`KbLintScanStatus`）：

| 字段 | 说明 |
|------|------|
| `scheduleEnabled` | 服务端 `kb.lint.schedule-enabled` 当前值 |
| `scheduleCron` | 有则 tooltip 展示 cron（如 `0 0 3 ? * MON`） |
| `lastScanTime` | 该空间最近一次 **scan 落库** 时间；空 →「尚未 scan 落库」 |
| `openIssueCount` | 待处理工单数（`status=0`）；为 0 时不展示计数文案 |

### 3.8.2 TypeScript

```typescript
export type KbLintScanStatus = {
  spaceId?: number | string
  spaceCode?: string
  scheduleEnabled: boolean
  scheduleCron?: string
  lastScanTime?: string
  openIssueCount?: number
}
```

### 3.8.3 API 封装（`kbLint.ts`）

```typescript
getKbLintScanStatusApi(spaceId?)  // GET /kb/lint/scan/status
```

`knowledge.ts` re-export；mock 见 `USE_MOCK` 分支。

### 3.8.4 i18n

`knowledge.lint.scanStatus.*`（zh / en / ja 已同步）：

- `scheduleOn` / `scheduleOff` — 定时开关徽章  
- `scheduleOnHint` / `scheduleOffHint` — 悬停说明（含 yml/Nacos 开启指引）  
- `lastScan` / `neverScanned` / `openIssues` / `dbSnapshotHint`

### 3.8.5 刷新时机

| 事件 | 行为 |
|------|------|
| 进入质量 Tab / 切换空间 | `onMounted` + `watch(spaceId)` 自动 `load()` |
| 手动「扫描并落库」成功 | `scanStatusBarRef.refresh()` |
| 定时 scan（服务端） | 用户刷新页面或切换空间后可见新 `lastScanTime` |

### 3.8.6 验收 O9

- [x] 质量 Tab 工具栏下见蓝色状态条  
- [x] `scheduleEnabled=false` 时灰色徽章 + 开启指引 tooltip  
- [x] `scheduleEnabled=true` 时绿色徽章 + cron tooltip（若有）  
- [x] 展示最近落库时间或「尚未 scan 落库」  
- [x] `openIssueCount>0` 时展示待处理条数  
- [x] 手动 scan 成功后 `lastScanTime` / 工单数刷新  

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
| `KbWorkflowNextSteps.vue` | 入库/Sync 后 CTA | Ingest、Sync trigger 响应 |
| `KbSyncPanel.vue` → **`KbSyncOpsPanel.vue`** | status + trigger + logs（O1–O4） | 健康体检、治理 `GovernSyncPanel` |
| **`KbLintScanStatusBar.vue`** | 定时 scan 状态只读（O9） | 健康体检 · 质量 Tab |
| **`KbLintIssuesPanel.vue`** | 工单筛选 / 指派 / 批量 / 分页（O5–O8） | 健康体检 · 质量 |
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
| **`kb.lint.schedule-enabled`** | **`false`** | **O9** 状态条展示；生产按需开启后重启生效 |
| `kb.sync.space-code` | 单空间 | KBOPS-4 后可能变多空间 |
| `VITE_USE_MOCK_KNOWLEDGE` | — | `true` 时 Lint/Sync API 走 mock（含 O9） |
| `VITE_MOCK_KB_IMPORT` | — | Tab1/3 mock，与 Tab2 独立 |

---

## 10. 验收总表（运维前端）

| ID | 模块 | 项 | 优先级 |
|----|------|-----|--------|
| O1 | Sync | 状态卡片 | P0 | ✅ |
| O2 | Sync | 触发按钮 + 锁 | P0 | ✅ |
| O3 | Sync | 日志列表 | P0 | ✅ |
| O4 | Sync | 失败展示 | P0 | ✅ |
| **O9** | **Lint** | **定时 scan 状态条** | **P0** | **✅** |
| W1–W8 | 治理 | 见 wiki-govern §13 | P0 | ✅ |
| T19d | LLM | 见 kb-llm-platform | P1 | ✅ |
| T20f | Ingest | 见 kb-import-entry §10 | P1 | ✅ |
| D1–D4 | Dashboard | §8 四区块 | P2 | ✅ |
| O5 | Lint 工单 | issueType / status / 未指派筛选 | P2 | ✅ |
| O6 | Lint 工单 | 指派人列 + PUT assigneeId | P2 | ✅ |
| O7 | Lint 工单 | 多选批量（`PUT /kb/lint/issues/batch`） | P2 | ✅ |
| O8 | Lint 工单 | AppPagination + 客户端 slice | P2 | ✅ |

---

## 11. 代码落点（meiling-ui）

| 路径 | 职责 |
|------|------|
| `src/api/knowledge.ts` | Sync / govern / re-export（§3.4）；Lint 见 `kbLint.ts` |
| `src/api/knowledge/kbLint.ts` | Lint 体检 / scan / issues / **scan status（O9）** |
| `src/api/knowledge/kbWiki.ts` | Wiki 页 / 治理 API |
| `src/api/knowledge/kbIngest.ts` | Ingest / 导入 API |
| `src/api/knowledge/core.ts` | `KB_BASE`、`USE_MOCK`、`buildQuery` 等 |
| `src/types/knowledge.ts` | `KbSyncStatus` / `KbLintScanStatus` / `KbLintIssue` 等 |
| `src/components/knowledge/KbLintScanStatusBar.vue` | O9 定时 scan 状态条 |
| `src/components/knowledge/KbSyncOpsPanel.vue` | Sync Tab O1–O4（`KbSyncPanel` 重导出） |
| `src/components/knowledge/KbSyncPanel.vue` | 兼容别名 → `KbSyncOpsPanel` |
| `src/components/knowledge/KbLintIssuesPanel.vue` | 工单表 O5–O8 |
| `src/views/knowledge/KnowledgeLintView.vue` | 质量（O9 + O5–O8）+ Sync（O1–O4）双 Tab |
| `src/views/knowledge/KnowledgeWikiGovernView.vue` | 治理主页面 |
| `src/components/knowledge/govern/GovernFixPanel.vue` | W2/W4/W5；LLM 关闭时 AI/一键禁用 + 仅-AI 选中提示 |
| `src/components/knowledge/govern/GovernSyncPanel.vue` | 治理页 Sync（可复用 Ops 面板） |
| `src/views/system/kb-llm/index.vue` | T19d |
| `src/views/knowledge/KnowledgeOpsDashboardView.vue` | KBOPS-9 运维看板 D1–D4 |
| `src/utils/kbOpsDashboard.ts` | Dashboard 前端聚合（Sync 趋势 / 工单 / 断链 Top N） |
| `src/components/knowledge/KbOpsSyncTrendChart.vue` | D1 近 7 日堆叠柱状图 |
| `scripts/kb-e2e-walkthrough.mjs` | T19d + T16f + T20f 主链路 E2E（`npm run kb:e2e`） |
| `scripts/kb-e2e-extended.mjs` | AI 写盘 / Tab3 冲突 / rawUpload 权限（`npm run kb:e2e:extended`） |
| `scripts/kb-e2e-script-fix.mjs` | T16f `script-fix` metadata 写盘（`npm run kb:e2e:script-fix`） |
| `scripts/kb-prd-acceptance.mjs` | PRD §8 探针（`npm run kb:prd`：O4/O9/browse-v3/O5–O8） |
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
| `KbInsightController.java` | `/kb/lint*`（含 **`GET /kb/lint/scan/status`**） |
| `KbSyncServiceImpl.java` | trigger + 日志 + KBOPS-1/2 |
| `kb/tools/sync_to_db.py` | Sync 脚本 |
| `docs/design/kb-ops-roadmap.md` | 后端 KBOPS 排期 |

---

## 14. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-12（晚） | O4 fail-only 筛选；`kbLint` 分页信任 + scan/status 404-only 降级；`GovernFixPanel` LLM-off 提示；`kb:prd` 探针扩展；浏览多选 facet 文档 §7 结案 |
| 2026-07-12 | O7 改调 `PUT /kb/lint/issues/batch`（去掉并行 PUT 兜底）；§3.7.1/§10 对齐；与 distribute `TASKS.md` 同步 |
| 2026-07-12 | **O9** `KbLintScanStatusBar` + §3.8；§0/§3.1/§9/§10/§11 对齐；Lint API 拆 `src/api/knowledge/kbLint.ts`；§3.7 O5–O8 验收勾选 |
| 2026-07-11 | §1 排期表 O1–O4 / W2–W7 标 ✅；§3.6 / §10 验收勾选；E2E 复验 18/18（`KB_BASE=8090`） |
| 2026-07-10 | **KBOPS-9** `KnowledgeOpsDashboardView` D1–D4；E2E 脚本 walkthrough + extended（12/12 + 7/7）；`13_kb_ops_dashboard_menu.sql` |
| 2026-07-10 | O1–O4、`KbSyncOpsPanel`、T20f Tab1/3 UI 排版、治理工作流链接；验收表标 ✅ |
| 2026-07-09 | meiling-ui 版：§0 现状审计、代码落点对齐仓库、5141 联调说明 |
| 2026-07-09 | distribute 初稿：O1–O4、排期、Dashboard |
