<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  risk: string
  requiresApproval?: boolean
}>()

const { t } = useI18n()

const label = computed(() => {
  const key = `operation.aiops.risk.${props.risk}` as const
  const base = t(key, props.risk)
  return props.requiresApproval ? `${base} · ${t('operation.aiops.needsApproval')}` : base
})

const toneClass = computed(() => {
  switch (props.risk) {
    case 'read_only':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    case 'destructive':
      return 'bg-red-500/15 text-red-700 dark:text-red-300'
    default:
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
  }
})
</script>

<template>
  <span class="whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium" :class="toneClass">
    {{ label }}
  </span>
</template>
