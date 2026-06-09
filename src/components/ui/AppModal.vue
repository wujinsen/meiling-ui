<script setup lang="ts">
import { toRef } from 'vue'
import { useEscapeClose } from '@/composables/useEscapeClose'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    wide?: boolean
    /** 点击遮罩是否关闭，表单弹窗建议 false */
    closeOnBackdrop?: boolean
  }>(),
  { closeOnBackdrop: false },
)

const emit = defineEmits<{
  close: []
}>()

useEscapeClose(toRef(props, 'open'), () => emit('close'))
</script>

<template>
  <Teleport to="body">
    <Transition name="palette">
      <div
        v-if="open"
        class="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8 backdrop-blur-sm"
        @click.self="closeOnBackdrop && emit('close')"
      >
        <div
          :class="[
            'w-full rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-surface-dark-card',
            wide ? 'max-w-3xl' : 'max-w-lg',
          ]"
          role="dialog"
          aria-modal="true"
          @click.stop
        >
          <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/5">
            <h3 class="page-title text-base">{{ title }}</h3>
            <button
              type="button"
              class="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5"
              @click="emit('close')"
            >
              ✕
            </button>
          </div>
          <div class="px-5 py-5">
            <slot />
          </div>
          <div v-if="$slots.footer" class="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-white/5">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
