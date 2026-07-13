<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  createCommandTaskApi,
  createDeployBatchTaskApi,
  createDeployTaskApi,
  getDeployPresetsApi,
  getDeployStatusApi,
  getProjectLinksApi,
  listProjectApi,
  listServerApi,
  uploadFileApi,
} from '@/api/operation'
import DeployBatchTaskPanel from '@/components/operation/DeployBatchTaskPanel.vue'
import DeployTaskDrawer from '@/components/operation/DeployTaskDrawer.vue'
import EnvironmentBadge from '@/components/operation/EnvironmentBadge.vue'
import EnvironmentSelect from '@/components/operation/EnvironmentSelect.vue'
import OperationPageHeader from '@/components/operation/OperationPageHeader.vue'
import OperationRelationDrawerHost from '@/components/operation/OperationRelationDrawerHost.vue'
import OperationServerMultiPickModal from '@/components/operation/OperationServerMultiPickModal.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import { useOperationRelationDrawer } from '@/composables/useOperationRelationDrawer'
import { useOperationTaskPoll } from '@/composables/useOperationTaskPoll'
import { useDeployBatchTasks, type BatchTarget } from '@/composables/useDeployBatchTasks'
import { confirm } from '@/composables/useConfirm'
import { assertAction, guardAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { PERM } from '@/constants/permissions'
import { resolveOperationErrorMessage } from '@/constants/operationErrors'
import { API_SUCCESS_CODE } from '@/types/api'
import {
  type DeployExecAction,
  type OperationDeployPresetItem,
  type OperationDeployStatus,
  type OperationProject,
  type OperationServer,
  type UploadPostAction,
  type UploadPostMode,
} from '@/types/operation'
import { resolveDeployServiceKey } from '@/utils/operationPort'
import { formatProjectPickHint, projectNameCounts, resolveProjectDisplayName } from '@/utils/operationProject'
import { matchesServerKeyword } from '@/utils/operationServerSearch'
import { GitBranch, Loader2, Play, Plus, RefreshCw, RotateCcw, Search, Square, Terminal, Upload, List, X } from 'lucide-vue-next'

const LINKED_SERVER_PAGE_SIZE = 20
const LINKED_SERVER_PAGE_SIZES = [20, 50, 100] as const
const PROJECT_LIST_PAGE_SIZE = 500
const SERVER_LIST_PAGE_SIZE = 500

const { t } = useI18n()
const router = useRouter()

function opError(code?: number | null, msg?: string | null, fallback?: string) {
  return resolveOperationErrorMessage(t, code, msg, fallback)
}
const { drawerOpen, task, logText, polling, cancelling, openTask, cancelTask, closeDrawer, sendToBackground } = useOperationTaskPoll()
const {
  panelOpen: batchOpen,
  batchTitle,
  items: batchItems,
  runBatch,
  retryItem,
  closePanel: closeBatchPanel,
} = useDeployBatchTasks()
const {
  relationOpen,
  relationType,
  relationId,
  relationName,
  relationTab,
  openRelation,
  closeRelation,
} = useOperationRelationDrawer()

// ── ① 项目 ────────────────────────────────────────────────

const projects = ref<OperationProject[]>([])
const projectsLoading = ref(false)
const selectedProjectId = ref<string>('')

const selectedProject = computed(
  () => projects.value.find((p) => String(p.id) === selectedProjectId.value) ?? null,
)

/** user-center / gateway / knowledge 映射；无映射时隐藏「服务控制」 */
const serviceKey = computed(() => resolveDeployServiceKey(selectedProject.value?.projectName))

const projectNameDupCounts = computed(() => projectNameCounts(projects.value))

const projectOptions = computed(() =>
  projects.value
    .filter((p) => p.id != null)
    .map((p) => ({
      value: String(p.id),
      label: resolveProjectDisplayName(p),
      hint: formatProjectPickHint(p, t, projectNameDupCounts.value),
    })),
)

async function loadProjects() {
  projectsLoading.value = true
  try {
    const result = await listProjectApi({ pageNum: 1, pageSize: PROJECT_LIST_PAGE_SIZE })
    if (result.code !== API_SUCCESS_CODE || !result.data?.list) {
      throw new Error(result.msg || t('operation.deployCenter.projectsFailed'))
    }
    projects.value = result.data.list
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.deployCenter.projectsFailed'))
  } finally {
    projectsLoading.value = false
  }
}

// ── ② 关联服务器多选 ──────────────────────────────────────

const linkedServers = ref<OperationServer[]>([])
const extraServers = ref<OperationServer[]>([])
const appendPickOpen = ref(false)
const linksLoading = ref(false)
const checkedIds = ref<string[]>([])
const statusByServer = ref<Record<string, OperationDeployStatus | null>>({})
const statusLoading = ref(false)
const serverKeyword = ref('')
const serverEnvironment = ref<number | ''>('')
const serverPageNum = ref(1)
const serverPageSize = ref(LINKED_SERVER_PAGE_SIZE)

const linkedIdSet = computed(() => new Set(linkedServers.value.map((srv) => String(srv.id))))

const appendedOnlyServers = computed(() =>
  extraServers.value.filter((srv) => srv.id != null && !linkedIdSet.value.has(String(srv.id))),
)

const allServers = computed(() => {
  const out = [...linkedServers.value]
  for (const srv of appendedOnlyServers.value) {
    if (srv.id != null) out.push(srv)
  }
  return out
})

const filteredLinkedServers = computed(() =>
  linkedServers.value.filter((srv) => {
    if (serverEnvironment.value !== '' && srv.environment !== serverEnvironment.value) return false
    return matchesServerKeyword(srv, serverKeyword.value)
  }),
)

const pagedLinkedServers = computed(() => {
  const start = (serverPageNum.value - 1) * serverPageSize.value
  return filteredLinkedServers.value.slice(start, start + serverPageSize.value)
})

const showServerPagination = computed(
  () => filteredLinkedServers.value.length > LINKED_SERVER_PAGE_SIZE,
)

const primaryServerId = computed(() => {
  const first = linkedServers.value[0]
  return first?.id != null ? String(first.id) : ''
})

const checkedServers = computed(() =>
  allServers.value.filter((srv) => checkedIds.value.includes(String(srv.id))),
)

function serverDisplayName(srv: OperationServer) {
  return srv.serverName || srv.innerIp || srv.ip || `#${srv.id}`
}

function serverCardClass(srv: OperationServer) {
  const classes = ['operation-deploy-server-card']
  if (checkedIds.value.includes(String(srv.id))) classes.push('operation-deploy-server-card--checked')
  if (!sshReady(srv)) classes.push('operation-deploy-server-card--disabled')
  return classes
}

function sshReady(srv: OperationServer) {
  return srv.sshConfigured !== false
}

function toggleServer(srv: OperationServer) {
  if (!sshReady(srv)) return
  const id = String(srv.id)
  checkedIds.value = checkedIds.value.includes(id)
    ? checkedIds.value.filter((x) => x !== id)
    : [...checkedIds.value, id]
}

function openAppendPick() {
  if (!selectedProjectId.value) {
    showToast('error', t('operation.deployCenter.selectProject'))
    return
  }
  appendPickOpen.value = true
}

function onAppendConfirm(servers: OperationServer[]) {
  const existing = new Set(allServers.value.map((s) => String(s.id)))
  const added: OperationServer[] = []
  for (const srv of servers) {
    if (srv.id == null || existing.has(String(srv.id))) continue
    existing.add(String(srv.id))
    added.push(srv)
    if (sshReady(srv)) {
      const id = String(srv.id)
      if (!checkedIds.value.includes(id)) checkedIds.value = [...checkedIds.value, id]
    }
  }
  if (added.length) {
    extraServers.value = [...extraServers.value, ...added]
    if (serviceKey.value) void refreshStatus()
  }
  appendPickOpen.value = false
}

function removeAppendedServer(srv: OperationServer) {
  const id = String(srv.id)
  extraServers.value = extraServers.value.filter((s) => String(s.id) !== id)
  checkedIds.value = checkedIds.value.filter((x) => x !== id)
}

const excludeAppendIds = computed(() => allServers.value.map((s) => String(s.id)))

function checkAll() {
  checkedIds.value = allServers.value.filter(sshReady).map((srv) => String(srv.id))
}

function checkNone() {
  checkedIds.value = []
}

function checkAllVisible() {
  const ids = pagedLinkedServers.value.filter(sshReady).map((srv) => String(srv.id))
  checkedIds.value = [...new Set([...checkedIds.value, ...ids])]
}

async function loadProjectServers(projectId: string) {
  const collected: OperationServer[] = []
  let pageNum = 1
  let total = 0
  do {
    const result = await listServerApi({ projectId, pageNum, pageSize: SERVER_LIST_PAGE_SIZE })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('operation.deployCenter.linksFailed'))
    }
    collected.push(...(result.data.list ?? []))
    total = result.data.total ?? collected.length
    pageNum += 1
  } while (collected.length < total && pageNum <= 20)
  return collected
}

