# meiling-ui · 需要后端配合的事项（给后端联调）

> **读者**：moli-server（user-center · 8888）、moli-knowledge-server（8090）、DBA。  
> **更新**：2026-07-13（**对齐 monorepo** `b4ac176a` · §8.4 落定）  
> **前端仓库**：`meiling-ui`  
> **Monorepo 镜像**（后端主读）：[`moli-project-distribute/docs/api/frontend-backend-dependencies.md`](../../moli-project-distribute/docs/api/frontend-backend-dependencies.md)  
> **前端缺口索引**：[frontend-gaps.md](../frontend-gaps.md)  
> **运营交付**：[operation-frontend-handoff.md](operation-frontend-handoff.md)

---

## 1. 总览

| 模块 | 端口 | 阻塞新 API？ | 后端现在要做什么 |
|------|------|--------------|------------------|
| **运营管理** | `8888` | **否** | **联合走查 W1–W10**（前端代码 ✅；见 [operation-w1-w10-walkthrough.md](../test/operation-w1-w10-walkthrough.md)） |
| **知识库** | `8090` | **部分**（规模化/Lint） | **P0 点验**；**本地 dev** secret + O4 已就绪（§8.3） |
| **SSO** | user-center | **是（P2 架构）** | **SSO-MENU-1** 纳入下迭代 P2（§8.4③）；设计见 distribute [sso-menu-system-isolation.md](../../moli-project-distribute/docs/design/sso-menu-system-isolation.md) |

### 1.1 已与前端对齐（勿再 Breaking）

| 项 | 日期 | 后端勿改 |
|----|------|----------|
| `POST /operation/project`、`/component`、**`/server`** → `data` 为新建 **id** | 2026-07-13 | 勿退回 `boolean` |
| `toVo()` 统一 `*Count`；list / `GET /{id}` / check 一致 | 2026-07-13 | `serverCount === serverIds.length` |
| 前端 **S-VO**：chips 用 VO 计数，**不**批量 `GET .../links` | 2026-07-13 | links 仅关联弹窗 |

### 1.2 前端已完工、后端无需排期（供对照）

| 任务 ID | 说明 | 后端依赖 |
|---------|------|----------|
| **S-VO** | 三管理页去掉 links 水合 | 现有 VO 即可 |
| **DC-2** | 部署中心项目优先 + 批量扇出 | 单 server 执行 API（已有） |
| **DC-3** | 追加台账服务器 | 仅 `listServerApi`（已有） |
| **S-ERR-1** | 10101–10109 i18n Toast | 错误码稳定返回即可 |
| **S-DEPLOY-1** | 项目名 → order/bi 映射 | `presets.serviceKeys` 含 order/bi（已有） |
| **W7–W10** | server create id · batch deploy · upload · task cancel | commit **`b4ac176a`**（§8.2） |

**联合走查**：[test/operation-w1-w10-walkthrough.md](../test/operation-w1-w10-walkthrough.md)（给后端 · 含勾选记录表）。

---

## 2. 按任务 ID：谁需要后端

> 完整前端落点见 [frontend-gaps.md](../frontend-gaps.md)。本节只列**需要后端动作**的项。

### 2.0 状态矩阵

| 状态 | 含义 | 任务 ID |
|------|------|---------|
| 🟢 **点验** | 无新 API；环境 + 走查 | W1–W10、§10/§16、KB-O4、KB-BROWSE-1、KB-LLM-DB、407 SQL |
| 🟡 **可选开发** | 体验/规模化 **P3** | DC-4、KB-LINT-1/2、KBOPS-2 |
| 🔴 **架构 P2** | 前端无法单独完成 | **SSO-MENU-1**（下迭代已纳入） |
| ⚪ **已完成** | 前后端已对齐 | S-VO、W7–W10、DC-2/3、S-ERR-1、S-DEPLOY-1、create id、**batch deploy**（含原 DC-BE-1 滚动重启） |

### 2.1 联调点验（无新 API，需后端在场）

