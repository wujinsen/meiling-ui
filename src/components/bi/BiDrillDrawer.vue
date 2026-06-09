<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import type { BiDrillRow } from '@/types/bi'

const props = defineProps<{
  open: boolean
  title: string
  breadcrumb: string[]
  rows: BiDrillRow[]
  loading: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

const columns = computed(() => {
  const row = props.rows[0]
  if (!row) return []
  return Object.keys(row)
})
</script>

<template>
  <AppModal :open="open" :title="title" wide @close="emit('close')">
    <nav v-if="breadcrumb.length" class="mb-4 flex flex-wrap items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
      <template v-for="(crumb, i) in breadcrumb" :key="i">
        <span v-if="i > 0" class="text-gray-300 dark:text-gray-600">/</span>
        <span :class="i === breadcrumb.length - 1 ? 'font-medium text-brand-600 dark:text-brand-400' : ''">
          {{ crumb.startsWith('bi.') || crumb.startsWith('cockpit.') ? t(crumb) : crumb }}
        </span>
      </template>
    </nav>

    <div v-if="loading" class="py-12 text-center text-gray-500 dark:text-gray-400">{{ t('bi.loading') }}</div>
    <div v-else-if="!rows.length" class="py-12 text-center text-gray-500 dark:text-gray-400">{{ t('bi.drillEmpty') }}</div>
    <div v-else class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/10">
      <table class="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr class="border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-400 dark:border-white/5 dark:bg-white/5">
            <th v-for="col in columns" :key="col" class="px-4 py-3">{{ col }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, idx) in rows"
            :key="idx"
            class="border-b border-gray-50 transition hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5"
          >
            <td v-for="col in columns" :key="col" class="px-4 py-2.5 text-gray-700 dark:text-gray-200">
              {{ row[col] }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <template #footer>
      <button type="button" class="btn-ghost" @click="emit('close')">{{ t('bi.close') }}</button>
    </template>
  </AppModal>
</template>