async function loadLinkedServers(projectId: string) {
  linksLoading.value = true
  linkedServers.value = []
  extraServers.value = []
  checkedIds.value = []
  statusByServer.value = {}
  serverKeyword.value = ''
  serverEnvironment.value = ''
  serverPageNum.value = 1
  try {
    const [links, servers] = await Promise.all([
      getProjectLinksApi(projectId),
      loadProjectServers(projectId),
    ])
    if (links.code !== API_SUCCESS_CODE || !links.data) {
      throw new Error(links.msg || t('operation.deployCenter.linksFailed'))
    }
    const ids = links.data.serverIds ?? []
    const byId = new Map(servers.map((srv) => [String(srv.id), srv]))
    linkedServers.value = ids.length
      ? ids.map((sid) => byId.get(String(sid)) ?? ({ id: sid } as OperationServer))
      : servers
    checkedIds.value = allServers.value.filter(sshReady).map((srv) => String(srv.id))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.deployCenter.linksFailed'))
  } finally {
    linksLoading.value = false
  }
}

async function refreshStatus() {
  const key = serviceKey.value
  if (!key || !allServers.value.length) return
  statusLoading.value = true
  try {
    await Promise.all(
      allServers.value.map(async (srv) => {
        if (srv.id == null) return
        try {
          const result = await getDeployStatusApi(key, srv.id)
          statusByServer.value[String(srv.id)] =
            result.code === API_SUCCESS_CODE && result.data ? result.data : null
        } catch {
          statusByServer.value[String(srv.id)] = null
        }
      }),
    )
  } finally {
    statusLoading.value = false
  }
}

