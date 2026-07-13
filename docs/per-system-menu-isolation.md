# 按系统隔离菜单 · 后端变更说明（给 moli-server）

> **⚠️ 已废弃（2026-07-13）**  
> 权威文档：[moli-project-distribute/docs/design/sso-menu-system-isolation.md](../../moli-project-distribute/docs/design/sso-menu-system-isolation.md) · [sso-menu-frontend-handoff.md](api/sso-menu-frontend-handoff.md) · Q5 以 **admin 内嵌 900（Q5-A）** 为准，非下文「仅知识库系统」方案。

最后更新: 2026-06-22（历史稿）  
提出方: meiling-ui 前端（T6 企业知识库）  
目标读者: `moli-project-single` / 模块 `moli-server` 后端

> 一句话需求：**用户从门户进入某个 INTERNAL 系统后，侧栏只显示「该系统」的菜单**（例如进入「企业知识库」只看到知识库菜单，不再混着 moli-admin 的用户/角色/菜单等）。
> 这个效果**前端做不到**，因为菜单数据由后端 `getRouters` / `enter` 下发；需要后端按「当前系统」过滤菜单。本文是给后端的实现说明。

---

## 1. 现状（为什么现在做不到）

`getRouters` 返回的是当前用户的全量菜单，**和进入哪个系统无关**：

`MenuController#getRouters`
```java
public MoliResult<List<MenuVo>> getRouters() {
    Long userId = ShiroUtils.getUserInfo().getId();
    SysUser sysUser = ShiroUtils.getUserInfo();
    if (CommonConstant.hasFullPermission(sysUser.getUserName())) {
        return MoliResult.success(menuService.getMenuTreeAll());   // 超管：全部菜单
    }
    List<MenuVo> menuVoList = menuService.selectMenuTreeByUserId(userId); // 普通用户：按角色
    return MoliResult.success(menuVoList);
}
```

`SysSystemServiceImpl#enterSystem` 的 INTERNAL 分支同理（`resolveMenus(user)` 不区分系统）：
```java
private List<MenuVo> resolveMenus(SysUser user) {
    if (CommonConstant.hasFullPermission(user.getUserName())) {
        return menuService.getMenuTreeAll();
    }
    return menuService.selectMenuTreeByUserId(user.getId());
}
```

**好消息**：`enterSystem` 进入时已经把「当前系统」写进了 Shiro Session，过滤所需的上下文已经具备：
```java
ShiroUtils.setCurrentSystem(system.getId(), system.getSystemCode());
```

所以只要让取菜单的逻辑读这个「当前系统」并过滤即可。

---

## 2. 改动方案

### 2.1 库表：`sys_menu` 增加归属系统列

给每条菜单打上「属于哪个系统」。

```sql
-- 1) 加列（可空，便于灰度）
ALTER TABLE sys_menu
  ADD COLUMN system_id BIGINT NULL COMMENT '所属系统 sys_system.id；NULL 视为 moli-admin' AFTER parent_id;

-- 2) 现有菜单全部回填到 moli-admin（保持老行为不变；<MOLI_ADMIN_SYSTEM_ID> 替换为实际 id）
UPDATE sys_menu SET system_id = <MOLI_ADMIN_SYSTEM_ID> WHERE system_id IS NULL;

-- 3) 知识库菜单挂到「企业知识库」系统（建菜单后执行；见 §5）
-- UPDATE sys_menu SET system_id = <KB_SYSTEM_ID> WHERE menu_name IN ('企业知识库','知识库浏览','智能问答','关系图谱','知识体检');

-- 4)（可选）索引
CREATE INDEX idx_sys_menu_system ON sys_menu(system_id);
```

> 用 `system_code` 也可以，按你们现有习惯二选一。下文按 `system_id` 描述。

### 2.2 取菜单按「当前系统」过滤

核心：在 `getRouters` / `resolveMenus` / `selectMenuTreeByUserId` / 超管 `getMenuTreeAll` 这条**登录后侧栏**链路上，统一按当前系统过滤。

建议在 service 层取「当前系统」：
```java
Long currentSystemId = ShiroUtils.getCurrentSystemId(); // enter 时已 setCurrentSystem；若无 getter 需补
```

过滤规则（建议封装成一个方法，四处复用）：
```text
若 currentSystemId == null（未进入任何系统 / 门户关闭 / 单系统自动进未落 session）
    → 兜底：按 moli-admin 过滤（或返回全部，按产品定）
否则
    → 只保留 system_id == currentSystemId 的菜单（含其祖先目录，避免子菜单的父目录被裁掉）
```

