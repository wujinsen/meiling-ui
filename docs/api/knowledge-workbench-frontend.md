# 知识库工作台 · 前端开发总览（meiling-ui）

> **读者**：meiling-ui 前端。后端 API **已就绪**；本文是联调入口，细节见各子文档。  
> **产品需求**：[knowledge-workbench-requirements.md](../product/knowledge-workbench-requirements.md)  
> **HTTP 契约总表**：[KNOWLEDGE_API.md](KNOWLEDGE_API.md)

---

## 1. 开发优先级

| 优先级 | 页面 | 路由 | 后端 | 前端 | 对接文档 |
|--------|------|------|------|------|----------|
| **P0** | Ingest 工作台 | `knowledge/ingest/index` | ✅ T15+T18+T19 | ✅ 已有 | [ingest-workbench-frontend.md](ingest-workbench-frontend.md) · **增量**：模板模式 / nextSteps |
| **P0** | Wiki 治理 | `knowledge/wiki-govern/index` | ✅ T16a/e/g | 🔵 **待开发** | [wiki-govern-frontend.md](wiki-govern-frontend.md) |
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
| Wiki 治理页 | `src/views/knowledge/wiki-govern/index.vue` |
| Ingest API（已有可扩展） | `src/api/knowledge/kbIngest.ts` |
| nextSteps 组件 | `src/components/knowledge/KbWorkflowNextSteps.vue`（可复用） |

菜单 SQL：`docs/sql/11_kb_wiki_govern_menu.sql`（910 · `kb:wiki:govern:list`）。

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
| Wiki 治理 | [wiki-govern-frontend.md §13](wiki-govern-frontend.md#13-验收清单前端自测) |
| Ingest 模板 / nextSteps | [ingest-workbench-frontend.md §10](ingest-workbench-frontend.md#10-验收清单) |

---

## 7. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-28 | 新增前端总览；拆分 Ingest / Wiki 治理对接文档 |
| 2026-06-27 | Wiki 治理 T16e 后端 + wiki-govern-frontend 初版 |
