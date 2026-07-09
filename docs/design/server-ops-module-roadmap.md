# 服务器运维模块 · 演进规划（技术端运维）

> 更新：2026-07-09 · 状态：**P0 安全已落地**（SVR-1/2/3）；**P1 可观测已落地**（SVR-4/5/6）；**P2 联动已落地**（SVR-7/8 + 驾驶舱统计）  
> 归属：`moli-user-center` · `operation_*` 表 · 菜单「运营/运维管理」(id 400)  
> 边界：**只管服务器/基础设施资产运维**；知识库内容管道运维见 [knowledge-ops-frontend.md](../api/knowledge-ops-frontend.md)（另一条独立路线，互不重叠）  
> **浏览镜像**：工程契约权威仍在 `moli-project-distribute/docs/design/server-ops-module-roadmap.md`；改设计请先改 distribute 再同步本文件。

---

## 1. 背景与定位

本模块**原始设计偏技术端**：给运维/技术人员一个**基础设施资产台账**——记录"哪些平台账号、哪些服务器、哪些组件、部署在哪、什么环境"。

它**不是**知识库运维，也不是业务运营；它面向的是"机器和部署"这一层。

---

## 2. 现状（静态台账 CRUD）

### 2.1 表结构

| 表 | 用途 | 关键字段 |
|----|------|----------|
| `operation_platform_info` | 运维平台账号 | `platform_name`, `url`, `account`, `password`, `environment` |
| `operation_server_info` | 服务器 | `server_name`, `ip`, `inner_ip`, `port`, `environment` |
| `operation_component_deploy_info` | 组件部署 | `component_name`, `server_ip`, `account`, `password`, `deploy_path`, `port`, `version`, `environment` |
| `operation_project_deploy_info` | 项目部署 | `server_id`, `server_ip`, `url`, `project_name`, `deploy_path`, `port`, `environment` |
| `operation_server_project` | 服务器↔项目 N:N | `server_id`, `project_id` |
| `operation_server_component` | 服务器↔组件 N:N | `server_id`, `component_id` |

`environment`：`1 dev / 2 test / 3 pre / 4 pro`。

### 2.2 接口（`moli-user-center` · 前缀 `/operation/*`）

| Controller | 前缀 | 能力 | 权限码 |
|------------|------|------|--------|
| `OperationPlatformController` | `/operation/platform` | list/insert/update/get/remove | `operation:platform:*` |
| `OperationServerController` | `/operation/server` | 同上 + topology/check | `operation:server:*` |
| `OperationComponentController` | `/operation/component` | 同上 + secret/check | `operation:component:*` |
| `OperationProjectController` | `/operation/project` | 同上 | `operation:project:*` |

---

## 3. 现状问题（演进前）

| # | 问题 | 严重度 |
|---|------|--------|
| S-P1 | 密码明文存库 | 🔴 高 |
| S-P2 | 死台账，与真实部署脱节 | 🟡 中 |
| S-P3 | 敏感变更审计不足 | 🟡 中 |

---

## 4. 目标

1. 敏感凭据**加密存储** + 列表脱敏 + 按权限查看明文。
2. 服务器/组件**健康探测**（可达性、端口），台账带"状态灯"。
3. 部署信息与端口矩阵**对齐校验**。
4. 敏感操作**审计**闭环。

---

## 5. 路线图

### P0 —— 安全

| 任务 | 内容 | 状态 |
|------|------|------|
| **SVR-1** | AES 加密入库 + 列表脱敏 | ✅ 2026-07-09 |
| **SVR-2** | 敏感变更审计；请求参数 password 脱敏 | ✅ 2026-07-09 |
| **SVR-3** | `GET .../{id}/secret` + `operation:secret:view` | ✅ 2026-07-09 |

### P1 —— 可观测

| 任务 | 内容 | 状态 |
|------|------|------|
| **SVR-4** | TCP 探活 + `status` / `last_check_time` | ✅ 2026-07-09 |
| **SVR-5** | `GET /operation/server/{id}/topology` | ✅ 2026-07-09 |
| **SVR-6** | 前端状态灯 + 探测 + 拓扑弹窗 | ✅ 2026-07-09 · [operation-frontend.md](../api/operation-frontend.md) §5 |

### P2 —— 联动

| 任务 | 内容 | 状态 |
|------|------|------|
| **SVR-7** | 端口矩阵校验 `GET /operation/audit/port-matrix` | ✅ 2026-07-09 |
| **SVR-8** | `moli-service.sh status` 只读 + 可选 deploy:exec | ✅ 2026-07-09 |
| **SVR-9** | 驾驶舱 `GET /operation/stats` | ✅ 2026-07-09 |

---

## 6. 表与权限增量

| 类型 | 增量 |
|------|------|
| 字段 | `status`、`last_check_time` — `18_operation_health_columns.sql` |
| 权限 | `operation:secret:view`；`operation:secret:edit`；`operation:deploy:exec` — `17_*` / `20_*` / `19_*` |
| 配置 | `ops.deploy.enabled`（默认 false）、`OPS_DEPLOY_ROOT` |

---

## 7. 边界（不做）

- **不含知识库运维**（Sync / Lint / wiki / LLM）—— 见 [knowledge-ops-frontend.md](../api/knowledge-ops-frontend.md)。
- 不含业务监控大盘 / APM / 日志中心。
- 不含 CI/CD 编排。

---

## 8. 相关

- 表结构：`moli-project-distribute/docs/sql/USER_CENTER_SCHEMA.md` §2.3
- API 地图：[user-center-api-map.md](../api/user-center-api-map.md) §4
- **前端对接**：[operation-frontend.md](../api/operation-frontend.md)（枚举、TypeScript、联调 checklist、验收 S0–S5）
- 加密参考：`moli-project-distribute/docs/design/kb-llm-platform-settings.md` §3.3
