<script setup lang="ts">
import { CircleCheck, CircleX } from 'lucide-vue-next'
import { useToastState } from '@/composables/useToast'

const { toast } = useToastState()
</script>

<template>
  <Teleport to="body">
    <Transition name="app-toast">
      <div
        v-if="toast"
        :class="['app-toast', toast.type === 'success' ? 'app-toast-success' : 'app-toast-error']"
        role="status"
        aria-live="polite"
      >
        <component :is="toast.type === 'success' ? CircleCheck : CircleX" class="h-4 w-4 shrink-0" />
        <span class="truncate">{{ toast.text }}</span>
      </div>
    </Transition>
  </Teleport>
</template>
