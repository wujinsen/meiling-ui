<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getKbPlatformLlmConfigApi,
  saveKbPlatformLlmConfigApi,
  testKbPlatformLlmConfigApi,
} from '@/api/knowledge'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import FormField from '@/components/ui/FormField.vue'
import { confirm } from '@/composables/useConfirm'
import { guardAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { PERM } from '@/constants/permissions'
import { API_SUCCESS_CODE } from '@/types/api'
import type {
  KbPlatformLlmConfig,
  KbPlatformLlmConfigSaveRequest,
  KbPlatformLlmConfigTestResult,
} from '@/types/knowledge'
import { AlertTriangle, Cpu, KeyRound, Loader2, PlugZap, RefreshCw, Save, Trash2, X } from 'lucide-vue-next'

const { t } = useI18n()

type LlmProvider = 'deepseek' | 'qwen' | 'glm' | 'custom'

const PROVIDER_PRESETS: Record<Exclude<LlmProvider, 'custom'>, { baseUrl: string; model: string }> = {
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  glm: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
}

const PROVIDER_OPTIONS: LlmProvider[] = ['deepseek', 'qwen', 'glm', 'custom']

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const loadError = ref('')
const pageAlert = ref('')
const configLoaded = ref<KbPlatformLlmConfig | null>(null)
const apiKeyInput = ref('')
const extraModelDraft = ref('')
const testResult = ref<KbPlatformLlmConfigTestResult | null>(null)
const skipProviderPreset = ref(true)

const form = reactive({
  enabled: false,
  provider: 'glm' as LlmProvider,
  baseUrl: '',
  model: '',
  temperature: 0.3,
  timeoutSeconds: 90,
  extraModels: [] as string[],
})

const apiKeyPlaceholder = computed(() => {
  if (configLoaded.value?.apiKeyConfigured) {
    return t('system.kbLlm.field.apiKeyPlaceholderReplace')
  }
  return t('system.kbLlm.field.apiKeyEmpty')
})

type ApiKeyUiState = 'pending' | 'configured' | 'missing'

const apiKeyUiState = computed((): ApiKeyUiState => {
  if (apiKeyInput.value.trim()) return 'pending'
  if (configLoaded.value?.apiKeyConfigured) return 'configured'
  return 'missing'
})

const sourceLabel = computed(() => {
  const source = configLoaded.value?.source
  if (source === 'database') return t('system.kbLlm.source.database')
  if (source === 'yaml_fallback') return t('system.kbLlm.source.yaml')
  return source || '-'
})

const modelOptions = computed(() => {
  const set = new Set<string>()
  if (form.model.trim()) set.add(form.model.trim())
  for (const m of form.extraModels) {
    if (m.trim()) set.add(m.trim())
  }
  return [...set]
})

function applyConfig(data: KbPlatformLlmConfig) {
  configLoaded.value = data
  skipProviderPreset.value = true
  form.enabled = data.enabled
  form.provider = (PROVIDER_OPTIONS.includes(data.provider as LlmProvider)
    ? data.provider
    : 'custom') as LlmProvider
  form.baseUrl = data.baseUrl ?? ''
  form.model = data.model ?? ''
  form.temperature = data.temperature ?? 0.3
  form.timeoutSeconds = data.timeoutSeconds ?? 90
  form.extraModels = [...(data.extraModels ?? [])]
  apiKeyInput.value = ''
  testResult.value = null
  queueMicrotask(() => {
    skipProviderPreset.value = false
  })
}

function buildSavePayload(clearApiKey = false): KbPlatformLlmConfigSaveRequest {
  const payload: KbPlatformLlmConfigSaveRequest = {
    enabled: form.enabled,
    provider: form.provider,
    baseUrl: form.baseUrl.trim(),
    model: form.model.trim(),
    temperature: form.temperature,
    timeoutSeconds: form.timeoutSeconds,
    extraModels: form.extraModels.length ? [...form.extraModels] : [],
  }
  if (clearApiKey) {
    payload.apiKey = ''
    payload.clearApiKey = true
  } else if (apiKeyInput.value.trim()) {
    payload.apiKey = apiKeyInput.value.trim()
  } else {
    payload.apiKey = ''
  }
  return payload
}

function buildTestPayload() {
  const payload = buildSavePayload()
  const body: Record<string, unknown> = {
    message: 'ping',
    enabled: payload.enabled,
    provider: payload.provider,
    baseUrl: payload.baseUrl,
    model: payload.model,
    temperature: payload.temperature,
    timeoutSeconds: payload.timeoutSeconds,
    extraModels: payload.extraModels,
  }
  if (apiKeyInput.value.trim()) {
    body.apiKey = apiKeyInput.value.trim()
  }
  return body
}

function validateForm(): string | null {
  if (form.enabled) {
    const url = form.baseUrl.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return t('system.kbLlm.error.baseUrl')
    }
    if (!form.model.trim()) {
      return t('system.kbLlm.error.modelRequired')
    }
  }
  if (form.temperature < 0 || form.temperature > 2) {
    return t('system.kbLlm.error.temperature')
  }
  if (form.timeoutSeconds < 5 || form.timeoutSeconds > 300) {
    return t('system.kbLlm.error.timeout')
  }
  return null
}

