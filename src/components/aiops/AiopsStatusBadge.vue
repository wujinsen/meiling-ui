<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  status: string
  size?: 'sm' | 'md'
}>()

const { t } = useI18n()

const label = computed(() => {
  const key = `operation.aiops.status.${props.status}` as const
  const translated = t(key)
  return translated === key ? props.status : translated
})

const tone = computed(() => {
  const s = props.status
  if (s === 'succeeded' || s === 'finished') return 'success'
  if (s === 'running' || s === 'executing') return 'running'
  if (s === 'awaiting_approval') return 'pending'
  if (s === 'failed' || s === 'rejected') return 'danger'
  if (s === 'idle') return 'idle'
  return 'neutral'
})
</script>

<template>
  <span
    class="aiops-status-badge"
    :class="[`aiops-status-badge--${tone}`, size === 'md' && 'aiops-status-badge--md']"
  >
    {{ label }}
  </span>
</template>
