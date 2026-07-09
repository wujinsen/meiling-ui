<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { portMatchClass, portMatchLabelKey } from '@/utils/operationPort'

const props = defineProps<{
  status?: number | null
  expectedPort?: string | null
}>()

const { t } = useI18n()

const label = computed(() => t(portMatchLabelKey(props.status)))
const badgeClass = computed(() => portMatchClass(props.status))
</script>

<template>
  <span class="inline-flex items-center gap-1 text-xs font-medium" :class="badgeClass">
    <span class="h-2 w-2 rounded-full bg-current opacity-80" />
    {{ label }}
    <span v-if="expectedPort && status === 2" class="text-[10px] opacity-80">({{ expectedPort }})</span>
  </span>
</template>