function resolvePageAlert(msg: string) {
  if (msg.includes('11_kb_platform_llm_config.sql') || msg.includes('平台 LLM 配置表不可用')) {
    return t('system.kbLlm.error.ddlMissing')
  }
  if (msg.includes('KB_LLM_CONFIG_SECRET') || msg.includes('config-secret')) {
    return t('system.kbLlm.error.secretMissing')
  }
  if (msg.includes('无权管理平台 LLM')) {
    return t('system.kbLlm.error.forbidden')
  }
  return msg
}

async function loadConfig() {
  loading.value = true
  loadError.value = ''
  pageAlert.value = ''
  try {
    const res = await getKbPlatformLlmConfigApi()
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      throw new Error(resolvePageAlert(res.msg || t('system.kbLlm.loadFailed')))
    }
    applyConfig(res.data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : t('system.kbLlm.loadFailed')
    loadError.value = msg
    pageAlert.value = msg
  } finally {
    loading.value = false
  }
}

async function runTest() {
  if (!guardAction(PERM.KB_PLATFORM_LLM)) return
  const error = validateForm()
  if (error) {
    showToast('error', error)
    return
  }
  testing.value = true
  testResult.value = null
  try {
    const res = await testKbPlatformLlmConfigApi(buildTestPayload())
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      throw new Error(res.msg || t('system.kbLlm.test.fail', { error: t('system.kbLlm.saveFailed') }))
    }
    testResult.value = res.data
    if (res.data.success) {
      showToast(
        'success',
        t('system.kbLlm.test.success', { ms: res.data.latencyMs ?? '-' }),
      )
    } else {
      showToast(
        'error',
        t('system.kbLlm.test.fail', { error: res.data.error || t('system.kbLlm.test.unknown') }),
      )
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.kbLlm.saveFailed'))
  } finally {
    testing.value = false
  }
}

async function saveConfig() {
  if (!guardAction(PERM.KB_PLATFORM_LLM)) return
  const error = validateForm()
  if (error) {
    showToast('error', error)
    return
  }
  saving.value = true
  pageAlert.value = ''
  try {
    const res = await saveKbPlatformLlmConfigApi(buildSavePayload())
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      const msg = resolvePageAlert(res.msg || t('system.kbLlm.saveFailed'))
      pageAlert.value = msg
      throw new Error(msg)
    }
    applyConfig(res.data)
    showToast('success', t('system.kbLlm.saveOk'))
  } catch (e) {
    if (!pageAlert.value) {
      showToast('error', e instanceof Error ? e.message : t('system.kbLlm.saveFailed'))
    }
  } finally {
    saving.value = false
  }
}

async function clearDbKey() {
  if (!guardAction(PERM.KB_PLATFORM_LLM)) return
  if (!(await confirm({ message: t('system.kbLlm.action.clearKeyConfirm') }))) return
  saving.value = true
  pageAlert.value = ''
  try {
    const res = await saveKbPlatformLlmConfigApi(buildSavePayload(true))
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      const msg = resolvePageAlert(res.msg || t('system.kbLlm.saveFailed'))
      pageAlert.value = msg
      throw new Error(msg)
    }
    applyConfig(res.data)
    showToast('success', t('system.kbLlm.clearKeyOk'))
  } catch (e) {
    if (!pageAlert.value) {
      showToast('error', e instanceof Error ? e.message : t('system.kbLlm.saveFailed'))
    }
  } finally {
    saving.value = false
  }
}

function addExtraModel() {
  const value = extraModelDraft.value.trim()
  if (!value) return
  if (!form.extraModels.includes(value)) {
    form.extraModels.push(value)
  }
  extraModelDraft.value = ''
}

