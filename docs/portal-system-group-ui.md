# 选系统页分组 — 前端改造说明

> 后端规范：`../../moli-project-single/docs/portal-system-group.md`  
> **分类与常见系统目录：** `../../moli-project-single/docs/portal-system-group-catalog.md`  
> 联调前置：测试库执行 `moli-project-single/sql/patch_sys_system_group.sql`

## 改什么


| 页面    | 文件                                           | 要点                           |
| ----- | -------------------------------------------- | ---------------------------- |
| 选系统   | `SystemSelectView.vue`                       | 按 `systemGroup` 分段展示卡片，空组不渲染 |
| 系统注册  | `SystemManageView.vue`                       | 列表列 + 筛选 + 表单下拉「门户分组」        |
| 类型/常量 | `types/system.ts`、`constants/systemGroup.ts` | 见下文                          |
| 文案    | `i18n/locales/zh.ts` 等                       | `system.portal.group.`*      |


**不改：** `enter`/`switch`、外链跳转、侧栏菜单、`getRouters`。

## 演示数据（38 个系统，7 个分组）

执行：`mysql -u root -p moli < moli-project-single/sql/seed_sys_system_portal_demo.sql`  
完整清单：`moli-project-single/docs/portal-system-group-catalog.md`

- **业务应用（10）：** crm-demo、ecom-mall、ecom-order、ecom-product、ecom-inventory、ecom-payment、member-center、points-center、cs-ticket、user-growth（用户增长归 business）
- **技术类平台（8）：** api-portal … code-repo
- **运维与保障（7）：** moli-ops … k8s-console
- **数据平台（10）：** bi-report、metric-platform、data-map、user-cdp、data-warehouse、data-dev、flink-studio、data-quality、data-governance、realtime-lake
- 其余每组 1 个：moli-admin、ai-copilot、oa-office

superadmin 选系统页：**7 段分组、38 张卡片**。

## 接口

- `GET /system/my` → `SystemVo.systemGroup`
- `GET /system/list` → query `systemGroup`
- `POST/PUT /system` → body `systemGroup`
- 空/缺省 → 当 `business`

## 分组（7 类，顺序写死）

```
governance → business → ai → tech → ops → data → office
```


| key          | 标题    | 典型系统             |
| ------------ | ----- | ---------------- |
| `governance` | 管理与治理 | moli-admin       |
| `business`   | 业务应用  | CRM              |
| `ai`         | AI 应用 | 大模型、Copilot、智能体  |
| `tech`       | 技术类平台 | API 网关、低代码       |
| `ops`        | 运维与保障 | 监控、发布            |
| `data`       | 数据平台  | BI、数仓、指标、大数据开发平台 |
| `office`     | 办公协同  | OA               |


`data` 含大数据开发/分析类产品；纯集群运维归 `ops`；AI 归 `ai` 不归 `data`。

## UI 规则

1. 无系统的分组 **不显示标题**
2. 组内顺序跟 `GET /system/my` 返回顺序（按 `sort`）
3. `ssoMode=EXTERNAL` → 角标「外链」；`isDefault` → 角标「默认」（可选）
4. 点击仍 `enterSystem(id)`

## 常量（`constants/systemGroup.ts`）

```ts
export const SYSTEM_GROUP_ORDER = [
  'governance', 'business', 'ai', 'tech', 'ops', 'data', 'office',
] as const
```

分组逻辑：`groupPortalSystems(list)` — 按 `SYSTEM_GROUP_ORDER` 过滤非空组。

## i18n（`system.portal.group`）


| key        | zh    |
| ---------- | ----- |
| governance | 管理与治理 |
| business   | 业务应用  |
| ai         | AI 应用 |
| tech       | 技术类平台 |
| ops        | 运维与保障 |
| data       | 数据平台  |
| office     | 办公协同  |


管理页：`system.manage.systemGroup`、`systemGroupAll`。

## 验收

- [ ] 选系统页分段展示，非平铺
- [ ] 空组（如暂无 AI 系统）不出现「AI 应用」标题
- [ ] 系统注册可维护/筛选分组
- [ ] 进入/切换/外链行为不变
- [ ] `npm run build` 通过