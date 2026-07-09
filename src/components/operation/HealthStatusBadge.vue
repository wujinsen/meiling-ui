<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { healthStatusClass, healthStatusLabelKey } from '@/utils/operationHealth'

const props = defineProps<{
  status?: number | null
  lastCheckTime?: string | number | null
  showTime?: boolean
}>()

const { t } = useI18n()

const label = computed(() => t(healthStatusLabelKey(props.status)))
const badgeClass = computed(() => healthStatusClass(props.status))
</script>

<template>
  <div class="inline-flex flex-col gap-0.5">
    <span class="inline-flex items-center gap-1.5 text-xs font-medium" :class="badgeClass">
      <span class="h-2 w-2 rounded-full bg-current opacity-80" />
      {{ label }}
    </span>
    <span v-if="showTime && lastCheckTime" class="text-[10px] text-gray-400">{{ lastCheckTime }}</span>
  </div>
</template>