function removeExtraModel(index: number) {
  form.extraModels.splice(index, 1)
}

watch(
  () => form.provider,
  (next) => {
    if (skipProviderPreset.value || next === 'custom') return
    const preset = PROVIDER_PRESETS[next]
    if (preset) {
      form.baseUrl = preset.baseUrl
      form.model = preset.model
    }
  },
)

onMounted(loadConfig)
</script>

<template>
  <div class="page-stack">
    <div class="card p-5">
      <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <Cpu class="h-5 w-5 text-indigo-500" />
            {{ t('system.kbLlm.title') }}
          </h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('system.kbLlm.subtitle') }}</p>
        </div>
        <button type="button" class="btn-ghost shrink-0" :disabled="loading" @click="loadConfig">
          <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" />
          {{ t('system.kbLlm.reload') }}
        </button>
      </div>

      <div
        v-if="pageAlert"
        class="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
      >
        <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
        <span>{{ pageAlert }}</span>
      </div>

      <div v-if="loading && !configLoaded" class="py-16 text-center text-sm text-gray-400">
        <Loader2 class="mx-auto mb-2 h-6 w-6 animate-spin" />
        {{ t('system.kbLlm.loading') }}
      </div>

      <template v-else-if="configLoaded">
        <div
          class="mb-5 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 dark:border-white/10"
          :class="configLoaded.available
            ? 'border-emerald-200 bg-emerald-50/80 dark:bg-emerald-500/10'
            : 'border-gray-200 bg-gray-50/80 dark:bg-white/5'"
        >
          <span
            class="badge"
            :class="configLoaded.available
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
              : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'"
          >
            {{ configLoaded.available ? t('system.kbLlm.status.available') : t('system.kbLlm.status.unavailable') }}
          </span>
          <span class="badge bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
            {{ sourceLabel }}
          </span>
          <span v-if="configLoaded.updateTime" class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('system.kbLlm.updatedAt', { time: configLoaded.updateTime }) }}
          </span>
        </div>

        <form class="form-grid-pairs max-w-3xl" @submit.prevent="saveConfig">
          <div class="form-grid-row">
            <FormField :label="t('system.kbLlm.field.enabled')" horizontal class="form-field-span-2">
              <div class="flex items-center gap-3">
                <AppSwitch v-model="form.enabled" :label="t('system.kbLlm.field.enabled')" />
                <span class="text-sm text-gray-500 dark:text-gray-400">
                  {{ form.enabled ? t('system.kbLlm.enabledOn') : t('system.kbLlm.enabledOff') }}
                </span>
              </div>
            </FormField>
          </div>

          <div class="form-grid-row">
            <FormField :label="t('system.kbLlm.field.provider')" horizontal>
              <select v-model="form.provider" class="field-input">
                <option v-for="p in PROVIDER_OPTIONS" :key="p" :value="p">
                  {{ t(`system.kbLlm.provider.${p}`) }}
                </option>
              </select>
            </FormField>
            <FormField :label="t('system.kbLlm.field.model')" horizontal required>
              <input v-model="form.model" type="text" class="field-input" list="kb-llm-model-list" />
              <datalist id="kb-llm-model-list">
                <option v-for="m in modelOptions" :key="m" :value="m" />
              </datalist>
            </FormField>
          </div>

          <div class="form-grid-row">
            <FormField :label="t('system.kbLlm.field.baseUrl')" horizontal required class="form-field-span-2">
              <input
                v-model="form.baseUrl"
                type="url"
                class="field-input font-mono text-sm"
                :readonly="form.provider !== 'custom'"
              />
            </FormField>
          </div>

          <div class="form-grid-row">
            <FormField :label="t('system.kbLlm.field.apiKey')" horizontal class="form-field-span-2">
              <div class="space-y-2">
                <div
                  class="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                  :class="{
                    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200':
                      apiKeyUiState === 'configured',
                    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200':
                      apiKeyUiState === 'missing',
                    'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200':
                      apiKeyUiState === 'pending',
                  }"
                >
                  <KeyRound class="h-4 w-4 shrink-0" />
                  <span v-if="apiKeyUiState === 'configured'" class="font-medium">
                    {{ t('system.kbLlm.field.apiKeyConfigured', { mask: configLoaded?.apiKeyMask ?? '****' }) }}
                  </span>
                  <span v-else-if="apiKeyUiState === 'pending'" class="font-medium">
                    {{ t('system.kbLlm.field.apiKeyPendingReplace') }}
                  </span>
                  <span v-else class="font-medium">{{ t('system.kbLlm.field.apiKeyNotConfigured') }}</span>
                  <span
                    v-if="apiKeyUiState === 'configured'"
                    class="text-xs opacity-80"
                  >
                    · {{ t('system.kbLlm.field.apiKeyKeepHint') }}
                  </span>
                </div>
                <input
                  v-model="apiKeyInput"
                  type="password"
                  autocomplete="new-password"
                  class="field-input font-mono text-sm"
                  :placeholder="apiKeyPlaceholder"
                />
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('system.kbLlm.field.apiKeyHint') }}</p>
              </div>
            </FormField>
          </div>

          <div class="form-grid-row">
            <FormField :label="t('system.kbLlm.field.temperature')" horizontal>
              <input v-model.number="form.temperature" type="number" min="0" max="2" step="0.1" class="field-input" />
            </FormField>
            <FormField :label="t('system.kbLlm.field.timeout')" horizontal>
              <input v-model.number="form.timeoutSeconds" type="number" min="5" max="300" step="1" class="field-input" />
            </FormField>
          </div>

          <div class="form-grid-row">
            <FormField :label="t('system.kbLlm.field.extraModels')" horizontal class="form-field-span-2">
              <div class="space-y-2">
                <div v-if="form.extraModels.length" class="flex flex-wrap gap-2">
                  <span
                    v-for="(m, idx) in form.extraModels"
                    :key="m"
                    class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 dark:bg-white/10 dark:text-gray-200"
                  >
                    {{ m }}
                    <button type="button" class="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-white/10" @click="removeExtraModel(idx)">
                      <X class="h-3 w-3" />
                    </button>
                  </span>
                </div>
                <div class="flex gap-2">
                  <input
                    v-model="extraModelDraft"
                    type="text"
                    class="field-input flex-1"
                    :placeholder="t('system.kbLlm.field.extraModelsPlaceholder')"
                    @keydown.enter.prevent="addExtraModel"
                  />
                  <button type="button" class="btn-ghost shrink-0" @click="addExtraModel">
                    {{ t('system.kbLlm.addModel') }}
                  </button>
                </div>
              </div>
            </FormField>
          </div>
        </form>

        <div
          v-if="testResult"
          class="mt-4 max-w-3xl rounded-lg border px-4 py-3 text-sm dark:border-white/10"
          :class="testResult.success
            ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200'
            : 'border-rose-200 bg-rose-50/60 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200'"
        >
          <p class="font-medium">
            {{
              testResult.success
                ? t('system.kbLlm.test.success', { ms: testResult.latencyMs ?? '-' })
                : t('system.kbLlm.test.fail', { error: testResult.error || t('system.kbLlm.test.unknown') })
            }}
          </p>
          <p v-if="testResult.replyPreview" class="mt-1 font-mono text-xs opacity-90">
            {{ testResult.replyPreview }}
          </p>
        </div>

        <div class="mt-6 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-5 dark:border-white/5">
          <button type="button" class="btn-ghost" :disabled="testing || saving" @click="runTest">
            <PlugZap v-if="!testing" class="h-4 w-4" />
            <Loader2 v-else class="h-4 w-4 animate-spin" />
            {{ testing ? t('system.kbLlm.testing') : t('system.kbLlm.action.test') }}
          </button>
          <button type="button" class="btn-primary" :disabled="saving || testing" @click="saveConfig">
            <Save v-if="!saving" class="h-4 w-4" />
            <Loader2 v-else class="h-4 w-4 animate-spin" />
            {{ saving ? t('system.kbLlm.saving') : t('system.kbLlm.action.save') }}
          </button>
          <button
            v-if="configLoaded.persistedInDatabase"
            type="button"
            class="btn-ghost text-rose-600 hover:text-rose-700 dark:text-rose-400"
            :disabled="saving || testing"
            @click="clearDbKey"
          >
            <Trash2 class="h-4 w-4" />
            {{ t('system.kbLlm.action.clearKey') }}
          </button>
        </div>

        <div class="mt-6 max-w-3xl rounded-lg bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-500 dark:bg-white/5 dark:text-gray-400">
          <p>{{ t('system.kbLlm.scope.hint') }}</p>
          <p class="mt-2">{{ t('system.kbLlm.secretHint') }}</p>
        </div>
      </template>

      <p v-else-if="loadError" class="py-12 text-center text-sm text-gray-400">{{ loadError }}</p>
    </div>
  </div>
</template>
