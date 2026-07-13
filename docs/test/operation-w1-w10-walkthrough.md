# 运营管理 · W1–W10 联合走查清单（给后端联调）

> **更新**：2026-07-13  
> **读者**：user-center 后端、meiling-ui 前端、联调同学  
> **前端状态**：**W1–W10 代码已完工**（见 [operation-frontend-handoff.md](../api/operation-frontend-handoff.md) §4）  
> **Monorepo 镜像**：[moli-project-distribute/docs/test/operation-w1-w10-walkthrough.md](../../moli-project-distribute/docs/test/operation-w1-w10-walkthrough.md)  
> **后端状态**：commit **`b4ac176a`**（本地 install+重启）；共享环境需 **push+部署**（见 [frontend-backend-dependencies.md](../api/frontend-backend-dependencies.md) §8.2）  
> **环境**：`http://127.0.0.1:5141` · proxy → `8888` · `admin`/`123456` · `VITE_USE_MOCK_AUTH=false`

---

## 0. 结论（给后端一句话）

| 项 | 状态 |
|----|------|
| **前端开发** | ✅ S-VO · DC-2/3 · W7–W10 均已落地；**无待开发阻塞项** |
| **联合走查** | ✅ **W1–W10 已通过**（API `npm run op:walkthrough` + 浏览器部署中心/任务历史 · 2026-07-13） |
| **后端需保证** | `toVo()` `*Count` · create 返回 id · `POST /deploy/batch/task` · `POST /task/{id}/cancel` · `ops.upload/deploy.enabled` |

---

## 1. 走查前检查（后端）

| # | 项 | 期望 |
|---|-----|------|
| P0 | user-center `:8888` | **`b4ac176a`**：`mvn -pl moli-user-center-server -am install` + 重启（非仅 push `ebf16fd7`） |
| P1 | 运维开关 | `ops.upload.enabled=true`（W8）；`ops.deploy.enabled=true`（W9/W10） |
| P2 | 测试数据 | ≥1 项目；**W9** 先执行 **`npm run op:seed:w9`**（双机 + SSH 克隆） |
| P3 | 权限 | 联调账号含 `operation:deploy:exec`、`operation:file:upload`、`operation:server:add` 等 |
| P4 | dev 路由 | 大文件上传走 Vite → `8888`，**勿经 Gateway** |

