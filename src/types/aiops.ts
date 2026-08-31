export type AiopsHealthStatus = {
  ok: boolean
  llm_configured: boolean
  llm_providers: string[]
  cmdb_source: string
  inventory_targets: string[]
  exec_enabled: boolean
  force_dry_run: boolean
}

export type AiopsDiagnoseRequest = {
  title: string
  target: string
  service?: string
  description?: string
  source?: string
}

export type AiopsDiagnoseStart = {
  run_id: string
  incident_id: string
}

export type AiopsRunSummary = {
  run_id: string
  incident_id: string
  title: string
  target: string
  severity?: string
  status: string
  degraded?: boolean
  created_at: string
  updated_at?: string
}

export type AiopsPlanStep = {
  id: string
  order: number
  intent: string
  action?: string
  service?: string
  command?: string
  target?: string
  risk: 'read_only' | 'mutating' | 'destructive' | string
  requires_approval?: boolean
  risk_reason?: string
  blast_radius?: string
  rollback?: string
  verification?: string
}

export type AiopsApprovalPayload = {
  root_cause?: string
  summary?: string
  out_of_scope?: string[]
  steps?: AiopsPlanStep[]
  incident_id?: string
}

export type AiopsProgressEvent = {
  type: string
  ts?: string
  node?: string
  message?: string
  pct?: number
  payload?: AiopsApprovalPayload
  status?: string
}

export type AiopsTraceRow = {
  node: string
  duration_ms?: number
  status?: string
  provider?: string
  model?: string
  prompt_tokens?: number
  completion_tokens?: number
  fallback_used?: boolean
  tool_calls?: unknown[]
}

export type AiopsTraceSummary = {
  total_duration_ms?: number
  prompt_tokens?: number
  completion_tokens?: number
  fallback_calls?: number
}

export type AiopsRunDetail = {
  run: AiopsRunSummary & Record<string, unknown>
  next: unknown[]
  interrupts: Array<{ value?: AiopsApprovalPayload }>
  values?: {
    report?: { markdown?: string }
    status?: string
    progress?: Array<{ phase?: string; message?: string; pct?: number }>
  }
  trace?: AiopsTraceRow[]
  trace_summary?: AiopsTraceSummary
}

export type AiopsApproveRequest = {
  approver: string
  approved_step_ids: string[]
  comment?: string
}

export type AiopsRejectRequest = {
  approver: string
  comment?: string
}
