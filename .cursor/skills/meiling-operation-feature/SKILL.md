---
name: meiling-operation-feature
description: >-
  Implements or extends meiling-ui operation module (server/project/component/platform,
  deploy, relations, topology). Use for SVR-* tasks, RelationDrawer, OperationTopologyGraphView,
  operation_* permissions, or GET /operation/relations vs /operation/topology questions.
---

# meiling-ui · 运营管理

## 必读（动手前）

1. [docs/api/operation-frontend.md](../../docs/api/operation-frontend.md) §0 代码落点 · §16 SVR-25/28
2. [docs/api/user-center-api-map.md](../../docs/api/user-center-api-map.md) §4 HTTP 索引
3. [docs/frontend-gaps.md](../../docs/frontend-gaps.md) §1.1（SVR-25/28 已完成）· §1.2（剩余联调）
4. 后端仓库：`../moli-project-single`（联调 `http://127.0.0.1:8888`）

## 技术约定（勿违反）

- Vue 3 + composables（**不用 Pinia**）
- **不用 Element UI**；用 `AppModal` / `FormField` / Tailwind
- 环境枚举：`Environment` 1–4，`EnvironmentSelect` / `EnvironmentBadge`
- 权限：`src/constants/permissions.ts` → `PERM.OP_*` + `guardAction` / `assertAction`
- 密钥明文：`revealPlatformSecretApi` / `revealComponentSecretApi` + `operation:secret:view`

## 三个接口（勿混）

| 接口 | 用途 | 前端 API |
|------|------|----------|
| `GET /operation/relations/{type}/{id}` | 单实体关联 + tasks/deploy/port | `getRelationsApi` / `getServerRelationsApi` |
| `GET /operation/topology` | 全局 ECharts 全图 | `getTopologyGraphApi` |
| ~~`GET /operation/server/{id}/topology`~~ | **已删** | 勿再调用 |

单机关联 UI：`RelationDrawer.vue`（`src/components/operation/`）

## 代码落点

| 层级 | 路径 |
|------|------|
| 页面 | `src/views/operation/*ManageView.vue` · `DeployCenterView` · `OperationTopologyGraphView` |
| 组件 | `src/components/operation/`（`RelationDrawer` · chips · modals） |
| API | `src/api/operation.ts`（`createCrudApi` + 扩展） |
| 类型 | `src/types/operation.ts` |
| 工具 | `src/utils/operationTopologyGraph.ts` · `operationServerLinks.ts` · `operationHealth.ts` |
| i18n | `operation.*` in `src/i18n/locales/{zh,en,ja}.ts` |

## 新功能模式

### 列表 CRUD 页

1. `createCrudApi<T>('/operation/xxx')` 或复用已有 export
2. `reactive` query + `AppPagination` + `OperationPageHeader`
3. 行操作 `guardAction(PERM.OP_XXX_EDIT)` 等
4. 表单 `AppModal` + `FormField` + `form-grid-pairs`

### 关联 / 拓扑（SVR-25/28）

- 列表 chips：`OperationRelationChips` → `RelationDrawer`
- URL 反向过滤：`useOperationRelationListFilter` + `OperationRelationFilterChips`
- 导航页实体名：`OperationEntityLink` + `OperationRelationDrawerHost`（`showEditLinks=false`）
- 服务器编辑关联：`OperationServerRelationLinksModal`（非旧 topology API）
- 项目依赖组件：`OperationProjectComponentLinksModal`

### 异步任务

- `useOperationTaskPoll` + `DeployTaskDrawer`
- 批量探活：`useProbeAllHealth` → `probeAllHealthApi` 返回 `taskId`

## 收尾

执行 [meiling-task-closeout](../meiling-task-closeout/SKILL.md)；若改文案同步三语 [meiling-i18n-sync](../meiling-i18n-sync/SKILL.md)。可点击控件样式见 [meiling-clickable-affordance](../meiling-clickable-affordance/SKILL.md)。

## 联调

```bash
# .env.development
VITE_USE_MOCK_AUTH=false
```

代理：`vite.config.ts` → `/operation` → `8888`
