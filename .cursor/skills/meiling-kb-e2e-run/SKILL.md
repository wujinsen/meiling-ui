---
name: meiling-kb-e2e-run
description: >-
  Runs meiling-ui knowledge-base E2E scripts (kb:e2e, kb:e2e:extended, kb:prd)
  against moli-knowledge-server. Use for T16f/T20f ingest联调, KB_BASE port setup,
  KB_LLM_CONFIG_SECRET, or ingest workbench Tab1/2/3 verification.
---

# meiling-ui · KB E2E 联调

## 架构

- **前端**：`meiling-ui`（本仓库）
- **KB 服务**：`../moli-project-distribute/moli-knowledge/moli-knowledge-server`（默认 `28104`）
- **user-center**：`28101`（登录 / 菜单；非 KB 脚本主依赖）

## 脚本

| 命令 | 脚本 | 用途 |
|------|------|------|
| `npm run kb:e2e` | `scripts/kb-e2e-walkthrough.mjs` | 主路径 walkthrough |
| `npm run kb:e2e:extended` | `scripts/kb-e2e-extended.mjs` | AI 写盘 · Tab3 冲突 · zhangsan 权限 |
| `npm run kb:e2e:script-fix` | `scripts/kb-e2e-script-fix.mjs` | T16f script-fix metadata |
| `npm run kb:prd` | `scripts/kb-prd-acceptance.mjs` | PRD 探针验收 |

## 启动 KB 服务（终端 1）

```powershell
cd ..\moli-project-distribute\moli-knowledge\moli-knowledge-server
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$env:KB_LLM_CONFIG_SECRET = [Convert]::ToBase64String($bytes)
mvn spring-boot:run "-Dspring-boot.run.profiles=dev" `
  "-Dspring-boot.run.workingDirectory=D:/work/moli_project/moli-project-distribute"
```

## 运行 E2E（终端 2 · meiling-ui 根目录）

```powershell
$env:KB_BASE = 'http://127.0.0.1:28104'   # 若改端口须同步
$env:KB_E2E_LLM_API_KEY = '<有效 Key>'    # 可选
npm run kb:e2e
npm run kb:e2e:extended
```

## Ingest 三 Tab 开关

| Tab | 文档 | Mock |
|-----|------|------|
| Tab2 选源入库 | [ingest-workbench-frontend.md](../../docs/api/ingest-workbench-frontend.md) | `VITE_USE_MOCK_KNOWLEDGE=false` |
| Tab1 投喂 Raw | [kb-import-entry-frontend.md](../../docs/api/kb-import-entry-frontend.md) | `VITE_MOCK_KB_IMPORT=false` |
| Tab3 成品 import | 同上 | 同上；Sync 超时 **320s** |

Tab1 权限 SQL：`../moli-project-distribute/docs/sql/16_kb_import_entry_menu.sql` → **重新登录**

## 失败排查

| 现象 | 检查 |
|------|------|
| ECONNREFUSED | `KB_BASE` 端口、KB 服务是否起来 |
| 401 / 403 | 登录 token、`kb:ingest:rawUpload` 等 perm |
| LLM 失败 | `KB_E2E_LLM_API_KEY` 或平台 LLM 配置 |
| 超时 Tab3 | 正常可至 320s；勿随意缩 HTTP timeout |

## 延伸阅读

- [AGENTS.md](../../AGENTS.md) §知识库 Ingest 三 Tab
- Ingest 功能开发：[meiling-kb-ingest-tab](../meiling-kb-ingest-tab/SKILL.md) · [ingest-workbench-frontend.md](../../docs/api/ingest-workbench-frontend.md) · [kb-import-entry-frontend.md](../../docs/api/kb-import-entry-frontend.md)
- 收尾：[meiling-task-closeout](../meiling-task-closeout/SKILL.md)
