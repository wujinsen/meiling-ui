# 知识库浏览 — 体裁 / 分类「多选筛选」需求与接口方案

> 面向后端（`moli-knowledge-server`，位于 `moli-project-distribute/moli-knowledge`）。
> 前端：`meiling-ui`，文档浏览页 `src/views/knowledge/KnowledgeBrowseView.vue`。
> 目标：**体裁、分类都支持多选**（维度内 OR、维度间 AND），列表分页与 facet 计数需由后端支持。

---

## 1. 背景与痛点

浏览页左侧有两个筛选维度：

- **体裁 kbType**：全局白名单（`guide/service/concept/article/interview/output`）。
- **分类 category**：**每个空间各自的目录树**（categoryId），跨空间会重名、对不上，因此分类筛选仅在「锁定单个空间」时启用。

当前两者都是**单选**，实际使用中暴露出的痛点：

1. **无法多选**：用户想同时看「文章 + 面试题」，或「技术 + 运维」两个分类，现在只能一个个切。
2. **单选 + 联动收窄**导致「选了体裁，分类几乎只能选一个」——因为某体裁的文档常集中在少数分类，交集为 0 的分类只能置灰/空结果。多选能显著缓解。
3. 列表是**后端分页**（`GET /kb/document/search`），facet 计数也来自后端，**前端无法自行合并多值**（会破坏分页与总数），必须后端支持传多个值。

---

## 2. 目标筛选模型

- **维度内 OR**：选中「文章」「面试题」→ 命中 `kb_type IN ('article','interview')`。
- **维度间 AND**：体裁与分类同时选中时取交集。
- **空 = 全部**：某维度未选任何项即不对该维度过滤。
- **联动计数（facet）**：
  - 体裁各项计数 = 在「当前已选分类集合」约束下的文档数；
  - 分类各项计数 = 在「当前已选体裁集合」约束下的文档数；
  - 交集为 0 的项前端仍展示（计数 0、淡显），可点，不锁死。
- **分类多选仍限单空间**（沿用现有 `taxonomyNeedSingleSpace` 规则）。

---

## 3. 涉及的后端接口（现状 → 期望）

### 3.1 文档搜索（浏览列表 / 文档管理列表）

`GET /kb/document/search` → `DocumentSearchRequest`

**现状字段**（`dto/DocumentSearchRequest.java`）：

```
Long spaceId; List<Long> spaceIds;
Long categoryId; Boolean uncategorizedOnly;
String kbType;      // 单个体裁
String keyword; Integer status; Long tagId; String source;
Integer pageNum; Integer pageSize;
```

**期望新增**（保留旧字段向后兼容，列表优先）：

```
List<String> kbTypes;     // 多体裁，OR；空/缺省=不过滤
List<Long>   categoryIds; // 多分类，OR；空/缺省=不过滤
// uncategorizedOnly 仍保留：可与 categoryIds 组合表示「含未分类」
```

语义：
- `kbTypes` 非空 → `kb_type IN (...)`；否则回退到 `kbType`（单值）；都空则不过滤。
- `categoryIds` 非空 → `category_id IN (...)`；`uncategorizedOnly=true` 时并入 `OR category_id IS NULL`；否则回退到 `categoryId`。
- 每个 kbType 需走 `KbTypeConstants.normalize` 校验，非法值报错（同现有单值逻辑）。

> `GET /kb/document/search` 由 `DocumentSearchRequest` 直接绑定查询参数，`List<String> kbTypes` 可用重复参数 `kbTypes=article&kbTypes=interview` 绑定，无需改签名。Mapper `searchDocuments(...)` 的 `kbType` 入参需扩展为列表并改 SQL。

### 3.2 分类 facet 计数（联动体裁）

`GET /kb/index?groupBy=category` → `IndexTreeVo`（按分类分组计数）

**现状参数**：`spaceId, spaceIds, kbType（单）, groupBy`
**期望新增**：`List<String> kbTypes`（按选中的多个体裁 OR 约束后，再按分类分组计数）

- `KbBrowseController#index` 增参 `@RequestParam(required=false) List<String> kbTypes`；
- `KbBrowseService#index(...)` 签名与实现相应扩展；
- SQL 计数条件 `kb_type = #{kbType}` → `kb_type IN (...)`。

