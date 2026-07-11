# 端口矩阵管理 · HTTP API 契约（SVR-21）

> **状态**：已实现 · **更新**：2026-07-11  
> **服务**：`moli-user-center-server` · 前缀 `/operation/port-matrix`  
> **设计**：[operation-port-matrix-config.md](../../moli-project-distribute/docs/design/operation-port-matrix-config.md)  
> **审计只读**（不变）：`GET /operation/audit/port-matrix` · 权限 `operation:project:list`  
> **前端**：[`operation-frontend.md`](operation-frontend.md) §14 · `PortMatrixManageView`

---

## 1. 权限

| perm_code | 用途 |
|-----------|------|
| `operation:port-matrix:list` | 菜单 406、列表、详情 |
| `operation:port-matrix:add` | `POST` 新增（需与 `list` AND） |
| `operation:port-matrix:edit` | `PUT` 更新（需与 `list` AND） |
| `operation:port-matrix:remove` | `DELETE` 删除（需与 `list` AND） |

菜单：`sys_menu.id = 406`，父级 400「运营管理」。  
迁移：[`24_operation_port_matrix.sql`](../../moli-project-distribute/docs/sql/24_operation_port_matrix.sql)。

---

## 2. 数据类型

### 2.1 `OperationPortMatrixVo`（列表/详情）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | long | 主键 |
| `matrixKey` | string | 如 `user-center` |
| `displayName` | string | 展示名 |
| `expectedPort` | string | 期望端口 |
| `aliases` | string[] | 别名列表（不含 matrixKey） |
| `sortOrder` | int | 排序 |
| `enabled` | boolean | 是否启用 |
| `source` | string | 来源 |
| `remark` | string | 备注 |
| `createTime` / `updateTime` | string | ISO 或 `yyyy-MM-dd HH:mm:ss` |

### 2.2 `OperationPortMatrixSaveRequest`（新增/更新）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | long | 更新必填 | 新增不传 |
| `matrixKey` | string | 是 | 新增必填；**更新不可改** |
| `displayName` | string | 否 | |
| `expectedPort` | string | 是 | `1..65535` |
| `aliases` | string[] | 否 | 全量替换；去重、归一化后存储 |
| `sortOrder` | int | 否 | 默认 0 |
| `enabled` | boolean | 否 | 默认 true |
| `source` | string | 否 | 默认 `ops-console` |
| `remark` | string | 否 | |

### 2.3 列表查询参数

| 参数 | 说明 |
|------|------|
| `pageNum` / `pageSize` | 分页 |
| `matrixKey` | 模糊 |
| `displayName` | 模糊 |
| `enabled` | `true` / `false` / 不传=全部 |

---

## 3. 接口一览

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/operation/port-matrix/list` | `list` | 分页列表 |
| GET | `/operation/port-matrix/{id}` | `list` | 单条详情 |
| POST | `/operation/port-matrix` | `add` + `list` | 新增 |
| PUT | `/operation/port-matrix` | `edit` + `list` | 更新 |
| DELETE | `/operation/port-matrix/{ids}` | `remove` + `list` | 批量删除，逗号分隔 |

矩阵变更后服务端自动 `refresh` 内存缓存，**无需**单独刷新接口。

---

## 4. 与审计 API 的关系

`GET /operation/audit/port-matrix` 仍由 `OperationAuditController` 提供。

变更矩阵后无需重启 user-center，可立即调用审计 API 验证 `portMatchStatus`。

---

## 5. 前端 API 模块（meiling-ui）

见 `src/api/operation.ts`：`listPortMatrixApi` · `getPortMatrixApi` · `addPortMatrixApi` · `updatePortMatrixApi` · `deletePortMatrixApi`。

类型见 `src/types/operation.ts`：`OperationPortMatrix` · `PortMatrixSaveRequest` · `PortMatrixQuery`。
