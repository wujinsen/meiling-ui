<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getServerApi, saveServerSshApi, testServerSshApi } from '@/api/operation'
import AppModal from '@/components/ui/AppModal.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import FormField from '@/components/ui/FormField.vue'
import { guardAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { PERM } from '@/constants/permissions'
import { API_SUCCESS_CODE } from '@/types/api'
import type { OperationServer, OperationServerSsh, OperationSshTest } from '@/types/operation'
import { Loader2, Plug, KeyRound, X } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  serverId: number | string | null
  serverName?: string
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const server = ref<OperationServer | null>(null)
const privateKey = ref('')
const passphrase = ref('')
const sshPort = ref(22)
const sshUser = ref('ubuntu')
const connPref = ref<'auto' | 'inner' | 'public'>('auto')
const uploadAllowedRoots = ref('')
const testResult = ref<OperationSshTest | null>(null)
const keyFileName = ref('')
const keyDragOver = ref(false)

const sshConfigured = computed(() => server.value?.sshConfigured === true)

const connPrefOptions = computed(() => [
  { value: 'auto' as const, label: t('operation.ssh.connAuto') },
  { value: 'inner' as const, label: t('operation.ssh.connInner') },
  { value: 'public' as const, label: t('operation.ssh.connPublic') },
])

async function loadServer() {
  if (props.serverId == null) return
  loading.value = true
  testResult.value = null
  privateKey.value = ''
  passphrase.value = ''
  keyFileName.value = ''
  try {
    const result = await getServerApi(props.serverId)
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.server.loadFailed'))
    server.value = result.data
    sshPort.value = result.data.sshPort ?? 22
    sshUser.value = result.data.sshUser || 'ubuntu'
    connPref.value = (result.data.connPref as 'auto' | 'inner' | 'public') || 'auto'
    uploadAllowedRoots.value = result.data.uploadAllowedRoots ?? ''
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.server.loadFailed'))
    emit('close')
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.serverId] as const,
  ([open, id]) => {
    if (open && id != null) void loadServer()
  },
  { immediate: true },
)

function close() {
  emit('close')
}

async function save() {
  if (!guardAction(PERM.OP_SSH_MANAGE)) return
  if (props.serverId == null) return
  if (!privateKey.value.trim() && !passphrase.value.trim() && !sshConfigured.value) {
    showToast('error', t('operation.ssh.privateKeyRequired'))
    return
  }
  saving.value = true
  try {
    const body: OperationServerSsh = {
      sshPort: sshPort.value,
      sshUser: sshUser.value.trim() || 'ubuntu',
      sshAuthType: 1,
      connPref: connPref.value,
      uploadAllowedRoots: uploadAllowedRoots.value.trim() || null,
    }
    if (privateKey.value.trim()) body.privateKey = privateKey.value.trim()
    if (passphrase.value.trim()) body.passphrase = passphrase.value.trim()
    const result = await saveServerSshApi(props.serverId, body)
    if (result.code !== API_SUCCESS_CODE) throw new Error(result.msg || t('operation.common.saveFailed'))
    showToast('success', t('operation.ssh.saveOk'))
    privateKey.value = ''
    passphrase.value = ''
    keyFileName.value = ''
    await loadServer()
    emit('saved')
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.common.saveFailed'))
  } finally {
    saving.value = false
  }
}

function readKeyFile(file: File) {
  const reader = new FileReader()
  reader.onload = () => {
    privateKey.value = String(reader.result ?? '')
    keyFileName.value = file.name
  }
  reader.readAsText(file)
}

function onKeyFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  readKeyFile(file)
  input.value = ''
}

function onKeyDrop(event: DragEvent) {
  keyDragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  readKeyFile(file)
}

function clearKeyFile() {
  keyFileName.value = ''
  privateKey.value = ''
}

function onKeyPaste() {
  if (privateKey.value.trim()) keyFileName.value = ''
}