function serverRunLabel(srv: OperationServer) {
  const st = statusByServer.value[String(srv.id)]
  if (st?.running === true) return t('operation.deploy.running')
  if (st?.running === false) return t('operation.deploy.stopped')
  return t('operation.deploy.unknown')
}

function serverRunClass(srv: OperationServer) {
  const st = statusByServer.value[String(srv.id)]
  if (st?.running === true) return 'text-emerald-600 dark:text-emerald-400'
  if (st?.running === false) return 'text-red-600 dark:text-red-400'
  return 'text-gray-400'
}

function openServerRelations(srv: OperationServer) {
  openRelation('server', srv.id, { name: srv.serverName, tab: 'projects' })
}

function openProjectRelations() {
  const p = selectedProject.value
  if (p?.id != null) openRelation('project', p.id, { name: p.projectName, tab: 'servers' })
}

function goProjectManage() {
  router.push('/operation/project')
}

watch(selectedProjectId, (id) => {
  if (!id) {
    linkedServers.value = []
    extraServers.value = []
    checkedIds.value = []
    statusByServer.value = {}
    serverKeyword.value = ''
    serverEnvironment.value = ''
    serverPageNum.value = 1
    return
  }
  void loadLinkedServers(id).then(() => {
    void refreshStatus()
    void loadPresets()
  })
})

watch([serverKeyword, serverEnvironment], () => {
  serverPageNum.value = 1
})

void loadProjects()

// ── 预设(白名单路径/快捷动作) ────────────────────────────

const pathPresets = ref<string[]>([])
const actionPresets = ref<OperationDeployPresetItem[]>([])
const presetsLoading = ref(false)

async function loadPresets() {
  presetsLoading.value = true
  try {
    const result = await getDeployPresetsApi(primaryServerId.value || undefined)
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('operation.deployCenter.presetsFailed'))
    }
    pathPresets.value = result.data.pathPresets ?? []
    actionPresets.value = result.data.actionPresets ?? []
    if (!uploadTarget.value && pathPresets.value.length) {
      uploadTarget.value = pathPresets.value[0]
    }
    if (presetPostAction.value === 'none' && presetPostOptions.value.length) {
      presetPostAction.value = presetPostOptions.value[0].value
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.deployCenter.presetsFailed'))
  } finally {
    presetsLoading.value = false
  }
}

// ── 批量目标与确认 ────────────────────────────────────────

const canDeployExec = computed(() => assertAction(PERM.OP_DEPLOY_EXEC))
const canFileUpload = computed(() => assertAction(PERM.OP_FILE_UPLOAD))
const canCommandExec = computed(() => assertAction(PERM.OP_COMMAND_EXEC))

function resolveTargets(): BatchTarget[] | null {
  if (!selectedProjectId.value) {
    showToast('error', t('operation.deployCenter.selectProject'))
    return null
  }
  if (!checkedServers.value.length) {
    showToast('error', t('operation.deployCenter.noServerChecked'))
    return null
  }
  return checkedServers.value.map((srv) => ({
    serverId: String(srv.id),
    serverName: serverDisplayName(srv),
  }))
}

function targetNames(targets: BatchTarget[]) {
  return targets.map((tg) => tg.serverName).join('、')
}

function onBatchClose() {
  closeBatchPanel()
  void refreshStatus()
}

// ── ③ 服务控制(start/stop/restart) ──────────────────────

const actionLoading = ref<string | null>(null)

function serviceLabel() {
  const key = serviceKey.value
  if (!key) return selectedProject.value?.projectName ?? ''
  const i18nKey = `operation.deployCenter.service.${key}`
  const label = t(i18nKey)
  return label === i18nKey ? key : label
}

