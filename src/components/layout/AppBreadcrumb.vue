<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'
import { useBreadcrumb } from '@/composables/useBreadcrumb'

const { breadcrumbs } = useBreadcrumb()
</script>

<template>
  <nav aria-label="Breadcrumb" class="flex min-w-0 items-center gap-1.5">
    <template v-for="(item, index) in breadcrumbs" :key="`${item.label}-${index}`">
      <ChevronRight
        v-if="index > 0"
        class="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-gray-600"
        aria-hidden="true"
      />
      <RouterLink
        v-if="item.to"
        :to="item.to"
        class="truncate text-sm text-gray-500 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
      >
        {{ item.label }}
      </RouterLink>
      <span
        v-else
        :class="[
          'truncate',
          index === breadcrumbs.length - 1
            ? 'page-title text-base sm:text-lg'
            : 'text-sm text-gray-500 dark:text-gray-400',
        ]"
      >
        {{ item.label }}
      </span>
    </template>
  </nav>
</template>
