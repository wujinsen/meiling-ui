<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  createCommandTaskApi,
  createDeployTaskApi,
  getDeployPresetsApi,
  getDeployStatusApi,
  listProjectApi,
  uploadFileApi,
} from '@/api/operation'
import DeployServerPicker from '@/components/operation/DeployServerPicker.vue'
import DeployTaskDrawer from '@/components/operation/DeployTaskDrawer.vue'
import OperationEntityLink from '@/components/operation/OperationEntityLink.vue'
import OperationPageHeader from '@/components/operation/OperationPageHeader.vue'
import OperationRelationDrawerHost from '@/components/operation/OperationRelationDrawerHost.vue'
import { useOperationRelationDrawer } from '@/composables/useOperationRelationDrawer'
import AppSelect from '@/components/ui/AppSelect.vue'
import { useOperationTaskPoll } from '@/composables/useOperationTaskPoll'
import { confirm } from '@/composables/useConfirm'
import { assertAction, guardAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { PERM } from '@/constants/permissions'
import { API_SUCCESS_CODE } from '@/types/api'
import {
  type DeployExecAction,
  type OperationDeployPresetItem,
  type OperationDeployServiceOption,
  type OperationDeployStatus,
  type OperationServer,
  type UploadPostAction,
  type UploadPostMode,
} from '@/types/operation'
import { normalizeDeployServiceKeys } from '@/utils/operationDeploy'
import { resolveDeployServiceKey } from '@/utils/operationPort'
import { Loader2, Play, RefreshCw, RotateCcw, Square, Terminal, Upload, List } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const { drawerOpen, task, logText, polling, openTask, closeDrawer } = useOperationTaskPoll()
const {
  relationOpen,
  relationType,
  relationId,
  relationName,
  relationTab,
  openRelation,
  closeRelation,
} = useOperationRelationDrawer()

const projectNameIndex = ref<Record<string, { id: string | number; name: string }>>({})

const selectedServerId = ref<string>('')
const selectedServer = ref<OperationServer | null>(null)
const statusMap = ref<Record<string, OperationDeployStatus | null>>({})
const statusLoading = ref(false)
const actionLoading = ref<string | null>(null)

const pathPresets = ref<string[]>([])
const actionPresets = ref<OperationDeployPresetItem[]>([])
const deployServiceKeys = ref<OperationDeployServiceOption[]>(normalizeDeployServiceKeys())
const presetsLoading = ref(false)

const uploadFile = ref<File | null>(null)
const uploadTarget = ref('')
const pathPresetPick = ref('')
const postMode = ref<UploadPostMode>('none')
const presetPostAction = ref<UploadPostAction>('none')
const customPostCommand = ref('')
const uploading = ref(false)
const uploadDragOver = ref(false)

const remoteWorkDir = ref('')
const remoteCommand = ref('')
const commandLoading = ref(false)

const canDeployExec = computed(() => assertAction(PERM.OP_DEPLOY_EXEC))
const canFileUpload = computed(() => assertAction(PERM.OP_FILE_UPLOAD))
const canCommandExec = computed(() => assertAction(PERM.OP_COMMAND_EXEC))

function onServerSelect(server: OperationServer) {
  selectedServer.value = server
}

function openServerRelations(server: OperationServer) {
  openRelation('server', server.id, { name: server.serverName, tab: 'projects' })
}

async function loadProjectIndex() {
  try {
    const result = await listProjectApi({ pageNum: 1, pageSize: 500 })
    if (result.code !== API_SUCCESS_CODE || !result.data?.list) return
    const index: Record<string, { id: string | number; name: string }> = {}
    for (const project of result.data.list) {
      if (project.id == null || !project.projectName) continue
      const key = resolveDeployServiceKey(project.projectName)
      if (key && !index[key]) {
        index[key] = { id: project.id, name: project.projectName }
      }
    }
    projectNameIndex.value = index
  } catch {
    projectNameIndex.value = {}
  }
}

function openServiceRelations(svc: OperationDeployServiceOption | string) {
  const key = typeof svc === 'string' ? svc : svc.key
  const matched = projectNameIndex.value[key]
  if (matched) {
    openRelation('project', matched.id, { name: matched.name, tab: 'servers' })
  }
}

function openTaskHistory() {
  const query: Record<string, string> = {}
  if (selectedServerId.value) query.serverId = selectedServerId.value
  router.push({ path: '/operation/task', query })
}

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

const activeDeployServices = computed(() =>
  deployServiceKeys.value.length ? deployServiceKeys.value : normalizeDeployServiceKeys(),
)

async function loadPresets() {
  presetsLoading.value = true
  try {
    const sid = selectedServerId.value || undefined
    const result = await getDeployPresetsApi(sid)
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.deployCenter.presetsFailed'))
    pathPresets.value = result.data.pathPresets ?? []
    actionPresets.value = result.data.actionPresets ?? []
    deployServiceKeys.value = normalizeDeployServiceKeys(result.data.serviceKeys)
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

async function refreshAllStatus() {
  statusLoading.value = true
  const sid = selectedServerId.value || undefined
  try {
    await Promise.all(
      activeDeployServices.value.map(async (svc) => {
        const result = await getDeployStatusApi(svc.key, sid)
        if (result.code === API_SUCCESS_CODE && result.data) {
          statusMap.value[svc.key] = result.data
        }
      }),
    )
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.deploy.statusFailed'))
  } finally {
    statusLoading.value = false
  }
}

watch(selectedServerId, () => {
  statusMap.value = {}
  if (selectedServerId.value) {
    void refreshAllStatus()
    void loadPresets()
  }
})

void loadProjectIndex()

watch(pathPresetPick, (p) => {
  if (p) uploadTarget.value = p
})

function serviceLabel(svc: OperationDeployServiceOption | string) {
  const key = typeof svc === 'string' ? svc : svc.key
  const apiLabel = typeof svc === 'string' ? undefined : svc.label
  if (apiLabel) return apiLabel
  const i18nKey = `operation.deployCenter.service.${key}`
  const label = t(i18nKey)
  return label === i18nKey ? key : label
}

function runningLabel(key: string) {
  const st = statusMap.value[key]
  if (st?.running === true) return t('operation.deploy.running')
  if (st?.running === false) return t('operation.deploy.stopped')
  return t('operation.deploy.unknown')
}

async function runDeployAction(key: string, action: DeployExecAction) {
  if (!guardAction(PERM.OP_DEPLOY_EXEC)) return
  if (
    !(await confirm({
      message: t('operation.deploy.execConfirm', {
        name: serviceLabel(key),
        action: t(`operation.deploy.action.${action}`),
      }),
      danger: false,
    }))
  ) {
    return
  }
  const loadKey = `${key}:${action}`
  actionLoading.value = loadKey
  try {
    const sid = selectedServerId.value || undefined
    const result = await createDeployTaskApi(key, action, sid)
    if (result.code !== API_SUCCESS_CODE || result.data == null) {
      throw new Error(result.msg || t('operation.deploy.execFailed'))
    }
    openTask(result.data)
    showToast('success', t('operation.task.started'))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.deploy.execFailed'))
  } finally {
    actionLoading.value = null
  }
}

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

async function submitUpload() {
  if (!guardAction(PERM.OP_FILE_UPLOAD)) return
  if (!selectedServerId.value) {
    showToast('error', t('operation.deployCenter.selectServer'))
    return
  }
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
        message: t('operation.deployCenter.uploadCommandConfirm', {
          server: selectedServer.value?.serverName ?? '',
          command: postCommand,
        }),
        danger: false,
      }))
    ) {
      return
    }
  }
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', uploadFile.value)
    fd.append('serverId', selectedServerId.value)
    fd.append('targetPath', uploadTarget.value.trim())
    fd.append('postAction', postAction)
    if (postCommand) fd.append('postCommand', postCommand)
    const result = await uploadFileApi(fd)
    if (result.code !== API_SUCCESS_CODE || result.data == null) {
      throw new Error(result.msg || t('operation.deployCenter.uploadFailed'))
    }
    openTask(result.data)
    uploadFile.value = null
    showToast('success', t('operation.task.started'))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.deployCenter.uploadFailed'))
  } finally {
    uploading.value = false
  }
}

