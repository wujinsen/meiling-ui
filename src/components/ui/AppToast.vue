<script setup lang="ts">
import { CircleCheck, CircleX } from 'lucide-vue-next'
import { useToastState } from '@/composables/useToast'

const { toasts } = useToastState()
</script>

<template>
  <Teleport to="body">
    <div class="app-toast-stack" aria-live="polite">
      <TransitionGroup name="app-toast-item" tag="div" class="app-toast-list">
        <div
          v-for="item in toasts"
          :key="item.id"
          :class="[
            'app-toast',
            item.type === 'success' ? 'app-toast-success' : 'app-toast-error',
            { 'app-toast-fading': item.fading },
            item.type === 'error' ? 'app-toast-shake' : 'app-toast-success-burst',
          ]"
          role="status"
        >
          <span class="app-toast-shimmer" aria-hidden="true" />
          <span v-if="item.type === 'success'" class="app-toast-sparkles" aria-hidden="true" />
          <component
            :is="item.type === 'success' ? CircleCheck : CircleX"
            :key="`${item.id}-icon-${item.enterKey}`"
            class="app-toast-icon mt-0.5 h-4 w-4 shrink-0"
          />
          <span class="min-w-0 flex-1 break-words text-left leading-snug">{{ item.text }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
