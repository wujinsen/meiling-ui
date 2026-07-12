export type Environment = 1 | 2 | 3 | 4

export type PageQuery = {
  pageNum?: number
  pageSize?: number
  environment?: Environment | ''
}

export type LinkedServerRow = {
  serverId?: number | string
  serverIds?: (number | string)[]
  serverIp?: string
  innerIp?: string
}

export type OperationProject = {
  id?: number | string
  serverId?: number | string
  /** N:N 关联服务器；首项为主服务器（驱动 serverIp / 部署状态） */
  serverIds?: (number | string)[]
  serverIp?: string
  innerIp?: string
  url?: string
  projectName?: string
  deployPath?: string
  port?: string
  environment?: Environment
  remark?: string
  createTime?: string | number
  expectedPort?: string | null
  portMatchStatus?: number | null
  deployRunning?: boolean | null
  lastDeployCheckTime?: string | number | null
}

export type ServerRole = 'app' | 'db' | 'cache' | 'mq' | 'gateway' | 'bastion' | 'middleware' | 'other'

export type OperationServer = {
  id?: number | string
  serverName?: string
  ip?: string
  innerIp?: string
  port?: string
  environment?: Environment
  serverRole?: ServerRole | string | null
  tags?: string[]
  remark?: string
  status?: number | null
  lastCheckTime?: string | number | null
  createTime?: string | number
  sshPort?: number | null
  sshUser?: string | null
  sshAuthType?: number | null
  connPref?: string | null
  sshConfigured?: boolean | null
  uploadAllowedRoots?: string | null
}

export type OperationTopologyProject = {
  id?: number | string
  serverId?: number | string
  serverIp?: string
  innerIp?: string
  url?: string
  projectName?: string
  deployPath?: string
  port?: string
  environment?: Environment
  remark?: string
}

export type OperationTopologyComponent = {
  id?: number | string
  componentName?: string
  serverIp?: string
  port?: string
  version?: string
  deployPath?: string
  environment?: Environment
  status?: number | null
  lastCheckTime?: string | number | null
}

export type OperationServerTopology = {
  server?: OperationServer
  projects?: OperationTopologyProject[]
  components?: OperationTopologyComponent[]
}

export type OperationServerLinks = {
  serverId?: number | string
  projectIds?: (number | string)[]
  componentIds?: (number | string)[]
}

export type OperationProjectLinks = {
  projectId?: number | string
  serverIds?: (number | string)[]
}

export type OperationComponentLinks = {
  componentId?: number | string
  serverIds?: (number | string)[]
}

export type OperationHealthProbeResult = {
  serversProbed?: number
  componentsProbed?: number
  deployStatusesSynced?: number
  serverIdsSynced?: number
}

export type OperationPlatform = {
  id?: number | string
  platformName?: string
  url?: string
  account?: string
  /** 仅提交时使用；GET 不返回明文 */
  password?: string
  passwordConfigured?: boolean
  passwordMask?: string | null
  environment?: Environment
  remark?: string
  createTime?: string | number
}

export type OperationComponent = {
  id?: number | string
  serverId?: number | string
  /** N:N 关联服务器；首项为主服务器（驱动 serverIp / 探活） */
  serverIds?: (number | string)[]
  componentName?: string
  serverIp?: string
  account?: string
  /** 仅提交时使用；GET 不返回明文 */
  password?: string
  passwordConfigured?: boolean
  passwordMask?: string | null
  status?: number | null
  lastCheckTime?: string | number | null
  deployPath?: string
  port?: string
  version?: string
  environment?: Environment
  remark?: string
  createTime?: string | number
  expectedPort?: string | null
  portMatchStatus?: number | null
}

export type ProjectQuery = PageQuery & {
  projectName?: string
  serverIp?: string
}

export type ServerQuery = PageQuery & {
  serverName?: string
  ip?: string
  environment?: Environment
  serverRole?: ServerRole | string
  tag?: string
}

export type PlatformQuery = PageQuery & {
  platformName?: string
}

export type ComponentQuery = PageQuery & {
  componentName?: string
  serverIp?: string
}

export function createEmptyProject(): OperationProject {
  return { projectName: '', serverId: '', serverIds: [], url: '', serverIp: '', innerIp: '', port: '', deployPath: '', environment: 1, remark: '' }
}

export function createEmptyServer(): OperationServer {
  return { serverName: '', ip: '', innerIp: '', port: '', environment: 1, serverRole: 'app', tags: [], remark: '' }
}

export function createEmptyPlatform(): OperationPlatform {
  return { platformName: '', url: '', account: '', password: '', environment: 1, remark: '' }
}

