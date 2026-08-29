---
name: meiling-kb-ingest-tab
description: >-
  Develops or debugs meiling-ui Knowledge Ingest workbench three tabs (raw upload,
  ingest jobs, wiki import). Use for Tab1/Tab2/Tab3, kb:ingest:rawUpload, raw-upload,
  wiki page import, VITE_MOCK_KB_IMPORT, or KnowledgeIngestWorkbenchView changes.
---

# meiling-ui · Ingest 三 Tab

## 必读

1. [docs/api/kb-import-entry-frontend.md](../../docs/api/kb-import-entry-frontend.md) — Tab1/3 契约
2. [docs/api/ingest-workbench-frontend.md](../../docs/api/ingest-workbench-frontend.md) — Tab2 Expert/Express
3. [AGENTS.md](../../AGENTS.md) §知识库 Ingest 三 Tab

## 页面

| 项 | 值 |
|----|-----|
| 路由 | `knowledge/ingest/index`（**不新开路由**） |
| 视图 | `src/views/knowledge/KnowledgeIngestWorkbenchView.vue` |
| 菜单 | 906 · `kb:ingest:list` |

## 三 Tab

| Tab | 面板 | API 模块 | Mock 开关 |
|-----|------|----------|-----------|
| **Tab1 投喂 Raw** | `KbRawUploadPanel` | `src/api/knowledge/kbIngest.ts` → `raw-upload` | `VITE_MOCK_KB_IMPORT` |
| **Tab2 选源入库** | 现有 Ingest UI | `kbIngest.ts` jobs/plan/generate/commit | `VITE_USE_MOCK_KNOWLEDGE` |
| **Tab3 成品导入** | `KbWikiImportPanel` | `src/api/knowledge/kbWiki.ts` → `page/import` | `VITE_MOCK_KB_IMPORT` |

网关前缀：`/KnowledgeServer/kb`（`kbIngest.ts` / `core.ts` 中 `KB_BASE`）

## 权限

| 能力 | 权限 | 备注 |
|------|------|------|
| Tab1 上传 | `kb:ingest:rawUpload` + 空间 editor | SQL：`../moli-project-distribute/docs/sql/16_kb_import_entry_menu.sql` |
| Tab2 | `kb:ingest:list` 等既有 | 见 ingest-workbench 文档 |
| Tab3 导入 | `kb:wiki:edit` + editor | 勾选 Sync 需 `kb:sync:trigger` |
| 无 rawUpload | Tab1 **只读** + 提示 | `assertAction` 后仍须 **重新登录** |

## Tab 联动

Tab1 上传成功 → emit 切 Tab2 并高亮 raw：

```typescript
emit('switch-tab', 'ingest', {
  highlightRawPaths: ['prefix/file.md'],
  expandPrefix: 'prefix',
})
```

## 超时（勿随意缩短）

| 操作 | timeoutMs |
|------|-----------|
| Tab3 import + Sync | **320_000** |
| Tab3 import 无 Sync | 60_000 |
| Ingest generate/express | 120_000–300_000 |
| raw-upload zip | 120_000 |

见 `kbWiki.ts` `importWikiPageApi`、`kbIngest.ts`。

## 开发清单

```
- [ ] 空间选择器三 Tab 共享 spaceId
- [ ] Tab1：FormData 上传 + prefix 校验 + 权限门控
- [ ] Tab2：不破坏既有 job 状态机 created→planned→reviewing→committed
- [ ] Tab3：分类选择 + onConflict + 可选 Sync → KbWorkflowNextSteps
- [ ] 文案三语：meiling-i18n-sync
- [ ] E2E：meiling-kb-e2e-run
```

## 联调

```bash
# .env.development
VITE_USE_MOCK_KNOWLEDGE=false
VITE_MOCK_KB_IMPORT=false
```

KB 服务：`28104`（见 `meiling-kb-e2e-run`）

## 常见错误

| 现象 | 检查 |
|------|------|
| Tab1 按钮灰 | `kb:ingest:rawUpload` + 重新登录 |
| Tab3 超时 | Sync 勾选 → 320s 正常 |
| raw 树空 | KB 服务、prefix、raw-upload 是否成功 |
