<script setup lang="ts">
import { ShieldOff } from 'lucide-vue-next'

defineProps<{
  title: string
  message?: string
  hint?: string
}>()
</script>

<template>
  <div class="card flex flex-col items-center justify-center px-6 py-16 text-center">
    <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-500/15">
      <ShieldOff class="h-7 w-7" />
    </div>
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ title }}</h2>
    <p v-if="message" class="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">{{ message }}</p>
    <p v-if="hint" class="mt-3 max-w-md text-xs text-gray-400">{{ hint }}</p>
    <slot />
  </div>
</template>