async function testConnection() {
  if (!guardAction(PERM.OP_SSH_MANAGE)) return
  if (props.serverId == null) return
  testing.value = true
  testResult.value = null
  try {
    const result = await testServerSshApi(props.serverId)
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.ssh.testFailed'))
    testResult.value = result.data
    if (result.data.success) {
      showToast('success', t('operation.ssh.testOk', { host: result.data.host ?? '', ms: result.data.elapsedMs ?? 0 }))
    } else {
      showToast('error', result.data.message || t('operation.ssh.testFailed'))
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.ssh.testFailed'))
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <AppModal
    :open="open"
    :title="t('operation.ssh.modalTitle', { name: serverName || server?.serverName || '' })"
    wide
    @close="close"
  >
    <div v-if="loading" class="py-10 text-center text-gray-400">{{ t('operation.common.loading') }}</div>
    <form v-else class="form-modal space-y-4" novalidate @submit.prevent="save">
      <p class="text-sm text-gray-500">{{ t('operation.ssh.hint') }}</p>
      <div class="form-grid-pairs">
        <div class="form-grid-row">
          <FormField :label="t('operation.ssh.user')" horizontal>
            <input v-model="sshUser" class="field-input" placeholder="ubuntu" />
          </FormField>
          <FormField :label="t('operation.ssh.port')" horizontal>
            <input v-model.number="sshPort" type="number" min="1" max="65535" class="field-input" />
          </FormField>
        </div>
        <div class="form-grid-row">
          <FormField :label="t('operation.ssh.connPref')" horizontal class="form-field-span-2">
            <AppSelect v-model="connPref" :options="connPrefOptions" />
          </FormField>
        </div>
        <div class="form-grid-row">
          <FormField :label="t('operation.ssh.privateKey')" horizontal class="form-field-span-2">
            <div class="space-y-2">
              <label
                class="operation-pem-key-pick"
                :class="{
                  'operation-pem-key-pick--filled': keyFileName,
                  'operation-pem-key-pick--active': keyDragOver,
                }"
                @dragover.prevent="keyDragOver = true"
                @dragleave.prevent="keyDragOver = false"
                @drop.prevent="onKeyDrop"
              >
                <input type="file" class="sr-only" accept=".pem,.key,text/plain" @change="onKeyFile" />
                <span class="operation-pem-key-pick-icon">
                  <KeyRound class="h-4 w-4" />
                </span>
                <span class="operation-pem-key-pick-body">
                  <span class="operation-pem-key-pick-title">{{ t('operation.ssh.pickKeyFile') }}</span>
                  <span class="operation-pem-key-pick-name">
                    {{ keyFileName || t('operation.ssh.pickKeyHint') }}
                  </span>
                </span>
                <span class="operation-pem-key-pick-action">{{ t('operation.ssh.browse') }}</span>
                <button
                  v-if="keyFileName"
                  type="button"
                  class="operation-pem-key-pick-clear"
                  :aria-label="t('operation.ssh.clearKeyFile')"
                  @click.stop.prevent="clearKeyFile"
                >
                  <X class="h-3.5 w-3.5" />
                </button>
              </label>
              <p class="text-xs text-gray-400">{{ t('operation.ssh.orPasteKey') }}</p>
              <textarea
                v-model="privateKey"
                rows="4"
                class="field-input font-mono text-xs"
                :placeholder="sshConfigured ? t('operation.ssh.privateKeyKeep') : t('operation.ssh.privateKeyPlaceholder')"
                @input="onKeyPaste"
              />
            </div>
          </FormField>
        </div>
        <div class="form-grid-row">
          <FormField :label="t('operation.ssh.uploadAllowedRoots')" horizontal class="form-field-span-2">
            <textarea
              v-model="uploadAllowedRoots"
              rows="3"
              class="field-input font-mono text-xs"
              :placeholder="t('operation.ssh.uploadAllowedRootsPlaceholder')"
            />
            <p class="mt-1 text-xs text-gray-400">{{ t('operation.ssh.uploadAllowedRootsHint') }}</p>
          </FormField>
        </div>
        <div class="form-grid-row">
          <FormField :label="t('operation.ssh.passphrase')" horizontal class="form-field-span-2">
            <input
              v-model="passphrase"
              type="password"
              autocomplete="new-password"
              class="field-input"
              :placeholder="t('operation.common.passwordKeepHint')"
            />
          </FormField>
        </div>
      </div>
      <div v-if="sshConfigured" class="text-sm text-emerald-600">{{ t('operation.ssh.configured') }}</div>
      <div v-if="testResult" class="rounded border border-gray-100 p-3 text-sm dark:border-white/10">
        <p :class="testResult.success ? 'text-emerald-600' : 'text-red-600'">
          {{ testResult.success ? t('operation.ssh.testOkShort') : (testResult.message || t('operation.ssh.testFailed')) }}
        </p>
        <p v-if="testResult.output" class="mt-1 font-mono text-xs text-gray-500">{{ testResult.output }}</p>
      </div>
    </form>
    <template #footer>
      <button type="button" class="btn-ghost" @click="close">{{ t('operation.common.cancel') }}</button>
      <button type="button" class="btn-ghost" :disabled="testing || !sshConfigured" @click="testConnection">
        <Loader2 v-if="testing" class="h-4 w-4 animate-spin" />
        <Plug v-else class="h-4 w-4" />
        {{ testing ? t('operation.ssh.testing') : t('operation.ssh.test') }}
      </button>
      <button type="button" class="btn-primary" :disabled="saving" @click="save">
        {{ saving ? t('operation.common.saving') : t('operation.common.save') }}
      </button>
    </template>
  </AppModal>
</template>