要点：
- **超管分支也要过滤**。`getRouters` 对超管走 `getMenuTreeAll()`，否则超管在每个系统都看到全部菜单，隔离失效。
- 过滤后要**补齐祖先节点**再 `createTree`，否则叶子菜单的父目录被过滤掉会导致整棵子树消失。
- `enterSystem` 的 `resolveMenus` 用同一套过滤（此时 `setCurrentSystem` 刚写入，直接用 `system.getId()` 即可）。

### 2.3 不要误伤的链路

以下属于「菜单管理 / 角色授权」，应**继续返回跨系统全量**，不要套用上面的过滤：

- `GET /menu/getMenuTreeAll`（菜单管理、角色授权树）
- `GET /menu/selectMenuTreeByRoleId/{roleId}`
- `GET /menu/list`

否则没法给知识库菜单做 CRUD 和授权。

> 实现提示：把「侧栏过滤」做成 `getRouters`/`enter` 专用，不要塞进被管理页共用的 `getMenuTreeAll`。

---

## 3. 边界与风险

| 场景 | 处理 |
|------|------|
| 未 enter / session 无当前系统 | 兜底按 moli-admin（或全部），避免侧栏空白 |
| 门户关闭、单系统自动进 | `fillLoginContext` 是否会 `setCurrentSystem`？若不会，需补，否则登录后侧栏会被过滤空 |
| F5 刷新 | 依赖 Shiro Session 里的当前系统仍在；Session 有效即可 |
| 超管 | 同样过滤；否则隔离失效 |
| 现有菜单漏标 system_id | 会从侧栏消失；迁移务必全量回填 moli-admin |
| 切换系统 `/system/switch` | 复用 `enter`，已 `setCurrentSystem`，自动生效 |

---

## 4. 对前端 / 接口契约的影响

- **`getRouters` / `enter` 的响应结构不变**（仍是 `MenuVo[]` / `SystemEnterVo`），只是内容按系统收窄。前端**无需改动**。
- 前端已就绪：
  - `viewRegistry` 已把知识库 `component` 映射到页面（见 §5 表）；
  - 知识库数据走网关 `/KnowledgeServer/...`，与本变更无关。
- 验证方式：进入「企业知识库」→ `GET /menu/getRouters` 只返回知识库那棵树；进入 moli-admin → 返回原有菜单。

---

## 5. 知识库菜单登记（建好后挂到 KB 系统）

在「菜单管理」新增 1 目录 + 4 菜单，并把它们的 `system_id` 设为「企业知识库」系统 id：

| menuType | 名称 | path | component | route_name | perms(建议) | icon |
|---|---|---|---|---|---|---|
| M 目录 | 企业知识库 | `knowledge` | `Layout` | `Knowledge` | 留空 | `knowledge` |
| C 菜单 | 知识库浏览 | `browse` | `knowledge/browse/index` | `KnowledgeBrowse` | `knowledge:doc:list` | `documentation` |
| C 菜单 | 智能问答 | `ask` | `knowledge/ask/index` | `KnowledgeAsk` | `knowledge:ask` | `query` |
| C 菜单 | 关系图谱 | `graph` | `knowledge/graph/index` | `KnowledgeGraph` | `knowledge:graph` | `graph` |
| C 菜单 | 知识体检 | `lint` | `knowledge/lint/index` | `KnowledgeLint` | `knowledge:lint` | `health` |

约束（否则白屏/404）：
- 子菜单 `component` 必须与上表完全一致且带 `/index`（这是前端 `viewRegistry` 的 key）。
- 4 个子菜单上级选「企业知识库」目录；浏览器地址为 `/knowledge/browse`、`/knowledge/ask`…
- `icon` 用的 `knowledge/query/graph/health` 已在前端注册。

---

## 6. 验收

- [ ] `sys_menu` 加 `system_id`，现有菜单全部回填 moli-admin
- [ ] 进入 moli-admin：侧栏菜单与改造前一致（无回归）
- [ ] 进入「企业知识库」：侧栏**只**有知识库那棵树（含超管）
- [ ] 菜单管理 / 角色授权仍可看到跨系统全量菜单
- [ ] 未进入系统 / 门户关闭场景有兜底，不空白
- [ ] 切换系统后侧栏随之切换

---

## 7. 备选：纯前端裁剪（不改后端，不推荐）

若后端暂不改：前端可按 `currentSystem.systemCode` → 菜单路径前缀的硬编码映射，在侧栏层裁剪到对应子树。缺点：映射要手维护、全量菜单其实仍下发（仅不显示）、隔离不彻底（直接敲 URL 仍可达其它系统页面）。仅作过渡，建议最终走后端方案。
