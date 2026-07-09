-- =============================================================
-- 运营管理 · 密码管理（列表行「密码管理」按钮）
-- 挂载：运营管理父菜单 menu_id = 400（与 secret:view / deploy:exec 同级）
-- 执行后重新登录或刷新 capabilities
-- =============================================================
SET NAMES utf8mb4;

INSERT INTO `sys_action` (`perm_code`, `resource`, `action`, `name`, `menu_id`, `order_num`, `status`) VALUES
('operation:secret:edit', 'operation', 'secretEdit', '密码管理', 400, 3, 1)
ON DUPLICATE KEY UPDATE
  `resource` = VALUES(`resource`),
  `action` = VALUES(`action`),
  `name` = VALUES(`name`),
  `menu_id` = VALUES(`menu_id`),
  `order_num` = VALUES(`order_num`),
  `status` = VALUES(`status`);

-- 已有平台/组件编辑权限的角色，同步授予密码管理（可按需注释）
INSERT IGNORE INTO `sys_role_action` (`role_id`, `perm_code`)
SELECT DISTINCT `role_id`, 'operation:secret:edit'
FROM `sys_role_action`
WHERE `perm_code` IN ('operation:platform:edit', 'operation:component:edit');