| 任务 ID | 负责方 | 后端动作 | 通过标准 |
|---------|--------|----------|----------|
| **S-VO** W1–W6 | 前后端 | `:8888` 含 `toVo()` · 见走查稿 W1–W6 | 恒等式 · relations · 无 links 水合 |
| **W7–W10** | 前后端 | `POST /server` · upload · **`/deploy/batch/task`** · **`/task/{id}/cancel`** | 走查稿 §3 |
| **运营 §10/§16** | 前后端 | 同上；`POST /operation/file/upload` dev 走 **8888** 勿经 Gateway | [operation-frontend.md](operation-frontend.md) §10 · §16 |
| **DC-3**（前端已做） | 前端自验 | 无需新接口；确认 `listServerApi` 可搜台账机 | 部署中心追加非关联服务器后可执行命令/上传 |
| **KB-O4** | 8090 | 部署含 **sync fail 样本** | `npm run kb:prd-acceptance` P0-O4 |
| **KB-BROWSE-1** | 8090 | `kbTypes` / `categoryIds` 多值参数 | `kb:prd` P0-browse-v3 |
| **KB-GOV-LLM** | 8090 | 可提供 `llmAvailable: false` 环境 | 治理页 AI 禁用态 |
| **KB-LLM-DB** | 8090 + 配置 | **`KB_LLM_CONFIG_SECRET`** | 平台 LLM Key `persistedInDatabase` |
| **KB-LINT-SCAN** | 8090 | `GET /kb/lint/scan/status` 非 404 | 健康体检 · 质量 Tab |
| **SVR-25c / 407** | DBA | `docs/sql/28_operation_topology_menu.sql`（老库） | 拓扑菜单；用户重登 |

### 2.2 可选排期（P3 · 后端已答③）

| 任务 ID | 优先级 | 服务 | 后端待做 | 前端状态 |
|---------|--------|------|----------|----------|
| **DC-4** | P3 | `8888` | `task/list` 按 `projectId` 聚合 VO | 未开工 |
| **KB-LINT-1/2** | P3 | `8090` | 服务端 `unassignedOnly` + 稳定分页 | 客户端兜底可用 |
| **KBOPS-2** | P3 | `8090` | Dashboard 专用 API | 多接口聚合可用 |
| **SSO-MENU-1** | **P2** | user-center | `system_id` + `getRouters` 过滤 | **下迭代** · 设计+SQL 草案已出 |

> **DC-BE-1**：滚动批量重启已由 **`POST /operation/deploy/batch/task`**（`b4ac176a` + 前端 W9）覆盖，**可标为已交付**。

### 2.3 纯前端（后端无需排期 · 2026-07-13 ✅）

| 任务 ID | 落点 | 说明 |
|---------|------|------|
| **DC-3** | `DeployCenterView` · `OperationServerMultiPickModal` | 追加台账服务器 |
| **S-ERR-1** | `resolveOperationErrorMessage` | 部署中心 / 批量 / 探活 / 项目部署 |
| **S-DEPLOY-1** | `operationPort.ts` | order/bi 项目名别名 |

---

## 3. 运营管理（8888）· 契约清单

> 权威记录：[moli-project-distribute operation-backend-handoff](../../moli-project-distribute/docs/api/operation-backend-handoff.md)

### 3.1 请持续保证的 VO / 行为

#### `GET /operation/relations/{type}/{id}`

| 字段 | 用途 |
|------|------|
| `entity` | 抽屉标题 |
| `servers[]` · `projects[]` · `components[]` | 关联 Tab |
| `projects[].deployRunning` · `portMatchStatus` | 列表徽章同源 |
| **`recentTasks[]`** | 任务 Tab → `DeployTaskDrawer` |

#### `GET /operation/topology`

`servers` / `projects` / `components` / `links`；节点 id：`s-` / `p-` / `c-` 前缀。

#### list / `GET /{id}` / check → 同一套 enrichment

| 实体 | 字段 |
|------|------|
| project | `serverIds`、`serverCount`、`componentCount`、`deployRunning`、`portMatchStatus`、`expectedPort` |
| component | `serverIds`、`serverCount`、`projectCount`、`portMatchStatus`、`expectedPort` |
| server | `projectCount`、`componentCount` |

