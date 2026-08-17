export type ConfigValueType = 'BOOLEAN' | 'INT' | 'STRING'

export type ConfigSource = 'DB_OVERRIDE' | 'ENVIRONMENT' | 'DEFAULT'

export type ConfigGroupCode = 'SECURITY' | 'PORTAL' | 'OPS' | string

export type ConfigItem = {
  configKey: string
  effectiveValue?: string
  defaultValue?: string
  valueType?: ConfigValueType
  groupCode?: ConfigGroupCode
  groupName?: string
  description?: string
  source?: ConfigSource
  overridden?: boolean
}

export type ConfigUpdateRequest = {
  configKey: string
  configValue: string
}
