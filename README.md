# 美玲系统（meiling-ui）

**美玲系统** 的管理端前端，基于 **Vue 3 + TypeScript + Vite** 构建，与后端 **[moli-project-single](https://github.com/wujinsen/moli-project-single)** 通过 REST API 及 Shiro Session 联调。

> 本仓库为**前端静态应用**；登录、RBAC、多系统门户等业务逻辑由后端 API 提供。

## 项目组成

| 仓库 | 说明 |
|------|------|
| **[meiling-ui](https://github.com/wujinsen/meiling-ui)**（本仓库） | Vue 3 管理端：登录、系统门户、用户/角色/菜单、动作权限等 |
| **[moli-project-single](https://github.com/wujinsen/moli-project-single)** | Spring Boot 后端：鉴权、菜单下发、`permissions` 动作权限 |

**联调关系：**

- 开发环境由 Vite 代理将 `/login`、`/user`、`/role`、`/system` 等路径转发到后端（默认 `http://127.0.0.1:8888`，见 `vite.config.ts`）
- 登录成功后保存 Shiro `token`（Session ID），后续请求在 `Authorization` 头中携带
- 菜单路由由 `GET /menu/getRouters` 动态注册；按钮级权限由 `permissions` + `guardAction` 预检，后端接口兜底

## 功能概览

| 模块 | 能力 |
|------|------|
| **认证** | 登录 / 退出、验证码、多语言（中 / 英 / 日） |
| **多系统门户** | 系统选择、切换、SSO 跳转 |
| **系统管理** | 用户、角色、菜单、部门、岗位、字典、系统注册、日志 |
| **运营管理** | 项目、服务器、平台、组件（随菜单配置） |
| **权限** | 页面菜单 + 动作码（`system:user:add` 等）；**按钮常显，点击拦截** |

## 技术栈

- Vue 3、Vue Router、Vue I18n
- TypeScript、Vite 6
- Tailwind CSS、Lucide Icons、ECharts

## 快速开始

### 环境要求

- Node.js 18+
- 后端 `moli-server` 已启动（默认端口 `8888`）

### 安装与运行

```bash
npm ci
npm run dev
```

浏览器访问 `http://localhost:5141`。

### 生产构建

```bash
npm run build
```

产物输出至 `dist/`。本地预览：

```bash
npm run preview
```

### 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `VITE_USE_MOCK_AUTH` | `true` 时使用本地 Mock 登录 | 见 `.env.development` |
| `VITE_API_BASE_URL` | API 根路径；空字符串表示同域或走 Vite 代理 | 空 |
| `VITE_BASE` | 构建时静态资源 base（如 GitHub Pages 子路径） | `/` |

## 部署

生产环境通常由 **Nginx** 托管 `dist/`，并将 API 反代到后端。示例配置：

- [`deploy/nginx.conf.example`](deploy/nginx.conf.example) — 主站（含 `/login` SPA 与 API 分流）
- [`deploy/nginx.bioscope3d.conf.example`](deploy/nginx.bioscope3d.conf.example) — 纯静态子站示例

常见静态目录：`/opt/moli/frontend/dist`。

## 目录结构

```
src/
  api/           # 接口封装
  components/    # 布局与通用组件
  composables/   # 权限、门户、主题等
  constants/     # 权限码 PERM、分页等
  i18n/          # 多语言
  router/        # 路由与动态菜单
  views/         # 页面
deploy/          # Nginx 部署示例
docs/            # 前端补充文档、SQL 迁移脚本
```

## 动作权限（按钮）

与后端 [action-permission-design](https://github.com/wujinsen/moli-project-single/blob/main/docs/action-permission-design.md) 对齐：

- 操作按钮**始终展示**，禁止用 `v-if` 按权限隐藏
- 点击时通过 `guardAction` / `guardActionWithRefresh` 预检；无权限 Toast「无权限操作」
- `permissions` 主来源：登录 / 进入系统 / 切换系统响应；`GET /auth/capabilities` 作补拉

权限常量见 [`src/constants/permissions.ts`](src/constants/permissions.ts)。

## 相关文档

- [后端 README（中文）](https://github.com/wujinsen/moli-project-single/blob/main/README-zh.md)
- [SSO 前端开发指南（中文）](docs/sso-frontend-dev-guide.md)
- [系统门户分组 UI](docs/portal-system-group-ui.md)
- [角色分配动作 SQL](docs/sql/02_role_assign_actions.sql)

## License

Copyright (c) 2026 **wujinsen**

本项目基于 **[MIT License](LICENSE)** 开源。

您可以自由使用、复制、修改、合并、发布、分发、再许可和/或销售本软件，但须满足：

- 在所有副本或重要部分中保留版权声明和许可声明；
- 软件按 **「原样」** 提供，不提供任何形式的担保。

完整条款见 [LICENSE](LICENSE) 文件。