**恒等式**：项目/组件 `serverCount === serverIds.length`（`toVo()` 派生；勿用 links 长度当 chips）。

#### 创建 · 关联 · 部署

| 接口 | 期望 |
|------|------|
| `POST /operation/project` · `/component` | `data` = 新建 id；body `serverIds` → N:N |
| `PUT/GET .../links` | 主表 `serverId` / IP 与 N:N 同步；**仅**关联弹窗 |
| `GET /operation/deploy/presets` | `serviceKeys` 含 **order**、**bi** |
| `GET /operation/task/list` | `serverId`、`projectId`、`targetName` |
| `POST /operation/file/upload` | 返回 `taskId` |
| 错误码 **10101–10109** | 部署/上传/命令/删除/探活等路径稳定返回；前端 **S-ERR-1 ✅** 已映射 i18n |
| **`10107` + `data=taskId`** | 单台 `check` / 删服务器冲突时可选返回 taskId（前端可开任务抽屉） |

### 3.2 后端 smoke（自测）

```http
GET /operation/relations/server/{id}
GET /operation/topology
GET /operation/project/{id}
# 期望：serverCount、serverIds 存在且 serverCount === serverIds.length

GET /operation/project/list?serverId={id}
GET /operation/server/list?pageNum=1&pageSize=20
# DC-3：台账列表可搜、可分页

POST /operation/file/upload
# dev：Vite proxy → 8888，不经 Gateway
```

与前端共验：**S-VO W1–W6**（distribute [operation-frontend-handoff §5](../../moli-project-distribute/docs/api/operation-frontend-handoff.md)）。

---

## 4. 知识库（8090）

### 4.1 点验环境（frontend-gaps §2.1）

| 任务 ID | 后端配置 / 数据 | 优先级 |
|---------|-----------------|--------|
| **KB-O4** | sync 日志含 `status=fail` 样本 | **P0** |
| **KB-BROWSE-1** | 多选 facet：[kb-browse-multi-select-filter.md](../kb-browse-multi-select-filter.md) | **P0** |
| **KB-GOV-LLM** | `govern/options` → `llmAvailable: false` 可测 | P1 |
| **`KB-LLM-DB`** | **`KB_LLM_CONFIG_SECRET`**（本地 dev 默认已配） | P1 |
| **KB-LINT-SCAN** | `GET /kb/lint/scan/status?spaceId=` 非 404 | P2 |

**本地 dev（2026-07-13 · 与 monorepo §4 一致）**：8090 `application-dev.yml` 已设 secret 默认 + O4 样本路径；重启后 `encryptionReady=true`，可跑 `kb:prd-acceptance`。

### 4.2 Lint 分页（KB-LINT-1 / KB-LINT-2 · 可选）

```
GET /kb/lint/issues?pageNum=&pageSize=&unassignedOnly=
→ { records, total, current, size } 或 MoliPage 等价结构
```

`unassignedOnly=true` 时须服务端过滤，勿返全量数组。

### 4.3 可选（KBOPS-2）

运维 Dashboard 专用 API — 非阻塞；前端现聚合 `sync/logs` + `lint/issues` + `ask/llm-config`。

---

## 5. SSO（SSO-MENU-1 · P2 下迭代）

| 项 | 说明 |
|----|------|
| 需求 | 门户进入 INTERNAL 系统后，侧栏**仅**该系统菜单 |
| 权威设计 | distribute [sso-menu-system-isolation.md](../../moli-project-distribute/docs/design/sso-menu-system-isolation.md) · SQL `30_sso_menu_system_id.sql` |
| **前端开工** | [sso-menu-frontend-handoff.md](sso-menu-frontend-handoff.md)（F-SSO-1～6 · Q3/Q5 · `reloadRoutesFromServer`） |
| **走查** | [sso-menu-frontend-walkthrough.md](../test/sso-menu-frontend-walkthrough.md) |
| 本仓摘要 | [per-system-menu-isolation.md](../per-system-menu-isolation.md) |
| 排期 | **✅ 纳入下迭代 P2**（约 2–3 人日，§8.4③） |
| 阻塞度 | **不挡**运营/KB 主流程 |

---

