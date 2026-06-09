export type Environment = 1 | 2 | 3 | 4

export type PageQuery = {
  pageNum?: number
  pageSize?: number
  environment?: Environment | ''
}

export type OperationProject = {
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
  createTime?: string | number
}

export type OperationServer = {
  id?: number | string
  serverName?: string
  ip?: string
  innerIp?: string
  port?: string
  environment?: Environment
  remark?: string
  createTime?: string | number
}

export type OperationPlatform = {
  id?: number | string
  platformName?: string
  url?: string
  account?: string
  password?: string
  environment?: Environment
  remark?: string
  createTime?: string | number
}

export type OperationComponent = {
  id?: number | string
  componentName?: string
  serverIp?: string
  account?: string
  password?: string
  deployPath?: string
  port?: string
  version?: string
  environment?: Environment
  remark?: string
  createTime?: string | number
}

export type ProjectQuery = PageQuery & {
  projectName?: string
  serverIp?: string
}

export type ServerQuery = PageQuery & {
  serverName?: string
  ip?: string
}

export type PlatformQuery = PageQuery & {
  platformName?: string
}

export type ComponentQuery = PageQuery & {
  componentName?: string
  serverIp?: string
}

export function createEmptyProject(): OperationProject {
  return { projectName: '', url: '', serverIp: '', innerIp: '', port: '', deployPath: '', environment: 1, remark: '' }
}

export function createEmptyServer(): OperationServer {
  return { serverName: '', ip: '', innerIp: '', port: '', environment: 1, remark: '' }
}

export function createEmptyPlatform(): OperationPlatform {
  return { platformName: '', url: '', account: '', password: '', environment: 1, remark: '' }
}

export function createEmptyComponent(): OperationComponent {
  return {
    componentName: '',
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
