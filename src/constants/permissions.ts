/** 与后端 PermissionConstants / sys_action 一致 */

export const PERM = {

  USER_LIST: 'system:user:list',

  USER_ADD: 'system:user:add',

  USER_EDIT: 'system:user:edit',

  USER_REMOVE: 'system:user:remove',

  USER_RESET_PWD: 'system:user:resetPwd',

  USER_ASSIGN_ROLE: 'system:user:assignRole',

  USER_ASSIGN_SYSTEM: 'system:user:assignSystem',

  ROLE_LIST: 'system:role:list',

  ROLE_ADD: 'system:role:add',

  ROLE_EDIT: 'system:role:edit',

  ROLE_REMOVE: 'system:role:remove',

  ROLE_ASSIGN_PERM: 'system:role:assignPerm',

  ROLE_ASSIGN_USER: 'system:role:assignUser',

  MENU_LIST: 'system:menu:list',

  MENU_ADD: 'system:menu:add',

  MENU_EDIT: 'system:menu:edit',

  MENU_REMOVE: 'system:menu:remove',

  DEPT_LIST: 'system:dept:list',

  DEPT_ADD: 'system:dept:add',

  DEPT_EDIT: 'system:dept:edit',

  DEPT_REMOVE: 'system:dept:remove',

  POST_LIST: 'system:post:list',

  POST_ADD: 'system:post:add',

  POST_EDIT: 'system:post:edit',

  POST_REMOVE: 'system:post:remove',

  DICT_LIST: 'system:dict:list',

  DICT_ADD: 'system:dict:add',

  DICT_EDIT: 'system:dict:edit',

  DICT_REMOVE: 'system:dict:remove',

  SYSTEM_LIST: 'system:system:list',

  SYSTEM_ADD: 'system:system:add',

  SYSTEM_EDIT: 'system:system:edit',

  SYSTEM_REMOVE: 'system:system:remove',

  OPERLOG_LIST: 'system:operlog:list',

  OPERLOG_REMOVE: 'system:operlog:remove',

  LOGINLOG_LIST: 'system:loginlog:list',

  LOGINLOG_REMOVE: 'system:loginlog:remove',

  OP_PLATFORM_LIST: 'operation:platform:list',

  OP_PLATFORM_ADD: 'operation:platform:add',

  OP_PLATFORM_EDIT: 'operation:platform:edit',

  OP_PLATFORM_REMOVE: 'operation:platform:remove',

  OP_SERVER_LIST: 'operation:server:list',

  OP_SERVER_ADD: 'operation:server:add',

  OP_SERVER_EDIT: 'operation:server:edit',

  OP_SERVER_REMOVE: 'operation:server:remove',

  OP_PROJECT_LIST: 'operation:project:list',

  OP_PROJECT_ADD: 'operation:project:add',

  OP_PROJECT_EDIT: 'operation:project:edit',

  OP_PROJECT_REMOVE: 'operation:project:remove',

  OP_COMPONENT_LIST: 'operation:component:list',

  OP_COMPONENT_ADD: 'operation:component:add',

  OP_COMPONENT_EDIT: 'operation:component:edit',

  OP_COMPONENT_REMOVE: 'operation:component:remove',

  /** 查看平台/组件密码明文 */
  OP_SECRET_VIEW: 'operation:secret:view',
  /** 列表行密码管理（设置/修改凭据） */
  OP_SECRET_EDIT: 'operation:secret:edit',
  /** 执行部署脚本 start/stop/restart */
  OP_DEPLOY_EXEC: 'operation:deploy:exec',
  /** 配置服务器 SSH 凭据 */
  OP_SSH_MANAGE: 'operation:ssh:manage',
  /** 上传文件到远程服务器发布 */
  OP_FILE_UPLOAD: 'operation:file:upload',
  /** 远程执行受控 shell 命令 */
  OP_COMMAND_EXEC: 'operation:command:exec',

  KB_SPACE_ADMIN: 'kb:space:admin',
  KB_SPACE_ADD: 'kb:space:add',
  KB_SPACE_EDIT: 'kb:space:edit',
  KB_SPACE_REMOVE: 'kb:space:remove',
  KB_SPACE_MEMBER: 'kb:space:member',
  KB_LINT_SCAN: 'kb:lint:scan',
  KB_SYNC_TRIGGER: 'kb:sync:trigger',
  KB_DOCUMENT_LIST: 'kb:document:list',
  KB_DOCUMENT_ADD: 'kb:document:add',
  KB_DOCUMENT_EDIT: 'kb:document:edit',
  KB_DOCUMENT_PUBLISH: 'kb:document:publish',
  KB_DOCUMENT_ARCHIVE: 'kb:document:archive',
  KB_DOCUMENT_REMOVE: 'kb:document:remove',
  KB_WIKI_EDIT: 'kb:wiki:edit',
  KB_INGEST_LIST: 'kb:ingest:list',
  KB_INGEST_JOB: 'kb:ingest:job',
  KB_INGEST_COMMIT: 'kb:ingest:commit',
  KB_INGEST_RAW_UPLOAD: 'kb:ingest:rawUpload',
  KB_PLATFORM_LLM: 'kb:platform:llm',
  KB_OPS_DASHBOARD: 'kb:ops:dashboard',

} as const

