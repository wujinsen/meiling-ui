-- 文档管理菜单与动作权限（menu_id 910，避免占用 ingest 的 906）
-- 在 04_knowledge_menu.sql 之后执行；执行后重新登录
--
-- 2026-06-24 起：Web 不再使用 POST /kb/document 直连写库；新建/编辑走 kb:wiki:edit + Wiki 同步。
-- 下列 kb:document:add/edit/publish/archive/remove 动作权限保留兼容旧角色绑定，前端已不再调用。

INSERT INTO `sys_menu` VALUES
(910, 1, NOW(), 1, NOW(), '文档管理', 'Documents', '文書管理', 900,
 'documents', 'knowledge/documents/index', 'KnowledgeDocuments', 'C', 'kb:document:list', 1, 'edit', 2)
ON DUPLICATE KEY UPDATE
  menu_name = VALUES(menu_name), menu_name_en = VALUES(menu_name_en), menu_name_ja = VALUES(menu_name_ja),
  parent_id = VALUES(parent_id), path = VALUES(path), component = VALUES(component), route_name = VALUES(route_name),
  menu_type = VALUES(menu_type), perms = VALUES(perms), status = VALUES(status), icon = VALUES(icon),
  order_num = VALUES(order_num), update_time = NOW();

INSERT INTO `sys_action` (`perm_code`, `resource`, `action`, `name`, `menu_id`, `order_num`, `status`) VALUES
('kb:document:add',     'kb', 'documentAdd',     '新建文档', 910, 1, 1),
('kb:document:edit',    'kb', 'documentEdit',    '编辑文档', 910, 2, 1),
('kb:document:publish', 'kb', 'documentPublish', '发布文档', 910, 3, 1),
('kb:document:archive', 'kb', 'documentArchive', '归档文档', 910, 4, 1),
('kb:document:remove',  'kb', 'documentRemove',  '删除文档', 910, 5, 1)
ON DUPLICATE KEY UPDATE
  resource = VALUES(resource), action = VALUES(action), name = VALUES(name),
  menu_id = VALUES(menu_id), order_num = VALUES(order_num), status = VALUES(status);

INSERT INTO `sys_role_menu` (`id`, `role_id`, `menu_id`) VALUES
(910900910, 2, 910),
(910903910, 3, 910)
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), menu_id = VALUES(menu_id);

INSERT INTO `sys_role_action` (`role_id`, `perm_code`) VALUES
(2, 'kb:document:add'), (2, 'kb:document:edit'), (2, 'kb:document:publish'),
(2, 'kb:document:archive'), (2, 'kb:document:remove'),
(3, 'kb:document:add'), (3, 'kb:document:edit'), (3, 'kb:document:publish')
ON DUPLICATE KEY UPDATE perm_code = VALUES(perm_code);

-- 旧 MySQL 正文编辑路由：仅用于书签重定向到 Wiki 编辑（KnowledgeDocumentEditView）
INSERT INTO `sys_menu` VALUES
(907, 1, NOW(), 1, NOW(), '编辑文档', 'Edit document', '文書編集', 910,
 'documents/edit/:id', 'knowledge/documents/edit', 'KnowledgeDocumentEdit', 'C', 'kb:document:edit', 1, '', 99, 1)
ON DUPLICATE KEY UPDATE
  menu_name = VALUES(menu_name), menu_name_en = VALUES(menu_name_en), menu_name_ja = VALUES(menu_name_ja),
  parent_id = VALUES(parent_id), path = VALUES(path), component = VALUES(component), route_name = VALUES(route_name),
  menu_type = VALUES(menu_type), perms = VALUES(perms), status = VALUES(status), icon = VALUES(icon),
  order_num = VALUES(order_num), hidden = VALUES(hidden), update_time = NOW();

INSERT INTO `sys_role_menu` (`id`, `role_id`, `menu_id`) VALUES
(910900907, 2, 907),
(910903907, 3, 907)
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), menu_id = VALUES(menu_id);
