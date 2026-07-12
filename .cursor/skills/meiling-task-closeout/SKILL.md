---
name: meiling-task-closeout
description: >-
  Closes out meiling-ui feature work: npm run build, i18n check, auth flow smoke,
  and frontend-gaps.md updates. Use before commit, at end of any feature task,
  or when AGENTS.md iteration checklist applies.
---

# meiling-ui · 任务收尾

## 清单（默认全做）

```
- [ ] npm run build 通过
- [ ] 若改文案：zh / en / ja 同步（见 meiling-i18n-sync）
- [ ] 不破坏：登录 → 选系统 → 进入 → 切换
- [ ] 若改运营/知识库缺口：更新 docs/frontend-gaps.md
- [ ] 不提交 tsconfig.tsbuildinfo、.idea/、dist.zip、日志、本地图片
```

## 1 · 构建

```powershell
cd D:\work\moli_project\meiling-ui
npm run build
```

失败时修 TypeScript / vue-tsc 错误后再继续。

## 2 · i18n

若 diff 含 `src/i18n/locales/zh.ts`，检查 `en.ts` + `ja.ts` 同 key。  
执行 [meiling-i18n-sync](../meiling-i18n-sync/SKILL.md)。

## 3 · 权限 / 菜单 SQL

若新增 `docs/sql/*_menu.sql` 或 `sys_action`：

- 提醒用户：**执行 SQL 后重新登录**
- 前端 `assertAction` 才生效

## 4 · frontend-gaps.md

| 改了什么 | 更新节 |
|----------|--------|
| operation SVR-* | §1 运营管理 |
| knowledge P0/P1 | §2 知识库 |
| SSO / 门户 | §3 |
| 技术债 | §4 |

状态用 ✅ / 🟡 / ❌，与实现一致。

## 5 · 主流程冒烟（手测或提醒用户）

1. 登录
2. 多系统时：选系统 → 进入
3. 侧栏进改动页面
4. 系统切换器切换后页面/菜单仍正常

SSO 细节：[docs/sso-frontend-dev-guide.md](../../docs/sso-frontend-dev-guide.md)

## 6 · Commit 范围

**纳入**：`src/` · `docs/` · `.cursor/skills/` · `AGENTS.md`  
**排除**：`tsconfig.tsbuildinfo` · `.idea/` · `dist.zip` · `*.log` · 生成图

用户未要求时不要 commit。

## 模块专项收尾

| 模块 | 额外检查 |
|------|----------|
| operation | `VITE_USE_MOCK_AUTH=false` 联调说明 |
| knowledge ingest | mock 开关与 AGENTS.md Tab 表一致 |
| 新菜单 | SQL + viewRegistry 已接线 |
