# API 接口文档（meiling-ui 协作索引）

> **本目录**：前端同学联调入口；**HTTP 契约权威**仍在 `moli-project-distribute/docs/api/`（随后端演进）。  
> 改接口 → 先改 distribute 契约，再同步本目录摘要（若适用）。

## 平台 v1

| 文档 | 范围 |
|------|------|
| [sso-frontend-dev-guide.md](../sso-frontend-dev-guide.md) | 登录 · 门户 · 多系统 SSO |
| **[operation-frontend.md](operation-frontend.md)** | **服务器运维 · 运营管理 · meiling-ui 对接（S0–S5）** |
| [user-center-api-map.md](user-center-api-map.md) | 用户中心运维域 §4（`/operation/*` 路径与权限） |
| [server-ops-module-roadmap.md](../design/server-ops-module-roadmap.md) | 运维模块后端路线图 |
| distribute [user-center-api-map.md](../../moli-project-distribute/docs/api/user-center-api-map.md) | 用户中心 ~70 HTTP 全量 |
| distribute [gateway-routes.md](../../moli-project-distribute/docs/api/gateway-routes.md) | 网关四路由 |

## 知识库工作台

| 文档 | 用途 |
|------|------|
| [knowledge-workbench-frontend.md](knowledge-workbench-frontend.md) | 前端总览 B1–B10 |
| **[knowledge-ops-frontend.md](knowledge-ops-frontend.md)** | KB 运维 · Sync O1–O4 ✅ · T20f Tab1/3 ✅ |
| [ingest-workbench-frontend.md](ingest-workbench-frontend.md) | Ingest Tab2 |
| [kb-import-entry-frontend.md](kb-import-entry-frontend.md) | T20 Tab1/Tab3 |
| [wiki-govern-frontend.md](wiki-govern-frontend.md) | Wiki 治理 W1–W8 |
| [kb-llm-platform-frontend.md](kb-llm-platform-frontend.md) | LLM 平台 T19 |
| distribute [KNOWLEDGE_API.md](../../moli-project-distribute/docs/api/KNOWLEDGE_API.md) | `/kb/*` REST 全量 |

## 维护规则

- 运维（user-center）前端任务从 **[operation-frontend.md](operation-frontend.md)** 入手；HTTP 细节以 **[user-center-api-map.md](user-center-api-map.md) §4** 为准。
- 知识库前端任务从 [knowledge-ops-frontend.md](knowledge-ops-frontend.md) 或 [knowledge-workbench-frontend.md](knowledge-workbench-frontend.md) 入手。
- 任务结束前：`npm run build` 通过；i18n zh/en/ja 同步（若改文案）。