**后端 smoke（可选，走查前 5 分钟）**：见 [operation-frontend-handoff.md §5](../api/operation-frontend-handoff.md#5-联调-smoke后端自测清单)。

---

## 2. W1–W6 · S-VO 与关联（前端 + 后端 VO）

### W1 · 列表 chips 用 VO 计数（不批量拉 links）

| 项 | 内容 |
|----|------|
| **路径** | `/operation/project` · `/operation/component` · `/operation/server` |
| **操作** | 打开列表；DevTools Network 筛选 `operation` |
| **后端期望** | 仅 `GET .../list`；**无**连续 `GET .../{id}/links` |
| **通过** | chips 数字 = list 行 `serverCount` / `componentCount` / `projectCount` |

### W2 · list 与 `GET /{id}` 的 `*Count` 一致

| 项 | 内容 |
|----|------|
| **路径** | `/operation/project`（组件页同理） |
| **操作** | 记 list 行 chips 数 → **编辑** → 看 `GET /operation/project/{id}` |
| **通过** | list 与 detail 同行 `serverCount`、`componentCount` 一致 |

### W2b · 恒等式 `serverCount === serverIds.length`

| 项 | 内容 |
|----|------|
| **操作** | Response 中核对项目/组件行 |
| **通过** | `serverCount === serverIds.length`（list 与 `GET /{id}` 均成立） |

### W3 · RelationDrawer

| 项 | 内容 |
|----|------|
| **操作** | 点关联 chips → 抽屉 |
| **Network** | `GET /operation/relations/{type}/{id}` |
| **通过** | Tab 有数据；`recentTasks` 可开任务抽屉 |

### W4 · 关联弹窗保存后计数更新（无幽灵机）

| 项 | 内容 |
|----|------|
| **操作** | 项目 **关联服务器** 弹窗 → 只留 1 台 → `PUT .../links` |
| **通过** | 列表 chips = 1；`GET /{id}` 的 `serverCount=1`；无「删剩 1 台仍显示 2」 |

### W5 · chips URL 反向过滤

| 项 | 内容 |
|----|------|
| **操作** | chips 点服务器标签 → URL `?serverId=` → 列表过滤 → 清除 chip |
| **通过** | query 与列表联动 |

### W6 · 拓扑 + 项目组件依赖

| 子项 | 路径 | Network | 通过 |
|------|------|---------|------|
| 6a 拓扑 | `/operation/topology` | `GET /operation/topology` | 图可渲染；`?focus=s-{id}` 高亮 |
| 6b 依赖 | `/operation/project` → 组件依赖 | `GET/PUT .../component-links` | `componentCount` 与弹窗一致 |

---

## 3. W7–W10 · 部署与任务（2026-07-13 前端已对接）

### W7 · 新建服务器返回 id

| 项 | 内容 |
|----|------|
| **路径** | `/operation/server` → **新增** |
| **Network** | `POST /operation/server` |
| **通过** | `data` = 新建 **id**（非 `true`）；列表出现新行 |

**前端落点**：`addServerApi` → `request<number | string>` · `ServerManageView` 校验 `result.data`

### W8 · 上传并发布（单机任务轮询）

| 项 | 内容 |
|----|------|
| **路径** | `/operation/deploy` → 选项目 → **勾选 1 台** SSH✓ → 文件发布 |
| **Network** | `POST /operation/file/upload` → `data=taskId`；轮询 `GET /operation/task/{id}` |
| **通过** | `finished=true` · `status=success`；日志含 SFTP/上传字样 |

### W9 · 多机批量滚动重启（单父任务）

| 项 | 内容 |
|----|------|
| **路径** | `/operation/deploy` → 勾选 **≥2 台** → 服务控制 **restart** |
| **Network** | **`POST /operation/deploy/batch/task`**（非 N 次单任务 API） |
| **通过** | 单 `taskId`；`taskType=deploy_batch`；日志含 **`[BATCH]`** |

**说明**：多机 **上传/命令** 仍前端扇出批量面板，**不算 W9 失败**。

**前端落点**：`createDeployBatchTaskApi` · `DeployCenterView.runDeployAction`（多机分支）

### W10 · 取消运行中任务

| 项 | 内容 |
|----|------|
| **路径** | W9/W8 运行中 → 任务抽屉 **取消任务** |
| **Network** | `POST /operation/task/{id}/cancel`；继续 poll 至结束 |
| **通过** | `status=cancelled` · `finished=true` |

**前端落点**：`cancelOperationTaskApi` · `useOperationTaskPoll.cancelTask` · `DeployTaskDrawer`

---

## 4. 建议顺序

```text
W1 → W2 → W2b → W3 → W4 → W5 → W6 → W7 → W8 → W9 → W10
```

---

## 5. 记录表（联调后回填 · 可转发）

| ID | 结果 | 后端接口 / 备注 |
|----|------|-----------------|
| W1 | ✅ | list `*Count`；`pageNum/pageSize` 分页；无 links 水合（API） |
| W2 | ✅ | list vs `GET /{id}` 同行 `serverCount`/`componentCount` 一致 |
| W2b | ✅ | `serverCount === serverIds.length`（list + detail） |
| W3 | ✅ | `GET /operation/relations/server/{id}` · `recentTasks[]` |
| W4 | ✅ | `PUT .../links` 后 chips/`GET /{id}` 计数同步（已还原） |
| W5 | ✅ | `GET /operation/project/list?serverId=` 反向过滤 |
| W6 | ✅ | topology 12 节点 · component-links GET |
| W7 | ✅ | `POST /operation/server` → snowflake id（测后 DELETE） |
| W8 | ✅ | upload → taskId · poll `finished=true` `status=success` · path=`/opt/moli/frontend/dist/` |
| W9 | ✅ | 双机 `batch/task` · 任务历史 `deploy_batch`「2 步」；远端 restart 可 **失败**（exit 1）不影响走查 |
| W10 | ✅ | `POST /task/{id}/cancel` → `cancelled`；任务历史列表/抽屉展示正常 |

**走查人**：admin · **日期**：2026-07-13 · **8888 构建**：`b4ac176a`（本地）· **meiling-ui**：`:5141`

**自动化**：`npm run op:walkthrough`（日志 `operation-w1-w10-walkthrough.log`）  
**W9 种子**：`npm run op:seed:w9` · SQL 说明见 [docs/sql/31_operation_w9_dual_server_seed.sql](../sql/31_operation_w9_dual_server_seed.sql)

**W9 部署中心**：项目 **`w9-batch-smoke`** → 勾选 **201 + w9-smoke-b** → restart → 单次 `POST /operation/deploy/batch/task`。

### 5.1 浏览器补记（2026-07-13）

| 项 | 结果 | 说明 |
|----|------|------|
| 部署中心 | ✅ | 项目下拉显示 `w9-batch-smoke`；双机勾选 → 创建 `deploy_batch` |
| 任务历史 | ✅ | 列表含类型/状态/进度/备注/时间；「查看日志」开抽屉 |
| W9 远端失败 | ⚪ 预期外、走查仍过 | 备注 `远程脚本返回非零退出码: 1`、进度 95% = SSH 已执行但 `moli-service.sh` 未成功；**非前端缺陷** |

> **走查通过标准**：API 契约 + UI 接线；不要求 batch restart 在种子机上业务成功。

---

## 6. 相关文档

| 文档 | 用途 |
|------|------|
| [operation-frontend-handoff.md](../api/operation-frontend-handoff.md) | 前端交付 · API 落点 |
| [frontend-backend-dependencies.md](../api/frontend-backend-dependencies.md) | 跨模块依赖 · §7 可转发 |
| [operation-frontend.md](../api/operation-frontend.md) §10 · §16 | 验收总表 |
| distribute [operation-relations-topology-acceptance.md](../../moli-project-distribute/docs/test/operation-relations-topology-acceptance.md) | LC/UI 用例 |
| distribute [operation-deploy-center-acceptance.md](../../moli-project-distribute/docs/test/operation-deploy-center-acceptance.md) | 部署/SFTP 用例 |
