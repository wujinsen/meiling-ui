<script setup lang="ts">
import { toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { TrendingDown, TrendingUp } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'
import { useCountUp } from '@/composables/useCountUp'

const props = defineProps<{
  label: string
  value: string
  sub?: string
  change?: string
  up?: boolean
  clickable?: boolean
}>()

defineEmits<{ click: [] }>()

const { isDark } = useTheme()
const { t } = useI18n()
const animatedValue = useCountUp(toRef(props, 'value'), { duration: 1200 })
</script>

<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :type="clickable ? 'button' : undefined"
    :class="[
      'card w-full p-5 text-left transition duration-300',
      clickable
        ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40'
        : 'hover:shadow-card-hover',
      !isDark && 'border-l-4 border-l-brand-500',
    ]"
    :disabled="clickable ? false : undefined"
    @click="clickable && $emit('click')"
  >
    <p class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ label }}</p>
    <p class="mt-1 text-2xl font-bold tracking-tight tabular-nums text-gray-900 dark:text-white">
      {{ animatedValue }}
    </p>
    <div v-if="change" class="mt-2 flex items-center gap-1 text-sm">
      <TrendingUp v-if="up" class="h-4 w-4 text-emerald-500" />
      <TrendingDown v-else class="h-4 w-4 text-red-400" />
      <span :class="up ? 'text-emerald-500' : 'text-red-400'">{{ change }}</span>
      <span class="text-gray-400 dark:text-gray-500">{{ t('common.vsLastPeriod') }}</span>
    </div>
    <p v-else-if="sub" class="mt-1 text-sm text-gray-400 dark:text-gray-500">{{ sub }}</p>
  </component>
</template>