async function runDeployAction(action: DeployExecAction) {
  if (!guardAction(PERM.OP_DEPLOY_EXEC)) return
  const key = serviceKey.value
  if (!key) return
  const targets = resolveTargets()
  if (!targets) return
  const actionLabel = t(`operation.deploy.action.${action}`)
  if (
    !(await confirm({
      message: t('operation.deployCenter.execBatchConfirm', {
        name: serviceLabel(),
        action: actionLabel,
        count: targets.length,
        servers: targetNames(targets),
      }),
      danger: false,
    }))
  ) {
    return
  }
  const projectId = selectedProjectId.value
  if (targets.length === 1) {
    actionLoading.value = action
    try {
      const result = await createDeployTaskApi(key, action, targets[0].serverId, projectId)
      if (result.code !== API_SUCCESS_CODE || result.data == null) {
        throw new Error(opError(result.code, result.msg, t('operation.deploy.execFailed')))
      }
      openTask(result.data)
      showToast('success', t('operation.task.started'))
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : t('operation.deploy.execFailed'))
    } finally {
      actionLoading.value = null
    }
    return
  }
  actionLoading.value = action
  try {
    const steps = targets.map((target) => ({
      serviceKey: key,
      action,
      serverId: target.serverId,
      projectId: projectId ?? undefined,
    }))
    const result = await createDeployBatchTaskApi({
      steps,
      projectId: projectId ?? undefined,
      stopOnFailure: true,
      intervalSeconds: 0,
    })
    if (result.code !== API_SUCCESS_CODE || result.data == null) {
      throw new Error(opError(result.code, result.msg, t('operation.deploy.execFailed')))
    }
    openTask(result.data)
    showToast('success', t('operation.task.started'))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.deploy.execFailed'))
  } finally {
    actionLoading.value = null
  }
}

// ── ③ 文件发布 ────────────────────────────────────────────

const uploadFile = ref<File | null>(null)
const uploadTarget = ref('')
const pathPresetPick = ref('')
const postMode = ref<UploadPostMode>('none')
const presetPostAction = ref<UploadPostAction>('none')
const customPostCommand = ref('')
const uploading = ref(false)
const uploadDragOver = ref(false)

const pathPresetOptions = computed(() =>
  pathPresets.value.map((p) => ({ value: p, label: p })),
)

const presetPostOptions = computed(() =>
  actionPresets.value
    .filter((a) => a.value !== 'custom')
    .map((a) => ({ value: a.value as UploadPostAction, label: a.label })),
)

const postModeOptions = computed(() => [
  { value: 'none' as UploadPostMode, label: t('operation.deployCenter.postModeNone') },
  { value: 'preset' as UploadPostMode, label: t('operation.deployCenter.postModePreset') },
  { value: 'custom' as UploadPostMode, label: t('operation.deployCenter.postModeCustom') },
])

watch(pathPresetPick, (p) => {
  if (p) uploadTarget.value = p
})

function onUploadFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  uploadFile.value = input.files?.[0] ?? null
  input.value = ''
}

function onUploadDrop(event: DragEvent) {
  uploadDragOver.value = false
  if (!canFileUpload.value) return
  const f = event.dataTransfer?.files?.[0]
  if (f) uploadFile.value = f
}

function clearUploadFile() {
  uploadFile.value = null
}

function resolveUploadPost(): { postAction: UploadPostAction; postCommand?: string } {
  if (postMode.value === 'none') return { postAction: 'none' }
  if (postMode.value === 'preset') return { postAction: presetPostAction.value }
  return { postAction: 'custom', postCommand: customPostCommand.value.trim() }
}

function buildUploadForm(serverId: string, postAction: UploadPostAction, postCommand?: string) {
  const fd = new FormData()
  fd.append('file', uploadFile.value as File)
  fd.append('serverId', serverId)
  fd.append('targetPath', uploadTarget.value.trim())
  fd.append('postAction', postAction)
  if (postCommand) fd.append('postCommand', postCommand)
  return fd
}

