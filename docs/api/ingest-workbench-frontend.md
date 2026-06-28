# Ingest 工作台 · 前端对接说明（meiling-ui）

> **读者**：meiling-ui 前端。后端 **T15a–e + T18 + T19 ✅**；本文是联调权威说明（含增量需求）。  
> **总览**：[knowledge-workbench-frontend.md](knowledge-workbench-frontend.md)  
> **HTTP 契约**：[KNOWLEDGE_API.md](KNOWLEDGE_API.md) §9 · **产品方案**：[Ingest工作台产品方案.md](../../moli-knowledge/kb/wiki/guides/Ingest工作台产品方案.md)

---

## 1. 页面与路由

| 项 | 值 |
|----|-----|
| 列表/详情 | `knowledge/ingest/index`（query `id?` 打开批次详情） |
| 组件 | `KnowledgeIngestView`（或现有等价命名） |
| 网关 | `{VITE_API_BASE_URL}/KnowledgeServer/kb/ingest/*` |

**两种模式**（同一页，URL 或 Tab 切换）：

| 模式 | 用户路径 | 关键 API |
|------|----------|----------|
| **Expert** | ①选 raw → ②Plan → ③生成 → ④审阅 → ⑤lint → ⑥commit | 逐步调用 §9 各接口 |
| **Express** | 勾选 raw → **一键预览** → diff 扫一眼 → **确认入库** | `express` / `publish` |

---

## 2. 推荐界面结构

```
KnowledgeIngestView.vue
├─ KbSpaceSelector
├─ IngestRawPanel              # raw-tree + raw-coverage 筛选
├─ IngestJobList               # 批次分页
├─ IngestJobDetail             # id 打开
│   ├─ ExpressBanner           # ?express=1 或模式切换
│   ├─ ExpressOptions          # ☑ skeleton Plan  ☑ 模板入库（不调 LLM）
│   ├─ PlanEditor              # create/enrich/skip 表
│   ├─ DraftDiffList           # baseline ↔ draft / patch
│   ├─ LintPanel               # commit 前预检
│   └─ CommitResult + KbWorkflowNextSteps
└─ TemplatePicker（可选）      # T15e 批次模板
```

---

## 3. 状态机

`IngestJobVo.status`：

```
created → planned → reviewing → committed
```

| 状态 | UI 提示 | 可用操作 |
|------|---------|----------|
| `created` | 已选 raw，未规划 | 生成 Plan、Express 预览 |
| `planned` | Plan 已保存 | 编辑 Plan、生成草稿 |
| `reviewing` | 草稿已生成 | diff 审阅、approve、lint、commit |
| `committed` | 已落盘 | 只读；可跳转 Wiki 治理 |

---

## 4. Express 与模板模式（T18 + T19 · 前端增量）

### 4.1 Express 一键预览

```http
POST /kb/ingest/jobs/express?useLlmPlan=false&useLlmGenerate=true
Content-Type: application/json

{
  "spaceId": 900000000000000001,
  "batchNo": "batch-20260628-001",
  "topic": "FE 题库样例",
  "rawPaths": ["fe/fe_kamoku_b_set_sample_qs.md"]
}
```

| Query | 默认 | UI 控件建议 |
|-------|------|-------------|
| `useLlmPlan` | `false` | ☑「Express Plan（skeleton，1 raw → 1 create）」 |
| `useLlmGenerate` | `true` | ☑「模板入库（不调 LLM）」→ 传 `false` |

响应 `IngestExpressStartVo`：含 `job` + `prepare`（内含 `generate.templateMode`）。

已有批次时：

```http
POST /kb/ingest/jobs/{id}/prepare?useLlmPlan=false&useLlmGenerate=false
```

### 4.2 确认入库

```http
POST /kb/ingest/jobs/{id}/publish?sync=true&approveAll=true
```

`approveAll=true`：全部草稿置 `approved` → lint → commit → 可选 Sync。

### 4.3 模板模式行为

