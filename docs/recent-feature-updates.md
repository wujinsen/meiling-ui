# meiling-ui 最近功能更新

> 更新：**2026-07-15** · 覆盖 `main` 近期交付（约 2026-07-10 — 2026-07-13）。  
> 缺口与验收状态见 [frontend-gaps.md](frontend-gaps.md)。

---

## 1. 知识库 · Ingest Tab3 成品导入 UI（2026-07-13）

**提交**：`86d39fe` · `refactor(kb): align wiki import panel layout with raw upload tab`

### 变更摘要

Tab3 `KbWikiImportPanel.vue` 布局与 Tab1 `KbRawUploadPanel` 对齐，解决表单过窄、文字挤叠、右侧留白过多等问题。

| 项 | 改前 | 改后 |
|----|------|------|
| 整体布局 | `kb-wiki-import-sheet` 单卡 + 自定义栅格 | `grid gap-4 lg:grid-cols-2` 左右分栏（与 Tab1 一致） |
| 文件上传 | 双列小卡片 | `app-upload-dropzone` 拖放区 + `btn-upload-pick` |
| 冲突策略 | 自定义 `kb-wiki-import-conflict-*` | 复用 `kb-raw-upload-conflict-block` + `--2` 双列 |
| 选项 | `AppCheckbox variant="option"` 四格 | 普通复选框横排/折行 |
| 已选文件 | 卡片内清除 | 与 Tab1 相同的列表 + `×` 移除 |
| 结果区 | `kb-wiki-import-aside` | 右侧 `h4` 标题 + 空状态 + 结果列表 + `KbWorkflowNextSteps` |

### 左侧表单顺序（单文件）

1. 分类（`FormField` 横向）
2. slug 冲突（FAIL / OVERWRITE）
3. Sync / Lint 复选框
4. 成品 Markdown 拖放区（支持拖拽）
5. 插图包 zip 拖放区（可选）
6. 已选 `.md` / zip 列表
7. slug / 标题 + 路径预览 + 插图警告
8. 确认导入

批量模式（多选 `.md`）隐藏 slug/标题/插图包，顶部显示批量说明。

### 代码落点

| 文件 | 说明 |
|------|------|
| `src/components/knowledge/KbWikiImportPanel.vue` | 模板与拖放逻辑 |
| `src/style.css` | 新增 `.kb-raw-upload-conflict-grid--2`（Tab3 双列冲突） |

### 联调

- 路由：`knowledge/ingest/index` → Tab **成品导入**
- API 不变：`POST /kb/wiki/page/import` · `importWikiBatchApi`
- 权限不变：editor + 可选 `kb:sync:trigger`
- 文档：[api/kb-import-entry-frontend.md](api/kb-import-entry-frontend.md) §6

---

## 2. 知识库 · P3 可选增强（2026-07-13）

**提交**：`a7b6fa9` · `689a8d1`

| 任务 | 落点 | 说明 |
|------|------|------|
| **KBOPS-2** | `KnowledgeOpsDashboardView.vue` | 首选 `GET /kb/ops/dashboard`，失败降级 3 请求 |
| **KB-LINT-1/2** | `KbLintIssuesPanel.vue` · `kbLint.ts` | 服务端分页；裸数组仅 mock/降级 |
| **KB 验收** | `npm run kb:prd` | **17/17** 全通过（含 REG-llm-off merge 探针） |

详见 [api/knowledge-ops-frontend.md](api/knowledge-ops-frontend.md) · [api/p3-optional-backend-handoff.md](api/p3-optional-backend-handoff.md)。

---

## 3. 运营管理 · W1–W10 联合走查（2026-07-13）

**提交**：`a91a74f` · `0baa350` · `507f166`

| 项 | 说明 |
|----|------|
| 自动化脚本 | `npm run op:walkthrough` API 走查 |
| W9 种子 | 双服务器 + `w9-batch-smoke` 项目显示名 |
| 验收 | W1–W10 **联合走查通过**（含部署中心 batch UI） |

| 任务 | 落点 |
|------|------|
| **DC-4** | `TaskHistoryView` 平铺/按项目分组 · `listTaskGroupsApi` |
| **DC-2/3** | `DeployCenterView` 项目优先 + 多机扇出 + 追加台账服务器 |
| **SVR-25/28/26b** | 拓扑图 · 关联抽屉 · 项目组件依赖 |

走查稿：[test/operation-w1-w10-walkthrough.md](test/operation-w1-w10-walkthrough.md) · 契约：[api/operation-frontend.md](api/operation-frontend.md)。

---

## 4. SSO · 按系统隔离菜单（2026-07-13）

**提交**：`a9df3e4` · `21c4cf4`

| 项 | 说明 |
|----|------|
| **SSO-MENU-1** | `reloadRoutesFromServer` 作为 enter/switch/守卫唯一 `getRouters` 入口 |
| 空树处理 | Q3 无菜单时重定向系统选择页 |
| 系统注册 | `SystemManageView` 搜索 + `SegmentControl` 视图切换 |
| 走查 | ✅ 通过 — [test/sso-menu-frontend-walkthrough.md](test/sso-menu-frontend-walkthrough.md) |

详见 [sso-frontend-dev-guide.md](sso-frontend-dev-guide.md) · [per-system-menu-isolation.md](per-system-menu-isolation.md)。

---

## 5. 建议验证

```powershell
# 构建
npm run build

# 知识库 PRD 验收（17 项）
npm run kb:prd

# 运营 W1–W10 API 走查
npm run op:walkthrough

# Ingest Tab3 手测
# 登录 → 知识库 → Ingest 工作台 → 成品导入
# 验证：拖放 .md、可选 zip、冲突策略、右侧结果区
```

---

## 6. 相关文档索引

| 模块 | 文档 |
|------|------|
| Ingest 三 Tab | [api/kb-import-entry-frontend.md](api/kb-import-entry-frontend.md) |
| 缺口清单 | [frontend-gaps.md](frontend-gaps.md) |
| 后端依赖汇总 | [api/frontend-backend-dependencies.md](api/frontend-backend-dependencies.md) |
| Agent 入口 | [AGENTS.md](../AGENTS.md) |
