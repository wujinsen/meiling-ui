<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Box, Maximize2 } from 'lucide-vue-next'
import { usePerspective } from '@/composables/usePerspective'

const { isPerspective, togglePerspective, resetTilt } = usePerspective()
const { t } = useI18n()

let clickTimer: ReturnType<typeof setTimeout> | null = null

const title = computed(() => {
  if (isPerspective.value) {
    return `${t('perspective.toFlat')} · ${t('perspective.dragHint')}`
  }
  return t('perspective.to3d')
})

function onClick() {
  if (clickTimer) clearTimeout(clickTimer)
  clickTimer = setTimeout(() => {
    togglePerspective()
    clickTimer = null
  }, 220)
}

function onDblClick(e: MouseEvent) {
  e.preventDefault()
  if (clickTimer) {
    clearTimeout(clickTimer)
    clickTimer = null
  }
  if (!isPerspective.value) return
  resetTilt()
}
</script>

<template>
  <button
    type="button"
    class="no-tilt-drag flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
    :class="{ 'border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-400': isPerspective }"
    :title="title"
    @click="onClick"
    @dblclick="onDblClick"
  >
    <Maximize2 v-if="isPerspective" key="flat" class="h-4 w-4" />
    <Box v-else key="3d" class="h-4 w-4" />
  </button>
</template>
