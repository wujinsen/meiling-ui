-- 角色管理：补「分配权限」「分配用户」按钮动作（menu_id = 3 角色管理页）
-- 已有库执行本脚本；新库请同步更新 01_baseline_data.sql

INSERT INTO `sys_action` (`id`, `perm_code`, `resource`, `action`, `name`, `menu_id`, `order_num`, `status`)
VALUES (75, 'system:role:assignPerm', 'role', 'assignPerm', '分配权限', 3, 4, 1)
ON DUPLICATE KEY UPDATE
  `resource` = VALUES(`resource`),
  `action` = VALUES(`action`),
  `name` = VALUES(`name`),
  `menu_id` = VALUES(`menu_id`),
  `order_num` = VALUES(`order_num`),
  `status` = VALUES(`status`);

INSERT INTO `sys_action` (`id`, `perm_code`, `resource`, `action`, `name`, `menu_id`, `order_num`, `status`)
VALUES (76, 'system:role:assignUser', 'role', 'assignUser', '分配用户', 3, 5, 1)
ON DUPLICATE KEY UPDATE
  `resource` = VALUES(`resource`),
  `action` = VALUES(`action`),
  `name` = VALUES(`name`),
  `menu_id` = VALUES(`menu_id`),
  `order_num` = VALUES(`order_num`),
  `status` = VALUES(`status`);

-- 原拥有「修改角色」的角色，同步授予分配权限/分配用户（可按需注释）
INSERT IGNORE INTO `sys_role_action` (`role_id`, `perm_code`)
SELECT DISTINCT `role_id`, 'system:role:assignPerm'
FROM `sys_role_action`
WHERE `perm_code` = 'system:role:edit';

INSERT IGNORE INTO `sys_role_action` (`role_id`, `perm_code`)
SELECT DISTINCT `role_id`, 'system:role:assignUser'
FROM `sys_role_action`
WHERE `perm_code` = 'system:role:edit';