export function createEmptyComponent(): OperationComponent {
  return {
    componentName: '',
    serverId: '',
    serverIds: [],
    serverIp: '',
    account: '',
    password: '',
    deployPath: '',
    port: '',
    version: '',
    environment: 1,
    remark: '',
  }
}

export type OperationPortAuditItem = {
  id?: number | string
  recordType?: 'project' | 'component'
  name?: string
  actualPort?: string | null
  expectedPort?: string | null
  matrixKey?: string | null
  portMatchStatus?: number | null
  message?: string
  environment?: Environment
}

export type OperationPortMatrixEntry = {
  key?: string
  expectedPort?: string
  source?: string
}

export type OperationPortAudit = {
  total?: number
  matched?: number
  mismatched?: number
  unmapped?: number
  skipped?: number
  matrix?: OperationPortMatrixEntry[]
  items?: OperationPortAuditItem[]
}

export type OperationPortMatrix = {
  id?: number | string
  matrixKey: string
  displayName?: string
  expectedPort: string
  aliases?: string[]
  sortOrder?: number
  enabled?: boolean
  source?: string
  remark?: string
  createTime?: string | number
  updateTime?: string | number
}

export type PortMatrixSaveRequest = {
  id?: number | string
  matrixKey: string
  displayName?: string
  expectedPort: string
  aliases?: string[]
  sortOrder?: number
  enabled?: boolean
  source?: string
  remark?: string
}

export type PortMatrixQuery = PageQuery & {
  matrixKey?: string
  displayName?: string
  enabled?: boolean
}

export function createEmptyPortMatrix(): OperationPortMatrix {
  return {
    matrixKey: '',
    displayName: '',
    expectedPort: '',
    aliases: [],
    sortOrder: 0,
    enabled: true,
    remark: '',
  }
}

export type OperationStats = {
  projects?: number
  servers?: number
  platforms?: number
  components?: number
  portMismatches?: number
  healthDown?: number
  envBreakdown?: { env: number; count: number }[]
}

export type DeployExecAction = 'start' | 'stop' | 'restart'

export type OperationDeployStatus = {
  serviceKey?: string
  action?: string
  available?: boolean
  running?: boolean
  output?: string
  message?: string
}

export type OperationServerSsh = {
  sshPort?: number
  sshUser?: string
  sshAuthType?: number
  privateKey?: string
  passphrase?: string
  connPref?: string
  uploadAllowedRoots?: string | null
}

export type OperationSshTest = {
  success?: boolean
  host?: string
  output?: string
  elapsedMs?: number
  message?: string
}

export type OperationTask = {
  id?: number | string
  taskType?: string
  serverId?: number | string | null
  projectId?: number | string | null
  serviceKey?: string | null
  action?: string
  targetName?: string | null
  status?: string
  progress?: number
  message?: string | null
  logChunk?: string
  nextLogOffset?: number
  finished?: boolean
  createTime?: string | number
  finishTime?: string | number | null
}

export type TaskQuery = PageQuery & {
  taskType?: string
  serverId?: number | string
  projectId?: number | string
}

/** 异步任务类型（SVR-14） */
export const OPERATION_TASK_TYPES = ['deploy', 'upload', 'command', 'health_probe'] as const
export type OperationTaskType = (typeof OPERATION_TASK_TYPES)[number]

/** moli 三件套 serviceKey */
export const MOLI_DEPLOY_SERVICES = ['user-center', 'gateway', 'knowledge'] as const
export type MoliDeployServiceKey = (typeof MOLI_DEPLOY_SERVICES)[number]

/** 上传目标路径白名单（与后端 ops.upload.allowed-paths 默认一致） */
export const UPLOAD_TARGET_PATHS = [
  '/opt/moli/frontend/dist/',
  '/opt/moli-project-distribute/moli-user-center/',
  '/opt/moli-project-distribute/moli-gateway/',
  '/opt/moli-project-distribute/moli-knowledge/',
] as const

/** 上传后置：快捷预设值或 custom */
export type UploadPostAction =
  | 'none'
  | 'nginxReload'
  | 'unzipToDist'
  | 'restartService:user-center'
  | 'restartService:gateway'
  | 'restartService:knowledge'
  | 'custom'

export type UploadPostMode = 'none' | 'preset' | 'custom'

export type OperationDeployPresetItem = {
  value: string
  label: string
}

export type OperationDeployServiceOption = {
  key: string
  label?: string
}

export type OperationDeployPresets = {
  pathPresets: string[]
  actionPresets: OperationDeployPresetItem[]
  /** 当前服务器可用的 deploy serviceKey 列表（S9 / SVR-20） */
  serviceKeys?: OperationDeployServiceOption[] | string[]
}

export type OperationCommandExec = {
  serverId: number | string
  command: string
  workDir?: string
}