async function submitRemoteCommand() {
  if (!guardAction(PERM.OP_COMMAND_EXEC)) return
  if (!selectedServerId.value) {
    showToast('error', t('operation.deployCenter.selectServer'))
    return
  }
  const cmd = remoteCommand.value.trim()
  if (!cmd) {
    showToast('error', t('operation.deployCenter.commandRequired'))
    return
  }
  if (
    !(await confirm({
      message: t('operation.deployCenter.commandConfirm', {
        server: selectedServer.value?.serverName ?? '',
        command: cmd,
      }),
      danger: false,
    }))
  ) {
    return
  }
  commandLoading.value = true
  try {
    const result = await createCommandTaskApi({
      serverId: selectedServerId.value,
      command: cmd,
      workDir: remoteWorkDir.value.trim() || undefined,
    })
    if (result.code !== API_SUCCESS_CODE || result.data == null) {
      throw new Error(result.msg || t('operation.deployCenter.commandFailed'))
    }
    openTask(result.data)
    showToast('success', t('operation.task.started'))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.deployCenter.commandFailed'))
  } finally {
    commandLoading.value = false
  }
}
</script>

<template>
  <div class="page-shell">
    <OperationPageHeader :title="t('operation.deployCenter.title')" :subtitle="t('operation.deployCenter.subtitle')">
      <template #actions>
        <button type="button" class="btn-ghost" @click="openTaskHistory">
          <List class="h-4 w-4" />
          {{ t('operation.taskHistory.openFromDeploy') }}
        </button>
        <button type="button" class="btn-ghost" :disabled="statusLoading" @click="refreshAllStatus">
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': statusLoading }" />
          {{ t('operation.deploy.refresh') }}
        </button>
      </template>
    </OperationPageHeader>

    <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(17rem,280px)_1fr]">
      <DeployServerPicker v-model="selectedServerId" @select="onServerSelect" @open-relations="openServerRelations" />

      <div class="space-y-6">
        <section class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/40">
          <h2 class="mb-4 text-sm font-semibold">
            {{ t('operation.deployCenter.services') }}
            <span v-if="selectedServer" class="font-normal text-gray-400">
              ·
              <OperationEntityLink
                :label="selectedServer.serverName || String(selectedServer.id)"
                @open="openServerRelations(selectedServer)"
              />
            </span>
          </h2>
          <div v-if="!selectedServerId" class="text-sm text-gray-400">{{ t('operation.deployCenter.selectServer') }}</div>
          <div v-else class="grid gap-4 md:grid-cols-3">
            <div
              v-for="svc in activeDeployServices"
              :key="svc.key"
              class="rounded-lg border border-gray-100 p-4 dark:border-white/10"
            >
              <div class="mb-2 font-medium">
                <OperationEntityLink
                  v-if="projectNameIndex[svc.key]"
                  :label="serviceLabel(svc)"
                  @open="openServiceRelations(svc)"
                />
                <span v-else>{{ serviceLabel(svc) }}</span>
              </div>
              <div class="mb-3 text-sm text-gray-500">{{ runningLabel(svc.key) }}</div>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="btn-secondary text-xs"
                  :disabled="!canDeployExec || actionLoading === `${svc.key}:start`"
                  @click="runDeployAction(svc.key, 'start')"
                >
                  <Play class="h-3.5 w-3.5" /> {{ t('operation.deploy.action.start') }}
                </button>
                <button
                  type="button"
                  class="btn-secondary text-xs"
                  :disabled="!canDeployExec || actionLoading === `${svc.key}:stop`"
                  @click="runDeployAction(svc.key, 'stop')"
                >
                  <Square class="h-3.5 w-3.5" /> {{ t('operation.deploy.action.stop') }}
                </button>
                <button
                  type="button"
                  class="btn-secondary text-xs"
                  :disabled="!canDeployExec || actionLoading === `${svc.key}:restart`"
                  @click="runDeployAction(svc.key, 'restart')"
                >
                  <RotateCcw class="h-3.5 w-3.5" /> {{ t('operation.deploy.action.restart') }}
                </button>
              </div>
            </div>
          </div>
          <p v-if="!canDeployExec" class="mt-3 text-xs text-amber-600">{{ t('operation.deploy.noExecPermission') }}</p>
        </section>

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
            :disabled="!canFileUpload || uploading || !uploadFile || presetsLoading"
            @click="submitUpload"
          >
            <Loader2 v-if="uploading" class="h-4 w-4 animate-spin" />
            <Upload v-else class="h-4 w-4" />
            {{ uploading ? t('operation.deployCenter.uploading') : t('operation.deployCenter.uploadSubmit') }}
          </button>
          <p v-if="!canFileUpload" class="mt-2 text-xs text-amber-600">{{ t('operation.deployCenter.noUploadPermission') }}</p>
        </section>

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
            :disabled="!canCommandExec || commandLoading || !selectedServerId"
            @click="submitRemoteCommand"
          >
            <Loader2 v-if="commandLoading" class="h-4 w-4 animate-spin" />
            <Terminal v-else class="h-4 w-4" />
            {{ commandLoading ? t('operation.deployCenter.commandRunning') : t('operation.deployCenter.commandSubmit') }}
          </button>
          <p v-if="!canCommandExec" class="mt-2 text-xs text-amber-600">{{ t('operation.deployCenter.noCommandPermission') }}</p>
        </section>
      </div>
    </div>

    <DeployTaskDrawer
      :open="drawerOpen"
      :task="task"
      :log-text="logText"
      :polling="polling"
      @close="closeDrawer"
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