async function submitUpload() {
  if (!guardAction(PERM.OP_FILE_UPLOAD)) return
  const targets = resolveTargets()
  if (!targets) return
  if (!uploadFile.value) {
    showToast('error', t('operation.deployCenter.fileRequired'))
    return
  }
  if (!uploadTarget.value.trim()) {
    showToast('error', t('operation.deployCenter.pathRequired'))
    return
  }
  const { postAction, postCommand } = resolveUploadPost()
  if (postAction === 'custom') {
    if (!guardAction(PERM.OP_COMMAND_EXEC)) return
    if (!postCommand) {
      showToast('error', t('operation.deployCenter.commandRequired'))
      return
    }
    if (
      !(await confirm({
        message: t('operation.deployCenter.uploadCommandBatchConfirm', {
          count: targets.length,
          servers: targetNames(targets),
          command: postCommand,
        }),
        danger: false,
      }))
    ) {
      return
    }
  } else if (targets.length > 1) {
    if (
      !(await confirm({
        message: t('operation.deployCenter.uploadBatchConfirm', {
          count: targets.length,
          servers: targetNames(targets),
          path: uploadTarget.value.trim(),
        }),
        danger: false,
      }))
    ) {
      return
    }
  }
  if (targets.length === 1) {
    uploading.value = true
    try {
      const result = await uploadFileApi(buildUploadForm(targets[0].serverId, postAction, postCommand))
      if (result.code !== API_SUCCESS_CODE || result.data == null) {
        throw new Error(opError(result.code, result.msg, t('operation.deployCenter.uploadFailed')))
      }
      openTask(result.data)
      uploadFile.value = null
      showToast('success', t('operation.task.started'))
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : t('operation.deployCenter.uploadFailed'))
    } finally {
      uploading.value = false
    }
    return
  }
  runBatch(
    `${t('operation.task.type.upload')} · ${uploadFile.value.name}`,
    targets,
    (serverId) => uploadFileApi(buildUploadForm(serverId, postAction, postCommand)),
  )
}

// ── ③ 远程命令 ────────────────────────────────────────────

const remoteWorkDir = ref('')
const remoteCommand = ref('')
const commandLoading = ref(false)

async function submitRemoteCommand() {
  if (!guardAction(PERM.OP_COMMAND_EXEC)) return
  const targets = resolveTargets()
  if (!targets) return
  const cmd = remoteCommand.value.trim()
  if (!cmd) {
    showToast('error', t('operation.deployCenter.commandRequired'))
    return
  }
  if (
    !(await confirm({
      message: t('operation.deployCenter.commandBatchConfirm', {
        count: targets.length,
        servers: targetNames(targets),
        command: cmd,
      }),
      danger: false,
    }))
  ) {
    return
  }
  const workDir = remoteWorkDir.value.trim() || undefined
  if (targets.length === 1) {
    commandLoading.value = true
    try {
      const result = await createCommandTaskApi({ serverId: targets[0].serverId, command: cmd, workDir })
      if (result.code !== API_SUCCESS_CODE || result.data == null) {
        throw new Error(opError(result.code, result.msg, t('operation.deployCenter.commandFailed')))
      }
      openTask(result.data)
      showToast('success', t('operation.task.started'))
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : t('operation.deployCenter.commandFailed'))
    } finally {
      commandLoading.value = false
    }
    return
  }
  runBatch(t('operation.task.type.command'), targets, (serverId) =>
    createCommandTaskApi({ serverId, command: cmd, workDir }),
  )
}

// ── 任务历史 ──────────────────────────────────────────────

function openTaskHistory() {
  const query: Record<string, string> = {}
  if (selectedProjectId.value) query.projectId = selectedProjectId.value
  router.push({ path: '/operation/task', query })
}
</script>

