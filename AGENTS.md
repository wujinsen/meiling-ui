# AGENTS — meiling-ui

## 协作入口

做 **多系统 SSO / 系统门户 / 系统注册管理** 相关需求时，**必须先阅读**：

- [docs/sso-frontend-dev-guide.md](docs/sso-frontend-dev-guide.md)（中文完整说明）
- [docs/sso-frontend-dev-guide.en.md](docs/sso-frontend-dev-guide.en.md)（英文摘要）
- **SSO-MENU-1 开工**：[docs/api/sso-menu-frontend-handoff.md](docs/api/sso-menu-frontend-handoff.md) · 走查 [docs/test/sso-menu-frontend-walkthrough.md](docs/test/sso-menu-frontend-walkthrough.md)
- Agent Skill：`.cursor/skills/meiling-sso-system-page/SKILL.md`

做 **运营管理 `operation_*`**（服务器/项目/组件/部署/拓扑/关联）相关需求时，**必须先阅读**：

- [docs/api/operation-frontend.md](docs/api/operation-frontend.md) §0（代码落点）
- Agent Skill：`.cursor/skills/meiling-operation-feature/SKILL.md`

做 **知识库 Ingest 三 Tab / 导入入口** 相关需求时，**必须先阅读**：

- [docs/api/kb-import-entry-frontend.md](docs/api/kb-import-entry-frontend.md)
- Agent Skill：`.cursor/skills/meiling-kb-ingest-tab/SKILL.md`

后端仓库：`../moli-project-single`（moli-admin，模块名 `moli-server`）。  
运营管理 **前端交付给后端**：[docs/api/operation-frontend-handoff.md](docs/api/operation-frontend-handoff.md)  
**跨模块后端依赖汇总**（运营 + KB + SSO）：[docs/api/frontend-backend-dependencies.md](docs/api/frontend-backend-dependencies.md)

## 技术约定

- Vue 3 + Vite + TypeScript + Tailwind
- 状态：composables，不用 Pinia
- 不用 Element UI
- API 代理见 `vite.config.ts` → `http://127.0.0.1:28101`（知识库 `28104`，网关 `28100`，AIOps `28105`）
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

### T16f / T20f 端到端联调脚本

```powershell
# 1) 启动 knowledge-server（28104；被占用时可改端口并设 KB_BASE）
cd ..\moli-project-distribute\moli-knowledge\moli-knowledge-server
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$env:KB_LLM_CONFIG_SECRET = [Convert]::ToBase64String($bytes)
mvn spring-boot:run "-Dspring-boot.run.profiles=dev" `
  "-Dspring-boot.run.workingDirectory=D:/work/moli_project/moli-project-distribute"

# 2) 在 meiling-ui 根目录（另开终端）
$env:KB_BASE = 'http://127.0.0.1:28104'   # 若改端口则同步
$env:KB_E2E_LLM_API_KEY = '<有效智谱/DeepSeek Key>'  # 可选，默认 dev yml 占位
npm run kb:e2e
npm run kb:e2e:extended   # T16f AI 写盘 · Tab3 冲突 · zhangsan rawUpload 权限
npm run kb:e2e:script-fix # T16f script-fix metadata（PUT 植入 → 写盘 → relint）
```

覆盖：平台 LLM 测试/入库 → T16f lint/merge-hint → T20f Tab1 raw → Tab2 express+publish（`nextSteps`）→ Tab3 成品 import。扩展脚本另验 AI 写盘、`onConflict=FAIL` 冲突、`zhangsan` 无 `kb:ingest:rawUpload`。

### KBOPS-9 运维看板

- 路由：`/knowledge/ops/dashboard` · 权限 `kb:ops:dashboard`
- 菜单 SQL：`docs/sql/13_kb_ops_dashboard_menu.sql`
- 设计：`docs/api/knowledge-ops-frontend.md` §8

## 迭代清单

任务结束前执行 Skill：`.cursor/skills/meiling-task-closeout/SKILL.md`，或手动核对：

- [ ] `npm run build` 通过
- [ ] i18n zh / en / ja 同步（若改了文案）
- [ ] 不破坏登录 → 选系统 → 进入 → 切换 流程
- [ ] 前端缺口见 [docs/frontend-gaps.md](docs/frontend-gaps.md)

## Agent Skills（项目级）

| Skill | 用途 |
|-------|------|
| `meiling-add-menu-page` | 新菜单：SQL + viewRegistry + 视图 + i18n + 权限 |
| `meiling-operation-feature` | 运营管理模块开发与 SVR-* |
| `meiling-i18n-sync` | zh / en / ja 文案同步 |
| `meiling-task-closeout` | 构建、冒烟、缺口文档收尾 |
| `meiling-kb-e2e-run` | KB E2E 脚本与 Ingest 联调 |
| `meiling-kb-ingest-tab` | Ingest 工作台 Tab1/2/3 开发与权限 |
| `meiling-sso-system-page` | SSO 门户、系统注册、用户分配 |
| `meiling-api-layer` | `request()` / CRUD / KB 超时与 ID |
