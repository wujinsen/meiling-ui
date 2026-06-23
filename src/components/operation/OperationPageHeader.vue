<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="page-header-card card">
    <div class="page-header-top">
      <div class="min-w-0">
        <h1 class="page-title text-xl">{{ title }}</h1>
        <p v-if="subtitle" class="page-subtitle mt-1">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="page-header-actions">
        <slot name="actions" />
      </div>
    </div>
    <div v-if="$slots.toolbar" class="page-header-toolbar">
      <slot name="toolbar" />
    </div>
  </div>
</template>
