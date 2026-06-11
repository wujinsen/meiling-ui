# AGENTS — meiling-ui

## 协作入口

做 **多系统 SSO / 系统门户 / 系统注册管理** 相关需求时，**必须先阅读**：

- [docs/sso-frontend-dev-guide.md](docs/sso-frontend-dev-guide.md)（中文完整说明）
- [docs/sso-frontend-dev-guide.en.md](docs/sso-frontend-dev-guide.en.md)（英文摘要）

后端仓库：`../moli-project-single`（moli-admin，模块名 `moli-server`）。

## 技术约定

- Vue 3 + Vite + TypeScript + Tailwind
- 状态：composables，不用 Pinia
- 不用 Element UI
- API 代理见 `vite.config.ts` → `http://127.0.0.1:8888`
- 联调：`VITE_USE_MOCK_AUTH=false`

## 迭代清单

任务结束前：

- [ ] `npm run build` 通过
- [ ] i18n zh / en / ja 同步（若改了文案）
- [ ] 不破坏登录 → 选系统 → 进入 → 切换 流程
