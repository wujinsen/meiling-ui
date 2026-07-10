-- =============================================================
-- KBOPS-9 · 企业知识库 → 运维看板菜单
-- 挂载：企业知识库（parent_id=900）
-- 设计：docs/api/knowledge-ops-frontend.md §8
-- 执行后重新登录
-- =============================================================
SET NAMES utf8mb4;

INSERT INTO `sys_menu` VALUES
(921, 1, NOW(), 1, NOW(), '运维看板', 'Ops Dashboard', '運用ダッシュボード', 900,
 'ops/dashboard', 'knowledge/ops/dashboard/index', 'KnowledgeOpsDashboard', 'C', 'kb:ops:dashboard', 1, 'dashboard', 6)
ON DUPLICATE KEY UPDATE
  menu_name = VALUES(menu_name), menu_name_en = VALUES(menu_name_en), menu_name_ja = VALUES(menu_name_ja),
  parent_id = VALUES(parent_id), path = VALUES(path), component = VALUES(component), route_name = VALUES(route_name),
  menu_type = VALUES(menu_type), perms = VALUES(perms), status = VALUES(status), icon = VALUES(icon),
  order_num = VALUES(order_num), update_time = NOW();

INSERT INTO `sys_action` (`perm_code`, `resource`, `action`, `name`, `menu_id`, `order_num`, `status`) VALUES
('kb:ops:dashboard', 'kb', 'opsDashboard', '知识库运维看板', 921, 1, 1)
ON DUPLICATE KEY UPDATE
  resource = VALUES(resource), action = VALUES(action), name = VALUES(name),
  menu_id = VALUES(menu_id), order_num = VALUES(order_num), status = VALUES(status);

INSERT INTO `sys_role_menu` (`id`, `role_id`, `menu_id`) VALUES
(910900921, 2, 921)
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), menu_id = VALUES(menu_id);

INSERT INTO `sys_role_action` (`role_id`, `perm_code`) VALUES
(2, 'kb:ops:dashboard')
ON DUPLICATE KEY UPDATE perm_code = VALUES(perm_code);
