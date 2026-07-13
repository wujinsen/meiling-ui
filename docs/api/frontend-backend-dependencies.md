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
| **运营管理** | `8888` | **否** | ✅ **W1–W10 走查通过**（2026-07-13 · [operation-w1-w10-walkthrough.md](../test/operation-w1-w10-walkthrough.md)） |
| **知识库** | `8090` | **否** | ✅ **点验 + P3 接线完成**（2026-07-13 · `kb:prd` **17/17**） |
| **SSO** | user-center | **否** | **SSO-MENU-1 已交付**（走查 ✅ 2026-07-13） |

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

**联合走查**：[test/operation-w1-w10-walkthrough.md](../test/operation-w1-w10-walkthrough.md) · **✅ W1–W10 已通过**（2026-07-13）。

---

## 2. 按任务 ID：谁需要后端

> 完整前端落点见 [frontend-gaps.md](../frontend-gaps.md)。本节只列**需要后端动作**的项。

### 2.0 状态矩阵

| 状态 | 含义 | 任务 ID |
|------|------|---------|
| 🟢 **点验** | 无新 API；环境 + 走查 | ~~W1–W10~~ ✅、~~KB-O4~~、~~KB-BROWSE-1~~、~~KB-LLM-DB~~、~~KB-LINT-SCAN~~ ✅ 2026-07-13；407 SQL（老库按需） |
| 🟡 **可选开发** | 体验/规模化 **P3** | ~~DC-4~~ · ~~KBOPS-2~~ · ~~KB-LINT~~ ✅ 2026-07-13 |
| ⚪ **已完成** | 前后端已对齐 | S-VO、W7–W10、DC-2/3、S-ERR-1、S-DEPLOY-1、create id、**batch deploy**、**SSO-MENU-1** |

### 2.1 联调点验（无新 API，需后端在场）

| 任务 ID | 负责方 | 后端动作 | 通过标准 |
|---------|--------|----------|----------|
| **S-VO** W1–W6 | 前后端 | `:8888` 含 `toVo()` · 见走查稿 W1–W6 | 恒等式 · relations · 无 links 水合 |
| **W7–W10** | 前后端 | `POST /server` · upload · **`/deploy/batch/task`** · **`/task/{id}/cancel`** | 走查稿 §3 |
| **运营 §10/§16** | 前后端 | 同上；`POST /operation/file/upload` dev 走 **8888** 勿经 Gateway | [operation-frontend.md](operation-frontend.md) §10 · §16 |
| **DC-3**（前端已做） | 前端自验 | 无需新接口；确认 `listServerApi` 可搜台账机 | 部署中心追加非关联服务器后可执行命令/上传 |
| ~~**KB-O4**~~ | 8090 | sync fail 样本 `_p0o4-fail-test` | ✅ 2026-07-13 `kb:prd` **P0-O4** |
| ~~**KB-BROWSE-1**~~ | 8090 | `kbTypes` / `categoryIds` 多值 | ✅ 2026-07-13 **P0-browse-v3** |
| **KB-GOV-LLM** | 8090 | `llmAvailable: false` 环境（可选） | ✅ **REG-llm-on** + **REG-llm-off**（2026-07-13 · 17/17） |
| ~~**KB-LLM-DB**~~ | 8090 + 配置 | **`KB_LLM_CONFIG_SECRET`** | ✅ 2026-07-13 `encryptionReady=true` · **REG-llm-on** |
| ~~**KB-LINT-SCAN**~~ | 8090 | `GET /kb/lint/scan/status` | ✅ 2026-07-13 **P0-O9** · O5–O8 |
| **SVR-25c / 407** | DBA | `docs/sql/28_operation_topology_menu.sql`（老库） | 拓扑菜单；用户重登 |

### 2.2 可选排期（P3 · 后端已答③）

| 任务 ID | 优先级 | 服务 | 后端待做 | 前端状态 |
|---------|--------|------|----------|----------|
| **DC-4** | P3 | `8888` | `GET /operation/task/groups` | ✅ 已交付 + 前端接线 · 同上 §1 |
| **KB-LINT-1/2** | P3 | `8090` | `GET /kb/lint/issues` 分页 + `unassignedOnly` | ✅ 已交付 + 前端收紧 · 同上 §2 |
| **KBOPS-2** | P3 | `8090` | `GET /kb/ops/dashboard` | ✅ 已交付 + 前端接线 · 同上 §3 |
| **SSO-MENU-1** | — | user-center | — | ✅ **已交付 + 走查**（2026-07-13） |

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

**点验结果（2026-07-13）**：`npm run kb:prd` → **17/17**（含 **REG-llm-off** merge 探针）。O4 样本目录已清理；历史 fail 日志仍可验 P0-O4。

### 4.2 Lint 分页（KB-LINT-1 / KB-LINT-2 · ✅ 8090 已交付）

**详稿**：[p3-optional-backend-handoff.md](p3-optional-backend-handoff.md) §2

