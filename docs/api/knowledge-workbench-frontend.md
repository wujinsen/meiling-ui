# 知识库工作台 · 前端开发总览（meiling-ui）

> **读者**：meiling-ui 前端。后端 API **已就绪**；本文是联调入口，细节见各子文档。  
> **产品需求**：[knowledge-workbench-requirements.md](../product/knowledge-workbench-requirements.md)  
> **HTTP 契约总表**：[KNOWLEDGE_API.md](KNOWLEDGE_API.md)

---

## 1. 开发优先级

| 优先级 | 页面 | 路由 | 后端 | 前端 | 对接文档 |
|--------|------|------|------|------|----------|
| **P0** | Ingest 工作台 | `knowledge/ingest/index` | ✅ T15+T18+T19 | 🟡 **主流程已有，T19 增量未接完** | [ingest-workbench-frontend.md](ingest-workbench-frontend.md) · 见 §12–§13 |
| **P0** | Wiki 治理 | `knowledge/wiki-govern/index` | ✅ T16a/e/g · T16f 待开发 | 🟡 **§8 主流程已有， polish 未接完** | [wiki-govern-frontend.md](wiki-govern-frontend.md) · 见 §14–§15 |
| P1 | Wiki 编辑 | `knowledge/wiki/edit` | ✅ T14 | ✅ 已有 | KNOWLEDGE_API §8 |
| P1 | 健康体检 | `knowledge/lint/index` | ✅ | ✅ 已有 | KNOWLEDGE_API §4 |

**网关前缀**：`{VITE_API_BASE_URL}/KnowledgeServer` + 下表路径（如 `/kb/wiki/lint-space`）。

---

## 2. 两条主链路（勿混淆）

### 2.1 Ingest — 投喂 **新 raw**

```
选 raw → Plan → 生成草稿 → diff 审阅 → lint → commit → (Sync) → nextSteps
```

- **Expert**：六步逐步操作  
- **Express**：`POST .../express` 一键预览 → `POST .../publish` 确认入库  
- **模板模式**：`useLlmGenerate=false`（raw 直贴，不调 LLM）

### 2.2 Wiki 治理 — 修 **已有 wiki 页**

```
选空间 → lint-space（文件真值）→ script-fix / ai-batch-fix / auto-fix → (Sync)
```

- **不要**在治理页做批量 `POST /kb/wiki/enrich`（会 append 章节，不能修 metadata/断链）  
- `dup_slug` → `merge-hint` 复制 Cursor 指令 + 跳转单页编辑

---

## 3. 共享能力

### 3.1 空间选择器

复用 `KbSpaceSelector` + `useKbSpace.ts`；所有写操作需空间 **editor**。

### 3.2 nextSteps（入库 / Sync 后 CTA）

`commit` / `publish` / `sync` 响应含 `nextSteps: KbWorkflowHintVo[]`：

```typescript
export interface KbWorkflowHintVo {
  key: 'wiki_govern_lint' | 'kb_health_scan' | string
  label: string
  description?: string
  routePath: string          // 如 knowledge/wiki-govern/index
  routeQuery?: Record<string, string>  // 如 { spaceId: '900...' }
}
```

渲染：遍历 `nextSteps`，`router.push({ path: hint.routePath, query: hint.routeQuery })`。

### 3.3 脚本 vs LLM

| 能力 | LLM | 文档 |
|------|-----|------|
| Ingest Plan | 可选（Express 默认 skeleton） | ingest-workbench §4 |
| Ingest 正文 | 默认是；模板模式否 | [knowledge-ingest-template-mode.md](../test/knowledge-ingest-template-mode.md) |
| Wiki 治理 metadata | 否（script-fix） | wiki-govern §8 |
| Wiki 治理断链/孤儿 | 是（ai-batch-fix） | wiki-govern §8 |

矩阵：[knowledge-script-vs-llm-matrix.md](../test/knowledge-script-vs-llm-matrix.md)

---

## 4. 建议代码落点（meiling-ui）

| 模块 | 建议路径 |
|------|----------|
| Wiki 治理 API | `src/api/knowledge/kbWikiGovern.ts` |
| Wiki 治理类型 | `src/types/knowledge/kbWikiGovern.ts` |
| Wiki 治理页 | `src/views/knowledge/KnowledgeWikiGovernView.vue`（实际落点） |
| Ingest 页 | `src/views/knowledge/KnowledgeIngestWorkbenchView.vue` |
| Ingest / 治理 API | `src/api/knowledge.ts`（文档建议拆分 `kbIngest.ts` / `kbWikiGovern.ts`，当前未拆） |
| nextSteps 组件 | `src/components/knowledge/KbWorkflowNextSteps.vue`（**已建，待接入 Ingest 页**） |

菜单 SQL：Wiki 治理菜单 910 · `kb:wiki:govern:list`（后端/运维 SQL 见 moli-server；本仓库暂无 `docs/sql/11_kb_wiki_govern_menu.sql`）。

---

## 5. 联调环境

1. 启动 `moli-knowledge-server` + 网关  
2. 配置 `kb.llm`（AI 修复 / Ingest LLM 需要）  
3. 部署机可执行 `kb/tools/lint.py`（治理 Lint 依赖）  
4. 测试空间：`enterprise-kb` / `wiki-jp-exam` / `wiki-ops`

---

## 6. 验收分工

