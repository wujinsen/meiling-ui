<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  createCommandTaskApi,
  createDeployTaskApi,
  getDeployPresetsApi,
  getDeployStatusApi,
  listServerApi,
  uploadFileApi,
} from '@/api/operation'
import DeployTaskDrawer from '@/components/operation/DeployTaskDrawer.vue'
import OperationPageHeader from '@/components/operation/OperationPageHeader.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import { useOperationTaskPoll } from '@/composables/useOperationTaskPoll'
import { confirm } from '@/composables/useConfirm'
import { assertAction, guardAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { PERM } from '@/constants/permissions'
import { API_SUCCESS_CODE } from '@/types/api'
import {
  MOLI_DEPLOY_SERVICES,
  type DeployExecAction,
  type MoliDeployServiceKey,
  type OperationDeployPresetItem,
  type OperationDeployStatus,
  type OperationServer,
  type UploadPostAction,
  type UploadPostMode,
} from '@/types/operation'
import { Loader2, Play, RefreshCw, RotateCcw, Square, Terminal, Upload } from 'lucide-vue-next'

const { t } = useI18n()
const { drawerOpen, task, logText, polling, openTask, closeDrawer } = useOperationTaskPoll()

const servers = ref<OperationServer[]>([])
const serversLoading = ref(false)
const selectedServerId = ref<string>('')
const statusMap = ref<Record<string, OperationDeployStatus | null>>({})
const statusLoading = ref(false)
const actionLoading = ref<string | null>(null)

const pathPresets = ref<string[]>([])
const actionPresets = ref<OperationDeployPresetItem[]>([])
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

const selectedServer = computed(() =>
  servers.value.find((s) => String(s.id) === selectedServerId.value) ?? null,
)

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

async function loadServers() {
  serversLoading.value = true
  try {
    const result = await listServerApi({ pageNum: 1, pageSize: 200 })
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.server.loadFailed'))
    servers.value = result.data.list ?? []
    if (!selectedServerId.value && servers.value.length) {
      const pro = servers.value.find((s) => s.environment === 4) ?? servers.value[0]
      selectedServerId.value = String(pro?.id ?? '')
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.server.loadFailed'))
  } finally {
    serversLoading.value = false
  }
}

async function loadPresets() {
  presetsLoading.value = true
  try {
    const sid = selectedServerId.value || undefined
    const result = await getDeployPresetsApi(sid)
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.deployCenter.presetsFailed'))
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

async function refreshAllStatus() {
  statusLoading.value = true
  const sid = selectedServerId.value || undefined
  try {
    await Promise.all(
      MOLI_DEPLOY_SERVICES.map(async (key) => {
        const result = await getDeployStatusApi(key, sid)
        if (result.code === API_SUCCESS_CODE && result.data) {
          statusMap.value[key] = result.data
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

watch(pathPresetPick, (p) => {
  if (p) uploadTarget.value = p
})

onMounted(async () => {
  await loadServers()
  if (selectedServerId.value) {
    await loadPresets()
    await refreshAllStatus()
  }
})

function serviceLabel(key: MoliDeployServiceKey) {
  return t(`operation.deployCenter.service.${key}`)
}

function runningLabel(key: MoliDeployServiceKey) {
  const st = statusMap.value[key]
  if (st?.running === true) return t('operation.deploy.running')
  if (st?.running === false) return t('operation.deploy.stopped')
  return t('operation.deploy.unknown')
}

async function runDeployAction(key: MoliDeployServiceKey, action: DeployExecAction) {
  if (!guardAction(PERM.OP_DEPLOY_EXEC)) return
  if (
    !(await confirm({
      message: t('operation.deploy.execConfirm', {
        name: serviceLabel(key),
        action: t(`operation.deploy.action.${action}`),
      }),
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
  const f = event.dataTransfer?.files?.[0]
  if (f) uploadFile.value = f
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
        <button type="button" class="btn-ghost" :disabled="statusLoading" @click="refreshAllStatus">
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': statusLoading }" />
          {{ t('operation.deploy.refresh') }}
        </button>
      </template>
    </OperationPageHeader>

    <div class="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/40">
        <h2 class="mb-3 text-sm font-semibold">{{ t('operation.deployCenter.serverList') }}</h2>
        <div v-if="serversLoading" class="py-6 text-center text-sm text-gray-400">{{ t('operation.common.loading') }}</div>
        <div v-else class="space-y-1">
          <button
            v-for="srv in servers"
            :key="String(srv.id)"
            type="button"
            class="w-full rounded-lg px-3 py-2 text-left text-sm transition"
            :class="
              selectedServerId === String(srv.id)
                ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'hover:bg-gray-50 dark:hover:bg-white/5'
            "
            @click="selectedServerId = String(srv.id)"
          >
            <div>{{ srv.serverName }}</div>
            <div class="text-xs text-gray-400">
              {{ srv.innerIp || srv.ip || '-' }}
              <span v-if="srv.sshConfigured" class="ml-1 text-emerald-600">SSH</span>
            </div>
          </button>
        </div>
        <p v-if="!servers.length && !serversLoading" class="text-sm text-gray-400">{{ t('operation.common.empty') }}</p>
      </aside>

      <div class="space-y-6">
        <section class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/40">
          <h2 class="mb-4 text-sm font-semibold">
            {{ t('operation.deployCenter.services') }}
            <span v-if="selectedServer" class="font-normal text-gray-400">· {{ selectedServer.serverName }}</span>
          </h2>
          <div v-if="!selectedServerId" class="text-sm text-gray-400">{{ t('operation.deployCenter.selectServer') }}</div>
          <div v-else class="grid gap-4 md:grid-cols-3">
            <div
              v-for="key in MOLI_DEPLOY_SERVICES"
              :key="key"
              class="rounded-lg border border-gray-100 p-4 dark:border-white/10"
            >
              <div class="mb-2 font-medium">{{ serviceLabel(key) }}</div>
              <div class="mb-3 text-sm text-gray-500">{{ runningLabel(key) }}</div>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="btn-ghost text-xs"
                  :disabled="!canDeployExec || actionLoading === `${key}:start`"
                  @click="runDeployAction(key, 'start')"
                >
                  <Play class="h-3.5 w-3.5" /> {{ t('operation.deploy.action.start') }}
                </button>
                <button
                  type="button"
                  class="btn-ghost text-xs"
                  :disabled="!canDeployExec || actionLoading === `${key}:stop`"
                  @click="runDeployAction(key, 'stop')"
                >
                  <Square class="h-3.5 w-3.5" /> {{ t('operation.deploy.action.stop') }}
                </button>
                <button
                  type="button"
                  class="btn-ghost text-xs"
                  :disabled="!canDeployExec || actionLoading === `${key}:restart`"
                  @click="runDeployAction(key, 'restart')"
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
            class="mb-4 rounded-lg border-2 border-dashed p-6 text-center transition"
            :class="uploadDragOver ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 dark:border-white/10'"
            @dragover.prevent="uploadDragOver = true"
            @dragleave="uploadDragOver = false"
            @drop.prevent="onUploadDrop"
          >
            <Upload class="mx-auto mb-2 h-8 w-8 text-gray-400" />
            <p class="text-sm text-gray-500">{{ t('operation.deployCenter.uploadHint') }}</p>
            <input type="file" class="mt-3 text-sm" :disabled="!canFileUpload" @change="onUploadFileChange" />
            <p v-if="uploadFile" class="mt-2 text-sm font-medium">{{ uploadFile.name }} ({{ Math.round(uploadFile.size / 1024) }} KB)</p>
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
  </div>
</template>
