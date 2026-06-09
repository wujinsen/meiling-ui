<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle } from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import { useConfirmState } from '@/composables/useConfirm'

const { t } = useI18n()
const { state, settle } = useConfirmState()

const title = computed(
  () => state.options.title ?? (state.options.danger ? t('confirm.deleteTitle') : t('confirm.defaultTitle')),
)
const confirmText = computed(
  () => state.options.confirmText ?? (state.options.danger ? t('confirm.confirm') : t('confirm.ok')),
)
const cancelText = computed(() => state.options.cancelText ?? t('confirm.cancel'))
</script>

<template>
  <AppModal
    :open="state.open"
    :title="title"
    close-on-backdrop
    @close="settle(false)"
  >
    <div class="flex gap-4">
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
      <button type="button" class="btn-ghost" @click="settle(false)">
        {{ cancelText }}
      </button>
      <button
        type="button"
        :class="state.options.danger ? 'btn-danger' : 'btn-primary'"
        @click="settle(true)"
      >
        {{ confirmText }}
      </button>
    </template>
  </AppModal>
</template>
