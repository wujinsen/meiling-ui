<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, Sparkles } from 'lucide-vue-next'
import { getKbLlmConfigApi, updateKbLlmConfigApi } from '@/api/knowledge'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbLlmConfig } from '@/types/knowledge'

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const config = ref<KbLlmConfig | null>(null)

const statusLabel = computed(() => {
  if (!config.value) return ''
  if (config.value.usable) return t('knowledge.ask.llm.statusGenerative')
  if (config.value.enabled && !config.value.apiKeyConfigured) {
    return t('knowledge.ask.llm.statusNoKey')
  }
  return t('knowledge.ask.llm.statusRetrieval')
})

const statusClass = computed(() => {
  if (config.value?.usable) {
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
  }
  return 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
})

async function loadConfig() {
  loading.value = true
  try {
    const res = await getKbLlmConfigApi()
    if (res.code === API_SUCCESS_CODE && res.data) {
      config.value = res.data
    }
  } finally {
    loading.value = false
  }
}

async function onToggle(event: Event) {
  if (!config.value?.canManage || saving.value) {
    event.preventDefault()
    return
  }
  const input = event.target as HTMLInputElement
  const next = input.checked
  const prev = config.value.enabled
  config.value = { ...config.value, enabled: next }
  saving.value = true
  try {
    const res = await updateKbLlmConfigApi(next)
    if (res.code !== API_SUCCESS_CODE) {
      throw new Error(res.msg || t('knowledge.ask.llm.updateFailed'))
    }
    showToast('success', next ? t('knowledge.ask.llm.enabledOk') : t('knowledge.ask.llm.disabledOk'))
    await loadConfig()
  } catch (e) {
    if (config.value) config.value.enabled = prev
    input.checked = prev
    showToast('error', e instanceof Error ? e.message : t('knowledge.ask.llm.updateFailed'))
  } finally {
    saving.value = false
  }
}

onMounted(() => loadConfig())

defineExpose({ reload: loadConfig })
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2.5 dark:border-white/5">
    <div class="flex min-w-0 items-center gap-2">
      <Sparkles class="h-4 w-4 shrink-0 text-brand-500" />
      <div class="min-w-0">
        <p class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('knowledge.ask.llm.title') }}</p>
        <p v-if="loading" class="text-xs text-gray-400">{{ t('common.loading') }}</p>
        <p v-else class="truncate text-xs text-gray-500 dark:text-gray-400">
          <span v-if="config?.provider">{{ config.provider }} · {{ config.model }}</span>
          <span v-if="config?.nacosManaged" class="ml-1 text-gray-400">· Nacos</span>
        </p>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <span v-if="config && !loading" class="badge shrink-0" :class="statusClass">{{ statusLabel }}</span>
      <label
        v-if="config?.canManage"
        class="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300"
        :class="saving && 'opacity-60'"
      >
        <span class="text-xs">{{ t('knowledge.ask.llm.switch') }}</span>
        <input
          type="checkbox"
          class="h-4 w-4 rounded"
          :checked="config.enabled"
          :disabled="saving"
          @change="onToggle"
        />
        <Loader2 v-if="saving" class="h-3.5 w-3.5 animate-spin text-gray-400" />
      </label>
      <p v-else-if="config && !config.canManage" class="text-xs text-gray-400">
        {{ t('knowledge.ask.llm.readOnlyHint') }}
      </p>
    </div>
  </div>
</template>
