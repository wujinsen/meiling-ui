---
name: meiling-clickable-affordance
description: >-
  Strengthens clickable UI affordances in meiling-ui: bordered buttons, toggle chips,
  hover/focus rings, cursor-pointer. Use when adding refresh/toolbar actions, filter chips,
  dropdown list items, entity links, or when users report controls looking like plain text.
---

# meiling-ui · 可点击视觉强化

## 原则

1. **可点击 ≠ 纯文字**——需边框/背景/阴影至少其一，并有 `hover` + `focus-visible` 反馈
2. **`cursor-pointer`**——`button`、链接式 chip、下拉项、卡片内操作
3. **状态可辨**——切换类控件用 on/off 两套样式 + `aria-pressed`
4. **i18n 先于 `t()`**——文案 key 须在三语存在，避免界面露出 `operation.common.refresh` 这类裸 key（见 [meiling-i18n-sync](../meiling-i18n-sync/SKILL.md)）

## 样式落点（`src/style.css`）

| 场景 | 类名 | 用途 |
|------|------|------|
| 主/次按钮 | `btn-primary` · `btn-secondary` · `btn-ghost` | 表单、弹窗、通用操作 |
| 工具栏按钮组 | `toolbar-actions` + 内嵌 `btn-primary` / `btn-ghost` | 列表页头部成组操作 |
| 工具栏独立刷新 | `operation-toolbar-refresh` | 卡片工具栏内刷新/重载（勿用无描边 `btn-ghost` 单独放工具栏） |
| 行内操作 | `btn-action` · `btn-action-edit` · `btn-action-danger` | 表格行按钮 |
| 可切换筛选 chip | `operation-toggle-chip` + `operation-toggle-chip--off` | 拓扑节点/关系类型、图例开关 |
| 只读筛选标签 | `operation-relation-filter-chip` | URL 反向过滤（带 × 清除） |
| 实体链接 | `operation-linked-server-link` · `operation-entity-link` | 服务器/项目/组件跳转 |
| 下拉选项 | `operation-topology-entity-search__item` | 搜索建议列表项（左描边 hover） |

## 选用指南

```
需要用户明确「这是按钮」？
  ├─ 工具栏次要操作（刷新）→ operation-toolbar-refresh
  ├─ 成组 CRUD → toolbar-actions
  ├─ 开/关筛选、图例 → operation-toggle-chip（off 加 --off）
  ├─ 列表行编辑/删除 → btn-action-*
  ├─ 跳转另一实体 → operation-entity-link / operation-linked-server-link
  └─ 下拉/搜索命中项 → 专用 __item 类 + border-l hover
```

## 实现检查清单

- [ ] `type="button"`（非提交场景）
- [ ] `disabled` 时 `cursor-not-allowed` + 降低透明度
- [ ] 切换 chip：`aria-pressed` 绑定激活态
- [ ] 暗色模式：每类均有 `dark:` 变体
- [ ] 新 key 同步 `zh` / `en` / `ja`
- [ ] `npm run build` 通过

## 参考实现

- 拓扑页：`src/views/operation/OperationTopologyGraphView.vue`（刷新 + 节点/关系 chip + 实体搜索）
- 关联过滤：`src/components/operation/OperationRelationFilterChips.vue`
- 运营模块总览：[meiling-operation-feature](../meiling-operation-feature/SKILL.md)

## 收尾

执行 [meiling-task-closeout](../meiling-task-closeout/SKILL.md)。