- `useLlmGenerate=false`：`generate` / `prepare` / `express` / `draft/regenerate` 均不调 LLM  
- 响应 `IngestGenerateResultVo.templateMode = true`  
- 草稿 = frontmatter + raw 正文（去掉 raw 自身 frontmatter）  
- **LLM 不可用时的降级**：自动勾选模板模式 + Toast「已降级为模板入库」

### 4.4 Expert 生成（同样支持模板）

```http
POST /kb/ingest/jobs/{id}/generate?resume=false&useLlmGenerate=false
POST /kb/ingest/jobs/{id}/draft/regenerate?slug=guides/foo&useLlmGenerate=false
```

---

## 5. nextSteps（T19 · 前端增量）

`commit` / `publish` 成功后展示 CTA 条：

```typescript
export interface KbWorkflowHintVo {
  key: string
  label: string
  description?: string
  routePath: string
  routeQuery?: Record<string, string>
}

export interface IngestCommitResultVo {
  jobId: number
  created: number
  updated: number
  files: string[]
  syncTriggered: boolean
  syncResult?: SyncTriggerVo
  nextSteps: KbWorkflowHintVo[]
}
```

| key | 跳转 |
|-----|------|
| `wiki_govern_lint` | `knowledge/wiki-govern/index?spaceId=` |
| `kb_health_scan` | `knowledge/lint/index?spaceId=` |

**组件建议**：`KbWorkflowNextSteps.vue` — 接收 `nextSteps`，渲染为按钮组。

---

## 6. raw 覆盖门禁（commit 错误处理 · I3 / B4）