### 3.3 体裁 facet 计数（联动分类）

`GET /kb/index/types` → `KbTypeFacetVo`（各 kb_type 计数）

**现状参数**：`spaceId, spaceIds, categoryId（单）, uncategorizedOnly`
**期望新增**：`List<Long> categoryIds`（按选中的多个分类 OR 约束后，再按体裁计数）

- `KbBrowseController#indexTypes` 增参 `List<Long> categoryIds`；
- `KbBrowseService#types(...)` 扩展；
- Mapper `countPublishedByKbType(...)` 的 `categoryId` 入参扩展为列表，SQL `category_id = #{categoryId}` → `category_id IN (...)`，`uncategorizedOnly` 逻辑保留。

### 3.4 不需要改动

`/kb/index/items`、`/kb/index/search`、`/kb/index/locate`、`/kb/page` 不涉及体裁/分类多选，保持不变。

---

## 4. Mapper / SQL 改动要点

1. `KbDocumentMapper.searchDocuments`：`kbType` → `kbTypes(List)`，XML 用
   ```xml
   <if test="kbTypes != null and kbTypes.size() > 0">
     AND kb_type IN <foreach collection="kbTypes" item="t" open="(" separator="," close=")">#{t}</foreach>
   </if>
   ```
   分类同理（`categoryIds` + `uncategorizedOnly`）。
2. `KbDocumentMapper.countPublishedByKbType`：`categoryId` → `categoryIds(List)`，`IN (...)`。
3. `/kb/index` 分组计数 SQL：`kbType` → `kbTypes(List)`，`IN (...)`。
4. 空列表按「不过滤」处理（`<if size>0>` 保证）。

---

## 5. 向后兼容

- 旧单值字段 `kbType` / `categoryId` **保留**；当列表字段非空时以列表为准，否则回退单值。
- 现有单选调用方（如别处仍传 `kbType=article`）不受影响。

---

## 6. 前端改动（`meiling-ui`，本仓自行完成，供后端了解契约）

- `useKbDocFilter`：`kbTypeFilter: string|null → string[]`；分类由 `'all'|'uncategorized'|id` 单值改为「已选集合 `string[]`（含 `'uncategorized'` 成员）」。
- 请求构造：`buildKbDocumentSearchQuery` / `buildKbBrowseScopeQuery` 追加重复参数 `kbTypes`、`categoryIds`。
- facet 拉取：体裁计数带 `categoryIds`，分类计数带 `kbTypes`。
- 下拉组件 `KbDocFilterTabs`（dropdown 布局）：改为**复选**——点选切换、不自动关闭；触发器显示「已选 N 项」或首项 + 计数；保留「清除筛选」一键清空。
- 交集为 0 项：淡显、可点（不禁用）。
- 分类多选仍受「单空间」约束。

### 接口契约示例

```
# 体裁多选 + 分类多选（单空间）
GET /KnowledgeServer/kb/document/search?spaceId=900...&source=kb&status=1
    &kbTypes=article&kbTypes=interview
    &categoryIds=12&categoryIds=34
    &pageNum=1&pageSize=50

# 分类 facet 计数（受已选体裁约束）
GET /KnowledgeServer/kb/index?groupBy=category&spaceId=900...
    &kbTypes=article&kbTypes=interview

# 体裁 facet 计数（受已选分类约束）
GET /KnowledgeServer/kb/index/types?spaceId=900...
    &categoryIds=12&categoryIds=34
```

响应结构不变（`IndexTreeVo` / `KbTypeFacetVo` / `Page<KbDocument>`）。

---

## 7. 后端确认（2026-07 已落地）

1. `DocumentSearchRequest` 已增 `kbTypes` / `categoryIds`；重复查询参数绑定 List 可用。
2. `/kb/index`、`/kb/index/types` 已支持列表参数与 SQL `IN`。
3. 非法 `kbTypes`：整体报错（与单值一致）。
4. `uncategorizedOnly` + `categoryIds`：`IN (...) OR IS NULL`。

契约权威见 `moli-project-distribute/docs/api/KNOWLEDGE_API.md` §2.1.3 v3；前端探针 `npm run kb:prd` → `P0-browse-v3`。
