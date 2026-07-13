-- W9 · 部署中心多机 batch/task 联调种子（本地 dev）
-- 前置：server 201 已配置 SSH（ssh_private_key 非空）
-- 执行：npm run op:seed:w9  （或 node scripts/seed-operation-w9-dual-server.mjs）
--
-- 说明：后端 batch 带 projectId 时，若项目主表 server_id 非空，仅允许与主 server_id 一致的步骤。
--       多机 W9 需在 N:N 关联写入后，将项目 server_id 置 NULL（保留 operation_server_project 关联）。

-- ① 第二台服务器：克隆 201 的 SSH 与网络（同机双台账，仅 walkthrough 用）
--    由 seed 脚本按 API 创建后，用下方 UPDATE（:W9_SERVER_B_ID 替换为脚本输出的 id）

-- UPDATE operation_server_info dst
-- INNER JOIN operation_server_info src ON src.id = 201
-- SET dst.ip = src.ip,
--     dst.inner_ip = src.inner_ip,
--     dst.ssh_port = src.ssh_port,
--     dst.ssh_user = src.ssh_user,
--     dst.ssh_auth_type = src.ssh_auth_type,
--     dst.ssh_private_key = src.ssh_private_key,
--     dst.ssh_passphrase = src.ssh_passphrase,
--     dst.conn_pref = src.conn_pref,
--     dst.upload_allowed_roots = src.upload_allowed_roots
-- WHERE dst.id = :W9_SERVER_B_ID;

-- ② 多机 batch：清空项目主 server_id（N:N 关联仍由 operation_server_project 维护）
-- UPDATE operation_project_deploy_info SET server_id = NULL WHERE id = :W9_PROJECT_ID;
