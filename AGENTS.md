# AGENTS — meiling-ui

## 协作入口

做 **多系统 SSO / 系统门户 / 系统注册管理** 相关需求时，**必须先阅读**：

- [docs/sso-frontend-dev-guide.md](docs/sso-frontend-dev-guide.md)（中文完整说明）
- [docs/sso-frontend-dev-guide.en.md](docs/sso-frontend-dev-guide.en.md)（英文摘要）

后端仓库：`../moli-project-single`（moli-admin，模块名 `moli-server`）。

## 技术约定

- Vue 3 + Vite + TypeScript + Tailwind
- 状态：composables，不用 Pinia
- 不用 Element UI
- API 代理见 `vite.config.ts` → `http://127.0.0.1:8888`
- 联调：`VITE_USE_MOCK_AUTH=false`

## 知识库 Ingest 三 Tab 联调

| Tab | 文档 | 联调方式 |
|-----|------|----------|
| Tab2 选源入库 | [docs/api/ingest-workbench-frontend.md](docs/api/ingest-workbench-frontend.md) | 后端已就绪，`VITE_USE_MOCK_KNOWLEDGE=false` 直联 |
| Tab1 投喂 Raw | T20a · `POST /kb/ingest/raw-upload` | `.env.development` 默认 `VITE_MOCK_KB_IMPORT=false` 直联；后端未就绪时可改 `true` |
| Tab3 成品导入 | T20b · `POST /kb/wiki/page/import` | 同上；带 Sync 时 HTTP 超时 320s |

Tab3 权限：空间 **editor** + 内嵌 Sync 需 `kb:sync:trigger`（默认勾选 Sync；无 trigger 权限时仅落盘不 Sync）。

### Tab1 权限种子（DBA / 运维）

在已有库、`08_kb_ingest_workbench.sql` 之后执行：

`../moli-project-distribute/docs/sql/16_kb_import_entry_menu.sql`

- 新增动作 `kb:ingest:rawUpload`，挂菜单 **906** Ingest 工作台
- 默认授权角色 **2**（系统管理员）、**3**（研发）
- **执行后相关用户须重新登录**，前端 `assertAction` 才会拿到新 perm
- 无权限时 Tab1 **只读** + 提示（见 [docs/api/kb-import-entry-frontend.md](docs/api/kb-import-entry-frontend.md) §5.4）
- 产品背景：`../moli-project-distribute/docs/product/knowledge-import-entry-prd.md`
- 流程图：`../moli-project-distribute/docs/diagrams/png/moli-kb-import-entry.png`

## 迭代清单

任务结束前：

- [ ] `npm run build` 通过
- [ ] i18n zh / en / ja 同步（若改了文案）
- [ ] 不破坏登录 → 选系统 → 进入 → 切换 流程
