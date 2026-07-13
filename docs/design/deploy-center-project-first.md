# 部署中心重设计:项目优先 + 多服务器批量操作(DC-2)

> 状态:已实现 · 前端方案(不依赖后端改动)
> 关联:[operation-frontend.md](../api/operation-frontend.md) §6.2 部署状态 · §S6-b 多选服务器

## 1. 背景与问题

旧版部署中心(服务器优先)存在两个结构性问题:

| # | 问题 | 说明 |
|---|------|------|
| 1 | 入口维度错位 | 运维动作的自然语序是「对某个项目的 N 台服务器操作」,旧版先选服务器再挑服务,`serviceKey` 与服务器的关系不直观 |
| 2 | 只能单台执行 | 启停/上传/远程命令都绑定单个 `serverId`;项目多机部署时需要逐台切换重复操作 |

## 2. 目标设计

### 2.1 交互流(三段式)

```
① 选择项目(下拉,含环境徽章)
        │  GET /operation/project/{id}/links → 有序 serverIds(首项=主)
        ▼
② 关联服务器清单(checkbox 多选,默认全选)
   ┌ ☑ Ubuntu24.04 · 172.31.20.10   主 · 生产 · SSH✓ · ●运行中
   ├ ☑ window11    · 127.0.0.1        开发 · SSH✓ · ●已停止
   └ ☐ moli-pre    · …                预发 · SSH✗(禁选)
        ▼
③ 操作区(全部作用于勾选集合)
   [服务控制 start/stop/restart] [文件发布] [远程命令]
```

- **项目**:`listProjectApi` 全量(≤500);任何项目都可用「文件发布」「远程命令」,
  有 `resolveDeployServiceKey(projectName)` 映射(user-center/gateway/knowledge)的才显示「服务控制」。
- **服务器清单**:`getProjectLinksApi` 的 `serverIds` + `getServerApi` 水合
  (名称 / IP / 环境 / `sshConfigured`);未配置 SSH 的行禁用勾选(执行必失败,前置拦截)。
- **运行状态**:有 serviceKey 时按勾选服务器并发 `getDeployStatusApi(key, serverId)`,
  行内显示 ●运行中 / ●已停止 / 未知(服务器 × 状态矩阵)。

### 2.2 批量执行模型(前端扇出)

后端执行 API 均为单 server 语义,本设计**不改后端**:

| 动作 | 扇出调用(每台一次) |
|------|--------------------|
| 启停 | `POST /operation/deploy/{key}/{action}/task?serverId=&projectId=` |
| 上传 | `POST /operation/file/upload`(FormData 复用同一 File) |
| 命令 | `POST /operation/command/exec/task` |

- 每台服务器一个独立 `taskId` → 失败隔离、独立日志、可单台重试。
- 确认弹窗列出台数与名单:「将在 2 台服务器执行 restart:Ubuntu24.04、window11」。
- **勾选 1 台时沿用单任务抽屉 `DeployTaskDrawer`**,行为与旧版一致。

### 2.3 批量任务面板 `DeployBatchTaskPanel`

```
批量任务 · restart user-center(2 台)
├ Ubuntu24.04  ████████░░ 80%  运行中   [日志▾]
└ window11     ██████████ 100% ✓成功    [日志▾]
```

- 每行独立轮询 `GET /operation/task/{id}?logOffset=`(1.5s,共享一个 interval);
- 进度条复用 `useSmoothProgress`(匀速逼近,100% 立即收尾)+ `operation-task-progress` 样式;
- 行内「日志」手风琴展开增量日志;创建失败的行标红,可单台重试;
- 全部行 `finished` 后停止轮询。

### 2.4 与旧版的取舍

| 决策 | 理由 |
|------|------|
| 移除左侧服务器列表 | 入口统一为项目维度;纯服务器命令场景由「远程命令」区的「追加服务器」兜底(见 §5) |
| 不做后端 batch API | 前端扇出即可;将来后端提供批量编排(滚动/灰度)时仅需替换扇出层 |
| 服务卡片 → 服务器状态行 | 状态天然是 (serviceKey, serverId) 二元组,旧版固定三卡片放不下多机 |

## 3. 代码落点

| 层 | 文件 | 职责 |
|----|------|------|
| composable | `src/composables/useDeployBatchTasks.ts` | 扇出创建 + 多任务共享轮询 + 单台重试 |
| 组件 | `src/components/operation/DeployBatchTaskPanel.vue` | 批量任务模态(行=服务器) |
| 组件 | `src/components/operation/DeployBatchTaskRow.vue` | 单行:丝滑进度 + 状态 + 日志手风琴 |
| 视图 | `src/views/operation/DeployCenterView.vue` | 三段式重构 |
| i18n | `operation.deployCenter.*` · `operation.task.batch*` | zh / en / ja |

### 3.1 `useDeployBatchTasks` 接口

```typescript
type BatchTarget = { serverId: string; serverName: string }
type BatchItemStatus = 'creating' | 'createFailed' | 'running' | 'success' | 'failed'

const { panelOpen, batchTitle, items, runBatch, retryItem, closePanel } = useDeployBatchTasks()

runBatch(
  title: string,
  targets: BatchTarget[],
  createTask: (serverId: string) => Promise<MoliResult<number>>,
)
```

- `items[i]`:`{ serverId, serverName, taskId?, task?, logText, status, error? }`
- 轮询:单个 `setInterval(1500)` 内 `Promise.all` 所有未完成项;全部结束自动停。
- `retryItem(serverId)`:仅对 `createFailed` 行重新调用 `createTask`。

### 3.2 权限(不变)

| 动作 | perm |
|------|------|
| 启停 | `operation:deploy:exec` |
| 上传 | `operation:file:upload`(自定义后置命令另需 `operation:command:exec`) |
| 命令 | `operation:command:exec` |

## 4. 边界与校验

| 场景 | 行为 |
|------|------|
| 项目无关联服务器 | 空态提示 + 跳转项目管理「关联服务器」 |
| 项目无 serviceKey 映射 | 隐藏「服务控制」区,保留上传/命令 |
| 未勾选任何服务器 | 操作按钮禁用 + 提示 |
| SSH 未配置 | 行禁用勾选,展示 SSH✗ 徽标 |
| 部分创建失败 | 面板中该行 `createFailed`,不影响其他行;可重试 |
| 上传路径预设 | `getDeployPresetsApi(主服务器id)`(白名单为全局 + 每服务器 `upload_allowed_roots`,提示以实际执行为准) |

## 5. 后续增强(未实现)

- 远程命令区「追加服务器」:项目关联之外手动加台账服务器(覆盖纯服务器场景)
- 后端批量编排:滚动重启(逐台确认)、失败中断策略
- 任务历史按 `projectId` 聚合视图

## 6. 验收清单

- [ ] 选项目 → 服务器清单默认全选、主服务器标注、SSH✗ 禁选
- [ ] serviceKey 项目显示运行状态;非映射项目隐藏服务控制
- [ ] 勾 1 台:行为与旧版一致(单任务抽屉)
- [ ] 勾 N 台:确认弹窗列名单 → 批量面板 N 行独立进度/日志
- [ ] 单行创建失败可重试,不影响其他行
- [ ] `npm run build` 通过;i18n 三语齐
