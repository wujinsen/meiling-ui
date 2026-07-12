<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { environmentBadgeClass, environmentI18nKey } from '@/utils/operationEnv'

const props = withDefaults(
  defineProps<{
    environment?: number | null
    size?: 'sm' | 'md'
  }>(),
  { size: 'md' },
)

const { t } = useI18n()

const label = computed(() => t(environmentI18nKey(props.environment ?? undefined)))
const toneClass = computed(() => environmentBadgeClass(props.environment ?? undefined))
const sizeClass = computed(() => (props.size === 'sm' ? 'operation-env-badge--sm' : ''))
</script>

<template>
  <span class="operation-env-badge" :class="[toneClass, sizeClass]" :title="label">
    {{ label }}
  </span>
</template>
