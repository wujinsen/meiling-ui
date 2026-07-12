---
name: meiling-api-layer
description: >-
  Adds or modifies meiling-ui API modules using request(), MoliResult, snowflake IDs,
  and domain timeouts. Use when creating src/api/*.ts, wiring operation CRUD, knowledge
  KB_BASE paths, or debugging 8888 vs 8090 proxy errors.
---

# meiling-ui · API 层

## 核心：`src/api/http.ts`

```typescript
request<T>(path, { method, body, timeoutMs? }): Promise<MoliResult<T>>
```

| 行为 | 说明 |
|------|------|
| `BASE_URL` | `VITE_API_BASE_URL`（开发常为空，走 Vite 代理） |
| Auth | `Authorization: getToken()` |
| 雪花 ID | `quoteBigIntegersOutsideStrings` — ID 用 `string` 类型 |
| 成功码 | `API_SUCCESS_CODE`（检查 `result.code`） |
| 401 token | 清 session → 跳登录 |
| 403 | `showToast` 无权限 |
| 超时默认 | **8s**；超时文案区分 `/KnowledgeServer`（8090）与其它（8888） |

## 两套后端

| 前缀 | 服务 | 默认端口 |
|------|------|----------|
| `/operation` `/login` `/system` `/menu` … | user-center (moli-server) | 8888 |
| `/KnowledgeServer/kb` | moli-knowledge-server | 8090 |

知识库 API 用 `KB_BASE = '/KnowledgeServer/kb'`（`src/api/knowledge/core.ts`）。

## operation 模式

`src/api/operation.ts`：

```typescript
const server = createCrudApi<OperationServer>('/operation/server')
export const listServerApi = (params?) => server.list(params)
export const getServerApi = server.get
// add / update / remove
```

- 查询串：`buildQuery({ pageNum, pageSize, ... })`
- 长任务：`timeoutMs: 15_000`–`600_000`（upload/deploy/task）
- 类型：`src/types/operation.ts` 与 VO 对齐

## knowledge 模式

- 入口：`knowledge.ts`（聚合）或子模块 `kbIngest.ts` · `kbWiki.ts` · `kbLint.ts`
- ID 工具：`toEntityId` · `jsonEntityBody` · `buildEntityQuery`（`src/utils/id.ts`）
- Mock：`VITE_USE_MOCK_KNOWLEDGE` · `VITE_MOCK_KB_IMPORT`（见各模块 `USE_MOCK`）
- 长超时：ingest generate 300s、wiki import+sync 320s、ask 120s

## 新增 API 清单

```
- [ ] 类型：src/types/<domain>.ts
- [ ] 函数：src/api/<domain>.ts 或 knowledge 子模块
- [ ] 使用 request<T>，显式 method/body
- [ ] 分页用 PageRes / MoliPage 与后端一致
- [ ] 大整数 ID 勿用 number 运算
- [ ] 慢接口设 timeoutMs
- [ ] 视图层检查 result.code === API_SUCCESS_CODE
```

## 视图层约定

```typescript
const result = await someApi(...)
if (result.code !== API_SUCCESS_CODE || !result.data) {
  throw new Error(result.msg || t('...'))
}
```

权限门控在视图/composable，不在 `http.ts`。

## 常见错误

| 现象 | 原因 |
|------|------|
| HTML 响应 | 未反代到 8888/8090 |
| ID 精度丢失 | 未走 bigint 安全解析 |
| 8s 超时 | KB/部署接口未加大 `timeoutMs` |
| 405 | nginx 未转发 API |

## 延伸阅读

- operation 业务：[meiling-operation-feature](../meiling-operation-feature/SKILL.md)
- KB ingest：[meiling-kb-ingest-tab](../meiling-kb-ingest-tab/SKILL.md)
- 契约索引：[docs/api/README.md](../../docs/api/README.md)