| 页面 | 文档章节 |
|------|----------|
| Wiki 治理 | [wiki-govern-frontend.md §13](wiki-govern-frontend.md#13-验收清单前端自测) · [§15 后端确认](wiki-govern-frontend.md#15-需后端确认wiki-治理) |
| Ingest 模板 / nextSteps | [ingest-workbench-frontend.md §11](ingest-workbench-frontend.md#11-验收清单) · [§13 后端确认](ingest-workbench-frontend.md#13-需后端确认ingest) |
| 总览 / 后端问题汇总 | [§7.3 需后端确认](knowledge-workbench-frontend.md#73-需后端确认--联调约定问后端用) |

---

## 7. 前端实现进度摘要（2026-06-28 代码审计）

> 细节与验收勾选见子文档：**Ingest §11–§13**、**Wiki 治理 §13–§15**。本节供与后端对齐「还差什么」。

### 7.1 已落地（可联调）

| 模块 | 能力 |
|------|------|
| **Ingest Expert** | Plan → generate（含 resume）→ diff/patch 审阅 → lint → commit/sync |
| **Ingest Express** | 列表 `express` 选项（skeleton Plan / 模板入库）；详情 `?express=1` + `publish`；6 步进度 UI |
| **Ingest 其它** | raw-tree / raw-coverage、批次与模板 CRUD、落盘预览 |
| **Wiki 治理 §8** | lint-space、三按钮修复、merge-hint 复制、auto-fix 摘要 + Sync 勾选、③ 复检栏 |

### 7.2 前端待办（不阻塞后端，meiling-ui 内补）

| 优先级 | 模块 | 项 |
|--------|------|-----|
| P0 | Ingest | `commit` / `publish` 后渲染 `nextSteps`（组件已有） |
| P0 | Ingest | Expert `generate` / `draft/regenerate` 传 `useLlmGenerate`（与模板 checkbox 联动） |
| P0 | Ingest | commit/raw 冲突专用错误区（不只 toast） |
| P1 | Ingest | 列表 Express 是否改为「预览 → 跳详情 diff → 确认入库」（**见 §8 需产品/后端确认**） |
| P1 | Ingest | LLM 不可用自动降级模板模式 + Toast |
| P1 | Wiki | Fix 结果 `pages[]` 表格；merge-hint 展示 `manualSteps` / `relatedSlugs` |
| P1 | Wiki | 页内旁路：跳转 Ingest / 健康体检 |
| P2 | 共用 | `IngestRawTreeList.vue` 接入；API 文件拆分 |

### 7.3 需后端确认 / 联调约定（问后端用）

| # | 主题 | 问题 | 影响 |
|---|------|------|------|
| B1 | **Express 列表行为** | 产品期望列表「一键入库」是 **A)** `express` 后跳详情 diff 再 `publish`，还是 **B)** 当前实现的 `express`+`publish` 一次完成？ | 前端流程与验收 §11 第一条 |
| B2 | **nextSteps 契约** | `commit` / `publish` 响应是否**稳定返回** `nextSteps[]`？`routePath` / `routeQuery.spaceId` 格式是否与前端路由一致（`knowledge/wiki-govern/index`）？ | T19 CTA 跳转 |
| B3 | **模板模式降级** | LLM 不可用时后端是否 **自动** `useLlmGenerate=false` 并设 `templateMode=true`？还是仅 HTTP 报错由前端重试？ | §4.3 降级 UX |
| B4 | **commit 冲突错误体** | raw 已被其它 wiki `sources` 引用时，错误 `message` 是否含 **冲突 slug + raw 路径** 结构化字段？还是仅纯文本？ | 专用错误 UI |
| B5 | **merge-hint 字段** | `merge-hint` 对 `dup_slug` / `dup_content` / `near_dup` 是否保证返回 `cursorPrompt`、`manualSteps`、`relatedSlugs`、`canonicalSlug`？ | 治理页 merge 详情展示 |
| B6 | **auto-fix relint** | `auto-fix` 的 `relintAfter=true` 时，`issuesAfter` 与 `relint.issues.length` 是否始终一致？`syncAfter=true` 时 `sync` 对象字段是否与 `SyncTriggerVo` 一致？ | 摘要展示 |
| B7 | **script/ai 单步修复** | 单独 `script-fix` / `ai-batch-fix` **不**带 relint 是否为预期？前端是否应在成功后自动再调一次 `lint-space`？ | ③ 复检栏数据 |
| B8 | **govern/options** | `scriptFixableKinds` / `aiFixableKinds` / `manualOnlyKinds` 是否与 `WikiGovernKindUtil` / `lint.py` **同源**？`slug_mismatch` 必须在 script 不在 manual？ | 勾选与 badge |
| B9 | **T16f** | T16f 计划能力有哪些？是否影响当前 §8 接口或新增前端面板？ | 排期 |
| B10 | **菜单 SQL** | Wiki 治理菜单 910 的正式 SQL 脚本路径（本仓库是否应拷贝一份 `docs/sql/`）？ | 运维部署 |

---

## 8. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-28 | 审计：更新 P0 前端状态；新增 §7 进度摘要与后端确认清单 |
| 2026-06-28 | 新增前端总览；拆分 Ingest / Wiki 治理对接文档 |
| 2026-06-27 | Wiki 治理 T16e 后端 + wiki-govern-frontend 初版 |
