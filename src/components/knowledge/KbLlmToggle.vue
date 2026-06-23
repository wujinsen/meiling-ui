<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sparkles } from 'lucide-vue-next'
import { getKbLlmConfigApi } from '@/api/knowledge'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbLlmConfig } from '@/types/knowledge'

const model = defineModel<boolean>({ default: false })

const emit = defineEmits<{
  availability: [available: boolean]
  status: [payload: { loading: boolean; label: string; className: string }]
}>()

const { t } = useI18n()

const loading = ref(false)
const backend = ref<KbLlmConfig | null>(null)

const available = computed(() => backend.value?.available ?? false)

const statusLabel = computed(() => {
  if (!model.value) return t('knowledge.ask.llm.statusRetrieval')
  if (available.value) return t('knowledge.ask.llm.statusGenerative')
  return t('knowledge.ask.llm.statusUnavailable')
})

const statusClass = computed(() => {
  if (model.value && available.value) {
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
  }
  return 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
})

const modelHint = computed(() => {
  if (loading.value) return t('common.loading')
  if (backend.value?.available) return `${backend.value.provider} · ${backend.value.model}`
  return t('knowledge.ask.llm.backendUnavailable')
})

async function loadBackend() {
  loading.value = true
  try {
    const res = await getKbLlmConfigApi()
    if (res.code === API_SUCCESS_CODE && res.data) {
      backend.value = res.data
    }
  } finally {
    loading.value = false
  }
}

watch(available, (ok) => {
  emit('availability', ok)
  if (!ok && model.value) {
    model.value = false
  }
}, { immediate: true })

function emitStatus() {
  emit('status', {
    loading: loading.value,
    label: statusLabel.value,
    className: statusClass.value,
  })
}

watch([model, available, loading], emitStatus, { immediate: true })

onMounted(() => loadBackend())
</script>

<template>
  <div class="kb-ask-llm-bar min-w-0 flex-1">
    <div class="flex min-w-0 items-center gap-2.5">
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/15">
        <Sparkles class="h-4 w-4" />
      </div>
      <div class="min-w-0">
        <p class="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('knowledge.ask.llm.title') }}</p>
        <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ modelHint }}</p>
      </div>
    </div>
  </div>
</template>