<template>
  <div class="page-shell">
    <OperationPageHeader :title="t('operation.deployCenter.title')" :subtitle="t('operation.deployCenter.subtitle')">
      <template #actions>
        <div class="toolbar-actions">
          <button type="button" class="operation-toolbar-action" @click="openTaskHistory">
            <List class="h-4 w-4" />
            {{ t('operation.taskHistory.openFromDeploy') }}
          </button>
          <button
            v-if="serviceKey"
            type="button"
            class="operation-toolbar-refresh"
            :disabled="statusLoading"
            @click="refreshStatus"
          >
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': statusLoading }" />
            {{ t('operation.deploy.refresh') }}
          </button>
        </div>
      </template>
    </OperationPageHeader>

    <div class="mt-6 space-y-6">
      <!-- ① 项目 + ② 关联服务器 -->
      <section class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/40">
        <div class="flex flex-wrap items-end gap-4">
          <label class="block min-w-64 text-sm">
            <span class="mb-1 block text-gray-600">{{ t('operation.deployCenter.projectLabel') }}</span>
            <AppSelect
              v-model="selectedProjectId"
              :options="projectOptions"
              searchable
              :panel-min-width="360"
              :search-placeholder="t('operation.deployCenter.projectSearchPlaceholder')"
              :placeholder="projectsLoading ? t('operation.common.loading') : t('operation.deployCenter.projectPlaceholder')"
            />
          </label>
          <div v-if="selectedProject" class="flex items-center gap-2 pb-1.5 text-sm text-gray-500">
            <EnvironmentBadge :environment="selectedProject.environment" size="sm" />
            <button type="button" class="operation-toolbar-action" @click="openProjectRelations">
              <GitBranch class="h-3.5 w-3.5" />
              {{ t('operation.relations.drawerTitle') }}
            </button>
          </div>
        </div>

        <div class="mt-4">
          <div class="mb-2 flex flex-wrap items-center gap-3">
            <h2 class="text-sm font-semibold">{{ t('operation.deployCenter.linkedServers') }}</h2>
            <template v-if="allServers.length">
              <button type="button" class="operation-toolbar-action" @click="checkAll">
                {{ t('operation.deployCenter.selectAll') }}
              </button>
              <button
                v-if="showServerPagination"
                type="button"
                class="operation-toolbar-action"
                @click="checkAllVisible"
              >
                {{ t('operation.deployCenter.selectPage') }}
              </button>
              <button type="button" class="operation-toolbar-action" @click="checkNone">
                {{ t('operation.deployCenter.clearAll') }}
              </button>
              <span class="text-xs text-gray-400">
                {{ t('operation.deployCenter.checkedCount', { count: checkedIds.length }) }}
              </span>
              <span v-if="linkedServers.length" class="text-xs text-gray-400">
                {{ t('common.paginationTotal', { total: linkedServers.length }) }}
              </span>
            </template>
            <button
              v-if="selectedProjectId"
              type="button"
              class="operation-toolbar-action"
              @click="openAppendPick"
            >
              <Plus class="h-3.5 w-3.5" />
              {{ t('operation.deployCenter.appendServers') }}
            </button>
          </div>

          <div
            v-if="selectedProjectId && linkedServers.length"
            class="mb-3 flex flex-wrap items-center gap-3"
          >
            <div class="operation-server-pick-modal__search min-w-56 flex-1">
              <Search class="operation-server-pick-modal__search-icon" />
              <input
                v-model="serverKeyword"
                type="search"
                class="field-input operation-server-pick-modal__search-input"
                :placeholder="t('operation.deployCenter.serverSearchPlaceholder')"
              />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500">{{ t('operation.common.environment') }}</span>
              <EnvironmentSelect v-model="serverEnvironment" include-all :block="false" />
            </div>
          </div>

          <p v-if="!selectedProjectId" class="text-sm text-gray-400">
            {{ t('operation.deployCenter.selectProject') }}
          </p>
          <p v-else-if="linksLoading" class="text-sm text-gray-400">{{ t('operation.common.loading') }}</p>
          <div v-else-if="!linkedServers.length" class="text-sm text-gray-400">
            {{ t('operation.deployCenter.noLinkedServers') }}
            <button type="button" class="operation-toolbar-action ml-2" @click="goProjectManage">
              {{ t('operation.deployCenter.goLinkServers') }}
            </button>
            <span class="mx-1">·</span>
            <button type="button" class="operation-toolbar-action" @click="openAppendPick">
              {{ t('operation.deployCenter.appendServers') }}
            </button>
          </div>
          <div v-else-if="!filteredLinkedServers.length" class="text-sm text-gray-400">
            {{ t('operation.deployCenter.noServerMatch') }}
          </div>
          <div v-else class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <label
              v-for="srv in pagedLinkedServers"
              :key="String(srv.id)"
              :class="serverCardClass(srv)"
            >
              <input
                type="checkbox"
                class="h-4 w-4 accent-brand-600"
                :checked="checkedIds.includes(String(srv.id))"
                :disabled="!sshReady(srv)"
                @change="toggleServer(srv)"
              />
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-1.5">
                  <span class="truncate text-sm font-medium">{{ serverDisplayName(srv) }}</span>
                  <span
                    v-if="String(srv.id) === primaryServerId"
                    class="rounded bg-brand-100 px-1 text-[10px] font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                  >
                    {{ t('operation.deployCenter.primaryTag') }}
                  </span>
                  <EnvironmentBadge :environment="srv.environment" size="sm" />
                </span>
                <span class="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                  <span class="truncate">{{ srv.innerIp || srv.ip || '-' }}</span>
                  <span v-if="!sshReady(srv)" class="text-amber-600">{{ t('operation.deployCenter.sshMissing') }}</span>
                  <span v-else-if="serviceKey" :class="serverRunClass(srv)">● {{ serverRunLabel(srv) }}</span>
                </span>
              </span>
              <button
                type="button"
                class="operation-icon-action-btn"
                :title="t('operation.relations.drawerTitle')"
                @click.prevent.stop="openServerRelations(srv)"
              >
                <GitBranch class="h-3.5 w-3.5" />
              </button>
            </label>
          </div>
          <AppPagination
            v-if="showServerPagination"
            v-model:page-num="serverPageNum"
            v-model:page-size="serverPageSize"
            class="mt-3"
            :total="filteredLinkedServers.length"
            :page-size-options="LINKED_SERVER_PAGE_SIZES"
          />

          <div v-if="appendedOnlyServers.length" class="mt-6 border-t border-gray-100 pt-4 dark:border-white/10">
            <h3 class="mb-2 text-sm font-semibold">{{ t('operation.deployCenter.appendedServers') }}</h3>
            <p class="mb-3 text-xs text-gray-400">{{ t('operation.deployCenter.appendedServersHint') }}</p>
            <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              <label
                v-for="srv in appendedOnlyServers"
                :key="`extra-${srv.id}`"
                :class="serverCardClass(srv)"
              >
                <input
                  type="checkbox"
                  class="h-4 w-4 accent-brand-600"
                  :checked="checkedIds.includes(String(srv.id))"
                  :disabled="!sshReady(srv)"
                  @change="toggleServer(srv)"
                />
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-1.5">
                    <span class="truncate text-sm font-medium">{{ serverDisplayName(srv) }}</span>
                    <span class="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                      {{ t('operation.deployCenter.appendedTag') }}
                    </span>
                    <EnvironmentBadge :environment="srv.environment" size="sm" />
                  </span>
                  <span class="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                    <span class="truncate">{{ srv.innerIp || srv.ip || '-' }}</span>
                    <span v-if="!sshReady(srv)" class="text-amber-600">{{ t('operation.deployCenter.sshMissing') }}</span>
                    <span v-else-if="serviceKey" :class="serverRunClass(srv)">● {{ serverRunLabel(srv) }}</span>
                  </span>
                </span>
                <button
                  type="button"
                  class="operation-icon-action-btn"
                  :title="t('operation.deployCenter.removeAppended')"
                  @click.prevent.stop="removeAppendedServer(srv)"
                >
                  <X class="h-3.5 w-3.5" />
                </button>
              </label>
            </div>
          </div>
        </div>
      </section>

      <!-- ③ 服务控制:仅 serviceKey 项目 -->
      <section
        v-if="selectedProjectId && serviceKey"
        class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/40"
      >
        <h2 class="mb-1 text-sm font-semibold">
          {{ t('operation.deployCenter.serviceControl') }} · {{ serviceLabel() }}
        </h2>
        <p class="mb-4 text-xs text-gray-400">
          {{ t('operation.deployCenter.serviceControlHint', { count: checkedIds.length }) }}
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn-secondary"
            :disabled="!canDeployExec || !checkedIds.length || actionLoading === 'start'"
            @click="runDeployAction('start')"
          >
            <Play class="h-4 w-4" /> {{ t('operation.deploy.action.start') }}
          </button>
          <button
            type="button"
            class="btn-secondary"
            :disabled="!canDeployExec || !checkedIds.length || actionLoading === 'stop'"
            @click="runDeployAction('stop')"
          >
            <Square class="h-4 w-4" /> {{ t('operation.deploy.action.stop') }}
          </button>
          <button
            type="button"
            class="btn-secondary"
            :disabled="!canDeployExec || !checkedIds.length || actionLoading === 'restart'"
            @click="runDeployAction('restart')"
          >
            <RotateCcw class="h-4 w-4" /> {{ t('operation.deploy.action.restart') }}
          </button>
        </div>
        <p v-if="!canDeployExec" class="mt-3 text-xs text-amber-600">{{ t('operation.deploy.noExecPermission') }}</p>
      </section>

      <!-- ③ 文件发布 -->
      <section class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/40">
        <h2 class="mb-4 text-sm font-semibold">{{ t('operation.deployCenter.uploadTitle') }}</h2>
        <div
          class="app-upload-dropzone"
          :class="[
            uploadDragOver && 'app-upload-dropzone--active',
            !canFileUpload && 'app-upload-dropzone--disabled',
          ]"
          @dragover.prevent="uploadDragOver = canFileUpload"
          @dragleave.prevent="uploadDragOver = false"
          @drop.prevent="onUploadDrop"
        >
          <Upload class="app-upload-dropzone-icon" />
          <p class="app-upload-dropzone-hint">{{ t('operation.deployCenter.uploadHint') }}</p>
          <label class="btn-upload-pick" :class="!canFileUpload && 'is-disabled'">
            {{ t('operation.deployCenter.pickFile') }}
            <input type="file" class="sr-only" :disabled="!canFileUpload" @change="onUploadFileChange" />
          </label>
        </div>
        <div v-if="uploadFile" class="app-upload-file-chip">
          <span class="app-upload-file-chip__name">{{ uploadFile.name }}</span>
          <span class="app-upload-file-chip__meta">{{ Math.round(uploadFile.size / 1024) }} KB</span>
          <button type="button" class="app-upload-file-chip__clear" :disabled="uploading" @click="clearUploadFile">
            {{ t('operation.common.clear') }}
          </button>
        </div>
        <div class="space-y-4">
          <label class="block text-sm">
            <span class="mb-1 block text-gray-600">{{ t('operation.deployCenter.targetPath') }}</span>
            <input
              v-model="uploadTarget"
              class="field-input w-full font-mono text-xs"
              :placeholder="t('operation.deployCenter.pathPlaceholder')"
            />
            <p class="mt-1 text-xs text-gray-400">{{ t('operation.deployCenter.pathHint') }}</p>
          </label>
          <label v-if="pathPresetOptions.length" class="block text-sm">
            <span class="mb-1 block text-gray-600">{{ t('operation.deployCenter.pathPreset') }}</span>
            <AppSelect v-model="pathPresetPick" :options="pathPresetOptions" :placeholder="t('operation.deployCenter.pathPresetPick')" />
          </label>
          <label class="block text-sm">
            <span class="mb-1 block text-gray-600">{{ t('operation.deployCenter.postAction') }}</span>
            <AppSelect v-model="postMode" :options="postModeOptions" />
          </label>
          <label v-if="postMode === 'preset'" class="block text-sm">
            <span class="mb-1 block text-gray-600">{{ t('operation.deployCenter.postPreset') }}</span>
            <AppSelect v-model="presetPostAction" :options="presetPostOptions" />
          </label>
          <label v-if="postMode === 'custom'" class="block text-sm">
            <span class="mb-1 block text-gray-600">{{ t('operation.deployCenter.postCustom') }}</span>
            <textarea
              v-model="customPostCommand"
              rows="4"
              class="field-input w-full font-mono text-xs"
              :placeholder="t('operation.deployCenter.commandPlaceholder')"
            />
          </label>
        </div>
        <button
          type="button"
          class="btn-primary mt-4"
          :disabled="!canFileUpload || uploading || !uploadFile || presetsLoading || !checkedIds.length"
          @click="submitUpload"
        >
          <Loader2 v-if="uploading" class="h-4 w-4 animate-spin" />
          <Upload v-else class="h-4 w-4" />
          {{ uploading ? t('operation.deployCenter.uploading') : t('operation.deployCenter.uploadSubmit') }}
        </button>
        <p v-if="!canFileUpload" class="mt-2 text-xs text-amber-600">{{ t('operation.deployCenter.noUploadPermission') }}</p>
      </section>

      <!-- ③ 远程命令 -->
      <section class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/40">
        <h2 class="mb-4 text-sm font-semibold">{{ t('operation.deployCenter.remoteCommandTitle') }}</h2>
        <p class="mb-4 text-sm text-gray-500">{{ t('operation.deployCenter.remoteCommandHint') }}</p>
        <div class="space-y-4">
          <label class="block text-sm">
            <span class="mb-1 block text-gray-600">{{ t('operation.deployCenter.workDir') }}</span>
            <input
              v-model="remoteWorkDir"
              class="field-input w-full font-mono text-xs"
              :placeholder="t('operation.deployCenter.workDirPlaceholder')"
            />
          </label>
          <label class="block text-sm">
            <span class="mb-1 block text-gray-600">{{ t('operation.deployCenter.command') }}</span>
            <textarea
              v-model="remoteCommand"
              rows="5"
              class="field-input w-full font-mono text-xs"
              :placeholder="t('operation.deployCenter.commandPlaceholder')"
            />
          </label>
        </div>
        <button
          type="button"
          class="btn-primary mt-4"
          :disabled="!canCommandExec || commandLoading || !checkedIds.length"
          @click="submitRemoteCommand"
        >
          <Loader2 v-if="commandLoading" class="h-4 w-4 animate-spin" />
          <Terminal v-else class="h-4 w-4" />
          {{ commandLoading ? t('operation.deployCenter.commandRunning') : t('operation.deployCenter.commandSubmit') }}
        </button>
        <p v-if="!canCommandExec" class="mt-2 text-xs text-amber-600">{{ t('operation.deployCenter.noCommandPermission') }}</p>
      </section>
    </div>

    <DeployTaskDrawer
      :open="drawerOpen"
      :task="task"
      :log-text="logText"
      :polling="polling"
      :cancelling="cancelling"
      @cancel="cancelTask"
      @close="closeDrawer"
      @background="sendToBackground"
    />

    <DeployBatchTaskPanel
      :open="batchOpen"
      :title="batchTitle"
      :items="batchItems"
      @close="onBatchClose"
      @retry="retryItem"
    />

    <OperationServerMultiPickModal
      :open="appendPickOpen"
      :exclude-ids="excludeAppendIds"
      @close="appendPickOpen = false"
      @confirm="onAppendConfirm"
    />

    <OperationRelationDrawerHost
      :open="relationOpen"
      :entity-type="relationType"
      :entity-id="relationId"
      :entity-name="relationName"
      :initial-tab="relationTab"
      @close="closeRelation"
    />
  </div>
</template>
