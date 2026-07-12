---
name: meiling-i18n-sync
description: >-
  Syncs meiling-ui vue-i18n keys across zh, en, and ja locale files. Use when adding
  or changing t('operation.*'), t('knowledge.*'), t('system.*') strings, UI copy,
  menu titleKey, or any user-visible text in views and components.
---

# meiling-ui · i18n 三语同步

## 文件

| 语言 | 路径 |
|------|------|
| 中文 | `src/i18n/locales/zh.ts` |
| 英文 | `src/i18n/locales/en.ts` |
| 日文 | `src/i18n/locales/ja.ts` |

入口：`src/i18n/index.ts`（`AppLocale = 'zh' | 'en' | 'ja'`）

## 规则

1. **三文件同路径、同 key 结构**——改 `zh` 必须同步 `en` + `ja`
2. 使用 **嵌套对象**，与现有域一致：`operation` · `knowledge` · `system` · `app`
3. 模板插值用 `{name}` / `{n}`，三语占位符名一致
4. 菜单 `meta.titleKey` 指向的 key 必须在三语中存在
5. 不要只改单语；不要改 `i18n/index.ts` 除非增删语言

## 工作流

```
1. 在 zh.ts 定位同级 key（如 operation.relations.drawerTitle）
2. 在 en.ts / ja.ts 同路径添加或更新
3. 视图里 useI18n() → t('operation.xxx')
4. npm run build（vue-tsc 会报缺失引用）
```

## 域索引（约略行号，以 grep 为准）

| 域 | 用途 |
|----|------|
| `app` | 应用标题 |
| `knowledge.*` | 知识库全模块 |
| `system.*` | RBAC / 菜单 / 用户 |
| `operation.*` | 运营管理 |

新增 key 放在**同模块现有块内**，保持字母或逻辑分组（如 `operation.relations.*`）。

## 质量

- 日文：菜单/按钮用业务惯用译法（参考同文件邻近 key）
- 英文：sentence case for labels；保持与 `menu_name_en` SQL 一致时可对照 SQL
- 避免 HTML 实体；UI 用纯文本

## 验证

```bash
npm run build
```

可选：在三个 locale 中对同一 key 做 grep 确认三者皆有。

## 关联

- 新菜单页 titleKey → [meiling-add-menu-page](../meiling-add-menu-page/SKILL.md)
- 任务收尾 → [meiling-task-closeout](../meiling-task-closeout/SKILL.md)