## 6. 建议后端处理顺序

```text
① 8888：push/deploy b4ac176a（共享环境）或本地 install+重启 → W1–W10 走查
② 8090：KB_LLM_CONFIG_SECRET + KB-O4 → kb:prd-acceptance（本地 dev 已就绪）
③ DBA：407 SQL（老库按需）
④ 下迭代 P2：SSO-MENU-1
⑤ 可选 P3：DC-4 · KB-LINT · KBOPS-2
```

---

## 7. 转发后端（可复制）

```
【meiling-ui · 后端配合 · 2026-07-13】

运营（8888）：
· 前端代码已完工：S-VO · DC-2/3 · W7–W10
· 后端 commit b4ac176a（本地；共享环境需 push+部署）
· 联合走查：meiling-ui/docs/test/operation-w1-w10-walkthrough.md
  （monorepo 镜像：moli-project-distribute/docs/test/operation-w1-w10-walkthrough.md）

关键 API（勿 Breaking）：
· toVo() *Count · POST project/component/server → data=id
· POST /operation/deploy/batch/task · POST /operation/task/{id}/cancel
· 新建服务器 body 字段 ip（非 serverIp）

8090 点验：
· 本地 dev：secret + O4 已就绪 · npm run kb:prd-acceptance

下迭代（已答）：SSO-MENU-1=P2；DC-4/KB-LINT/KBOPS-2=P3 可选
DC-BE-1：已由 batch/task 覆盖，可关闭

详稿：moli-project-distribute/docs/api/frontend-backend-dependencies.md
      meiling-ui/docs/api/frontend-backend-dependencies.md（镜像）
```

---

## 8. 评估与后端回复（§8.4 · 与 monorepo 同步）

### 8.1 结论

| 维度 | 评估 |
|------|------|
| **运营** | **无 API 阻塞**；待 W1–W10 **联合走查** |
| **知识库** | **点验级**；**本地 secret + O4 已就绪** |
| **SSO** | **P2 架构**；**纳入下迭代**；设计+SQL 草案已出 |
| **文档↔代码** | **与 monorepo `frontend-gaps` / handoff 互引一致** |

### 8.2 ① 8888 版本与联调

| 项 | 状态 |
|----|------|
| **`b4ac176a`**（本地 commit） | server create id · `toVo()` · batch/links · **cancel** · handoff 文档 |
| **`ebf16fd7`**（已 push） | project/component create id · order/bi deploy |
| **远程** | 分支 ahead · **`b4ac176a` 未 push** 时共享 jar **不全** |

**结论**：本地 `mvn -pl moli-user-center-server -am install` + 重启 → **可联调 W1–W10**；共享环境需 **push + 部署 `b4ac176a`**。

### 8.3 ② 8090 点验环境

| 项 | 状态 |
|----|------|
| 功能 API | facet · Lint 分页 · chunk ask ✅ |
| **本地 P0** | `KB_LLM_CONFIG_SECRET` dev 默认 · O4 样本 · `encryptionReady=true` ✅ |
| **生产** | 运维注入真实 secret + 定时任务 |

### 8.4 ③ 下迭代（后端已回复）

| 项 | 排期 |
|----|------|
| **SSO-MENU-1** | ✅ **纳入下迭代 P2**（设计已出，约 2–3 人日） |
| **DC-4** | ⬜ **P3 可选** |
| **KB-LINT-1/2** · **KBOPS-2** | ⬜ **P3 可选** |
| **DC-BE-1** | ✅ 由 **`POST /deploy/batch/task`** 覆盖（与 W9 一致） |

### 8.5 联调前置

```text
8888：□ install+重启（b4ac176a）  □ VITE_USE_MOCK_AUTH=false  □ 走查稿 W1–W10
8090：□ 8090 重启  □ kb:prd-acceptance（本地 dev 通常已满足 secret+O4）
```

---

## 9. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-13 | **对齐 monorepo**：`b4ac176a` · §8.4③ 落定 · DC-BE-1→batch · 8090 本地就绪 |
| 2026-07-13 | W7–W10 前端完工；走查稿 `docs/test/operation-w1-w10-walkthrough.md` |