> **后端契约**：[KNOWLEDGE_API.md §9 commit 门禁](KNOWLEDGE_API.md#ingest-commit-门禁) · 运维说明 [ops §2.6](KNOWLEDGE_API.md#26-ingest-commit-门禁) · 总览 [§8.3](knowledge-workbench-frontend.md#83-raw-簇引用--commit-门禁--模板降级b3--b4--i3)

`commit` / `publish` 落盘前，后端校验所选 raw 是否已被**其它** wiki 页 `sources` 引用（簇引用 / raw coverage）。冲突时返回业务错误，**接口不改**。

| 字段 | 说明 |
|------|------|
| `msg` / `message` | **必返**；纯文本，含冲突 **wiki slug** 与 **raw 路径**（例：`raw fe/xxx.md already referenced by wiki slug foo/bar`） |
| 结构化扩展 | **无** `conflictSlug` / `rawPath` 等独立字段（I4 ⏸） |
| 业务码（可选） | `ingest.rawCoverage.blocked` — 前端优先按码判定，否则回退 `message` 关键词 |

**前端处理（meiling-ui）**：

1. **Toast**：展示后端 `message` 全文  
2. **详情 `commitError` 区**：标题 `commitErrorTitle`；簇引用时副标题 `rawCoverageBlocked`，否则 `commitErrorHint`；`<pre>` 展示 `message`  
3. **引导**：改 Plan 为 `enrich` 同一 slug，或换未引用的 raw  
4. **预筛（非硬门禁）**：raw 列表 `GET /kb/ingest/raw-coverage` + 筛选 `open` / `cluster` / `covered`（**仍可选已 covered**，仅 commit 时拦截）

**实现**：`src/utils/ingestCommitError.ts` · `KnowledgeIngestWorkbenchView` `commit` / `publishExpress` catch 路径。

---

## 7. 接口速查（24 个）

完整字段见 [KNOWLEDGE_API.md §9](KNOWLEDGE_API.md#9-ingest-工作台t15)。

| 步骤 | 方法 | 路径 |
|------|------|------|
| raw 树 | GET | `/kb/ingest/raw-tree` |
| raw 覆盖 | GET | `/kb/ingest/raw-coverage` |
| 创建批次 | POST | `/kb/ingest/jobs` |
| 批次列表 | GET | `/kb/ingest/jobs` |
| 批次详情 | GET | `/kb/ingest/jobs/{id}` |
| 删批次 | DELETE | `/kb/ingest/jobs/{id}` |
| LLM Plan | POST | `/kb/ingest/jobs/{id}/plan` |
| 改 Plan | PUT | `/kb/ingest/jobs/{id}/plan` |
| 生成草稿 | POST | `/kb/ingest/jobs/{id}/generate?resume=&useLlmGenerate=` |
| 草稿列表 | GET | `/kb/ingest/jobs/{id}/drafts` |
| 单页草稿 | GET | `/kb/ingest/jobs/{id}/draft?slug=` |
| 改草稿 | PUT | `/kb/ingest/jobs/{id}/draft?slug=` |
| 重生成 | POST | `/kb/ingest/jobs/{id}/draft/regenerate?slug=&useLlmGenerate=` |
| 审批 | PUT | `/kb/ingest/jobs/{id}/draft/approval?slug=&approval=` |
| lint | POST | `/kb/ingest/jobs/{id}/lint` |
| commit | POST | `/kb/ingest/jobs/{id}/commit?sync=` |
| Express 新建 | POST | `/kb/ingest/jobs/express?useLlmPlan=&useLlmGenerate=` |
| Express 准备 | POST | `/kb/ingest/jobs/{id}/prepare?useLlmPlan=&useLlmGenerate=` |
| Express 发布 | POST | `/kb/ingest/jobs/{id}/publish?sync=&approveAll=` |
| 模板 CRUD | GET/POST/DELETE | `/kb/ingest/templates*`、`from-template`、`save-as-template` |

---

## 8. TypeScript 类型（核心）

```typescript
export interface IngestDraftVo {
  id: number
  jobId: number
  slug: string
  displaySlug: string
  kbType: string
  action: 'create' | 'enrich'
  baseline?: string
  patch?: string
  draft: string
  approval: 'draft' | 'approved' | 'rejected'
  categoryId?: number
  dirSlug?: string
  categoryName?: string
}

export interface IngestGenerateResultVo {
  jobId: number
  generated: number
  skipped: number
  failed: number
  templateMode: boolean
  drafts: IngestDraftVo[]
}

export interface IngestPublishResultVo {
  jobId: number
  commit: IngestCommitResultVo
  lint?: IngestLintVo
  nextSteps: KbWorkflowHintVo[]
}
```

`slug` 含 `/` 时一律走 **query 参数**，不要拼 path。

---

## 9. API 封装增量（`kbIngest.ts`）

```typescript
export function expressStartApi(
  data: IngestJobCreateRequest,
  opts?: { useLlmPlan?: boolean; useLlmGenerate?: boolean }
) {
  const { useLlmPlan = false, useLlmGenerate = true } = opts ?? {}
  return request.post<MoliResult<IngestExpressStartVo>>(
    `/kb/ingest/jobs/express?useLlmPlan=${useLlmPlan}&useLlmGenerate=${useLlmGenerate}`,
    data
  )
}

export function generateDraftsApi(
  jobId: number,
  opts?: { resume?: boolean; useLlmGenerate?: boolean }
) {
  const { resume = false, useLlmGenerate = true } = opts ?? {}
  return request.post<MoliResult<IngestGenerateResultVo>>(
    `/kb/ingest/jobs/${jobId}/generate?resume=${resume}&useLlmGenerate=${useLlmGenerate}`
  )
}

export function publishIngestJobApi(
  jobId: number,
  opts?: { sync?: boolean; approveAll?: boolean }
) {
  const { sync = true, approveAll = true } = opts ?? {}
  return request.post<MoliResult<IngestPublishResultVo>>(
    `/kb/ingest/jobs/${jobId}/publish?sync=${sync}&approveAll=${approveAll}`
  )
}
```

---

## 10. i18n 键建议（增量）

| 键 | 中文示例 |
|----|----------|
| `ingest.express.preview` | 一键预览 |
| `ingest.express.publish` | 确认入库 |
| `ingest.express.templateMode` | 模板入库（不调 LLM） |
| `ingest.express.skeletonPlan` | Express Plan（快速 skeleton） |
| `ingest.nextSteps.title` | 入库完成，建议下一步 |
| `ingest.rawCoverage.blocked` | 该 raw 已被其它 wiki 页引用，请 enrich 或换源 |

---

## 11. 验收清单

| 项 | 状态 | 说明 |
|----|------|------|
| Express：勾选 raw → 预览 → 详情 diff → 确认入库 | ✅ | 列表「一键预览」→ `?id=&express=1` → 详情「确认入库」（见总览 [§8.1](knowledge-workbench-frontend.md#81-express-列表一键预览--详情确认入库b1--i1)） |
| ☑ 模板入库 → `useLlmGenerate=false`，响应 `templateMode=true` | 🟡 | 列表/Express API 已传参 ✅；**Expert generate/regenerate 未联动 checkbox**；响应 `templateMode` 未在 UI badge 展示 |
| LLM 不可用时模板模式仍可用 | 🟡 | 用户可手动勾模板入库 ✅；**自动降级 + Toast 未做**（见 §13 I3） |
| publish/commit 后展示 `nextSteps` | ✅ | `KbWorkflowNextSteps` 已接入 commit / publish 成功路径 |
| 重复 ingest 已 covered raw → commit 报错可读 | ✅ | `commitError` 区 + `rawCoverageBlocked` 簇引用文案 |
| Expert：`generate?resume=true` 断点续跑 | ✅ | 已实现 |
| enrich 草稿 diff：`baseline` + `patch` | ✅ | diff / patch 标签页已有 |

---

## 12. 前端实现落点（meiling-ui · 2026-06-28）

| 项 | 实际路径 / 行为 |
|----|-----------------|
| 页面组件 | `src/views/knowledge/KnowledgeIngestWorkbenchView.vue` |
| API | `src/api/knowledge.ts`（`expressStartKbIngestApi` / `publishKbIngestApi` / `generateKbIngestDraftsApi` 等） |
| Express 选项 | 列表页：`expressSkeletonPlan` → `useLlmPlan`；`templateMode` → `useLlmGenerate` |
| Express 进度 | `src/components/knowledge/IngestExpressProgressPanel.vue`（6 步，仅请求进行中展示） |
| nextSteps 组件 | `src/components/knowledge/KbWorkflowNextSteps.vue`（commit / publish 成功路径已接入） |
| raw 虚拟树 | `src/components/knowledge/IngestRawTreeList.vue`（**未接入**，仍用页内 flat 树） |

### 12.1 与本文档的差异（实现侧说明）

1. **Express 两阶段**：列表「一键预览」仅 `expressStartKbIngestApi`，成功后导航 `?id=&express=1`；详情页 `publishKbIngestApi` 确认入库（**总览 §8.1**）。
2. **Expert 模板模式**：详情页 `generateDrafts` / `regenerateDraft` 未传 `{ useLlmGenerate: !templateMode }`（列表 Express 已传参）。

---

## 13. 需后端确认（Ingest）

| # | 问题 | 前端依赖 |
|---|------|----------|
| I1 | 列表 Express 应 **预览+人工确认** 还是 **一键直落盘**？ | **已结论：预览+确认**，见 [总览 §8.1](knowledge-workbench-frontend.md#81-express-列表一键预览--详情确认入库b1--i1) |
| I2 | `IngestCommitResultVo` / `IngestPublishResultVo.nextSteps` | **已结论**：后端返回，前端已渲染（总览 §8.2） |
| I3 | raw 簇引用失败文案 | **已结论**：`message` + 固定引导，无结构化字段（总览 §8.3） |
| I4 | commit 冲突结构化字段 | ⏸ 不需要；沿用 `message` |
| I5 | `templateMode` 字段语义 | Swagger 验 B3 |

---

## 14. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-28 | §6 对齐 KNOWLEDGE_API commit 门禁 + ops §2.6；I3/B4 已结论 |
| 2026-06-28 | 代码审计：§11 验收改状态表；新增 §12 落点、§13 后端确认 |
| 2026-06-28 | 新增前端对接文档：Express 参数、模板模式、nextSteps、raw 门禁 |
| 2026-06-25 | T15 后端交付；Expert 六步已在 KNOWLEDGE_API §9 |