```http
GET /kb/lint/issues?pageNum=1&pageSize=20&unassignedOnly=true&spaceId=&status=0
→ { records, total, current, size }
```

**前端**：`kbLint.ts` 在 `current`+`size` 存在时走服务端分页；`npm run kb:prd` P2-O5-unassigned ✅。

### 4.3 运维 Dashboard（KBOPS-2 · ✅ 8090 已交付 · ✅ 前端已接线）

**详稿**：[p3-optional-backend-handoff.md](p3-optional-backend-handoff.md) §3

`KnowledgeOpsDashboardView` 首选 **`GET /kb/ops/dashboard`**（`getKbOpsDashboardApi`）；若 8090 缺 `kb_llm_call_log` 等导致 500，自动降级原 3 请求聚合。

---

## 5. SSO（SSO-MENU-1 · ✅ 已交付）

| 项 | 说明 |
|----|------|
| 需求 | 门户进入 INTERNAL 系统后，侧栏**仅**该系统菜单 |
| 权威设计 | distribute [sso-menu-system-isolation.md](../../moli-project-distribute/docs/design/sso-menu-system-isolation.md) · SQL `30_sso_menu_system_id.sql` |
| **契约** | [sso-menu-frontend-handoff.md](sso-menu-frontend-handoff.md)（F-SSO-1～6） |
| **走查** | [sso-menu-frontend-walkthrough.md](../test/sso-menu-frontend-walkthrough.md) ✅ 2026-07-13 |
| 历史稿 | [per-system-menu-isolation.md](../per-system-menu-isolation.md)（**已废弃**） |

---

## 6. 建议后端处理顺序

```text
① 8888：push/deploy b4ac176a（共享环境）或本地 install+重启 → W1–W10 走查
② ~~8090：KB 点验 + P3 接线~~ ✅ 2026-07-13（`npm run kb:prd` **17/17**）
③ DBA：407 SQL（老库按需）
④ ~~SSO-MENU-1~~ ✅ 2026-07-13
⑤ ~~可选 P3：KBOPS-2 · KB-LINT · DC-4~~ ✅ 2026-07-13
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

SSO-MENU-1：✅ 已交付（走查 2026-07-13）

8090 点验：✅ 2026-07-13 npm run kb:prd（17/17）
P3：✅ DC-4 TaskHistoryView 分组 · KBOPS-2 dashboard · KB-LINT 分页收紧（2026-07-13）
DC-BE-1：已由 batch/task 覆盖，可关闭

详稿：moli-project-distribute/docs/api/frontend-backend-dependencies.md
      meiling-ui/docs/api/frontend-backend-dependencies.md（镜像）
```

---

## 8. 评估与后端回复（§8.4 · 与 monorepo 同步）

### 8.1 结论

| 维度 | 评估 |
|------|------|
| **运营** | **无 API 阻塞**；**W1–W10 走查 ✅**（2026-07-13） |
| **知识库** | ✅ **点验 + P3 接线完成**（2026-07-13 · `kb:prd` 17/17） |
| **SSO** | **已交付**；F-SSO-1～6 + S3～S7/S10 走查 ✅（2026-07-13） |
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
| **本地 P0** | secret + O4 样本 · `encryptionReady=true` ✅ · **`kb:prd` 17/17** ✅ 2026-07-13 |
| **生产** | 运维注入真实 secret + 定时任务 |

### 8.4 ③ 下迭代（后端已回复）

| 项 | 排期 |
|----|------|
| **SSO-MENU-1** | ✅ **已交付 + 走查通过**（2026-07-13） |
| **DC-4** | ✅ 8888 已交付 + 前端接线 |
| **KB-LINT-1/2** | ✅ 8090 已交付 + 前端收紧 |
| **KBOPS-2** | ✅ 8090 已交付 + 前端接线 |
| **DC-BE-1** | ✅ 由 **`POST /deploy/batch/task`** 覆盖（与 W9 一致） |

### 8.5 联调前置

```text
8888：☑ install+重启（b4ac176a）  ☑ VITE_USE_MOCK_AUTH=false  ☑ 走查稿 W1–W10（2026-07-13）
SSO：☑ 30_sso_menu_system_id.sql  ☑ sso-menu-frontend-walkthrough（2026-07-13）
8090：☑ kb:prd（2026-07-13 · 17/17）
8888：☑ task/groups（DC-4 API 探针）
```

---

## 9. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-13 | **P3 完工**：DC-4 · KBOPS-2 · KB-LINT；`kb:prd` **17/17**（REG-llm-off merge 探针） |
| 2026-07-13 | **对齐 monorepo**：`b4ac176a` · §8.4③ 落定 · DC-BE-1→batch · 8090 本地就绪 |
| 2026-07-13 | **W1–W10 联合走查通过**（API + 浏览器 · W9 远端 exit 1 不计入失败） |
| 2026-07-13 | W7–W10 前端完工；走查稿 `docs/test/operation-w1-w10-walkthrough.md` |
