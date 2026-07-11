<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  status?: string | null
}>()

const { t } = useI18n()

const label = computed(() => {
  const s = props.status
  if (!s) return '-'
  const key = `operation.task.status.${s}` as const
  return t(key)
})

const badgeClass = computed(() => {
  const s = props.status
  if (s === 'success') return 'operation-task-status--success'
  if (s === 'failed') return 'operation-task-status--failed'
  if (s === 'running') return 'operation-task-status--running'
  if (s === 'pending') return 'operation-task-status--pending'
  return 'operation-task-status--unknown'
})
</script>

<template>
  <span class="operation-task-status" :class="badgeClass">{{ label }}</span>
</template>
