<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AiopsHealthStatus } from '@/types/aiops'

const props = defineProps<{
  health: AiopsHealthStatus | null
}>()

const { t } = useI18n()

const chips = computed(() => {
  const h = props.health
  if (!h) return []
  const items = [
    {
      key: 'llm',
      label: h.llm_configured
        ? t('operation.aiops.health.llmOn', { providers: h.llm_providers.join('/') })
        : t('operation.aiops.health.llmOff'),
      tone: h.llm_configured ? 'ok' : 'warn',
    },
    {
      key: 'cmdb',
      label: t('operation.aiops.health.cmdb', { source: h.cmdb_source }),
      tone: 'neutral',
    },
    {
      key: 'exec',
      label: h.exec_enabled ? t('operation.aiops.health.execOn') : t('operation.aiops.health.execOff'),
      tone: h.exec_enabled ? 'ok' : 'warn',
    },
  ]
  if (h.force_dry_run) {
    items.push({ key: 'dry', label: t('operation.aiops.health.forceDryRun'), tone: 'warn' })
  }
  return items
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <span
      v-for="chip in chips"
      :key="chip.key"
      class="rounded-full border px-2.5 py-0.5 text-xs"
      :class="{
        'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300': chip.tone === 'ok',
        'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300': chip.tone === 'warn',
        'border-border bg-muted/40 text-muted-foreground': chip.tone === 'neutral',
      }"
    >
      {{ chip.label }}
    </span>
  </div>
</template>
