<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, Sparkles } from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import { useConfirmState } from '@/composables/useConfirm'

const { t } = useI18n()
const { state, settle } = useConfirmState()

const isWarm = computed(() => Boolean(state.options.warm))

const title = computed(() => {
  if (isWarm.value) return ''
  return state.options.title ?? (state.options.danger ? t('confirm.deleteTitle') : t('confirm.defaultTitle'))
})

const confirmText = computed(
  () => state.options.confirmText ?? (state.options.danger ? t('confirm.confirm') : t('confirm.ok')),
)
const cancelText = computed(() => state.options.cancelText ?? t('confirm.cancel'))
</script>

<template>
  <AppModal
    :open="state.open"
    :title="title"
    :hide-header="isWarm"
    elevated
    close-on-backdrop
    @close="settle(false)"
  >
    <div v-if="isWarm" class="confirm-warm">
      <div class="confirm-warm-glow" aria-hidden="true" />
      <div class="confirm-warm-icon" aria-hidden="true">
        <Sparkles class="h-7 w-7" />
      </div>
      <p class="confirm-warm-message">{{ state.options.message }}</p>
    </div>

    <div v-else class="flex gap-4">
      <div
        :class="[
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          state.options.danger
            ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'
            : 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
        ]"
      >
        <AlertTriangle class="h-5 w-5" />
      </div>
      <p class="pt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        {{ state.options.message }}
      </p>
    </div>

    <template #footer>
      <div :class="isWarm ? 'flex w-full justify-center gap-3' : 'contents'">
        <button type="button" :class="isWarm ? 'btn-ghost px-5' : 'btn-ghost'" @click="settle(false)">
          {{ cancelText }}
        </button>
        <button
          type="button"
          :class="[
            isWarm ? 'btn-primary px-5 shadow-md shadow-brand-500/20' : '',
            state.options.danger ? 'btn-danger' : isWarm ? '' : 'btn-primary',
          ]"
          @click="settle(true)"
        >
          {{ confirmText }}
        </button>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
.confirm-warm {
  @apply relative flex flex-col items-center px-2 pb-1 pt-2 text-center;
}

.confirm-warm-glow {
  @apply pointer-events-none absolute left-1/2 top-0 h-32 w-32 -translate-x-1/2 rounded-full opacity-60 blur-2xl;
  background: radial-gradient(circle, rgb(167 139 250 / 0.45), rgb(251 191 36 / 0.2), transparent 70%);
}

.confirm-warm-icon {
  @apply relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-brand-600 shadow-lg shadow-brand-500/20 dark:text-brand-300;
  background: linear-gradient(135deg, rgb(237 233 254), rgb(254 243 199));
}

:global(.dark) .confirm-warm-icon {
  background: linear-gradient(135deg, rgb(91 33 182 / 0.35), rgb(245 158 11 / 0.15));
}

.confirm-warm-message {
  @apply relative max-w-xs text-base font-medium leading-relaxed tracking-wide text-gray-700 dark:text-gray-100;
}
</style>
