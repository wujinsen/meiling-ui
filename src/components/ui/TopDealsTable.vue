<script setup lang="ts">
import { MoreHorizontal } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

export type TopDealRow = {
  company: string
  logo: string
  logoBg: string
  dealValue: string
  created: number
  won: number
  probability: number
  status: string
  statusClass: string
  owner: string
}

defineProps<{ rows: TopDealRow[] }>()

const { t } = useI18n()

function probabilityClass(value: number) {
  if (value >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (value >= 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full min-w-[720px] text-left text-sm">
      <thead>
        <tr class="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-400 dark:border-white/5">
          <th class="pb-3 pl-1 pr-3">
            <input type="checkbox" class="rounded border-gray-300 dark:border-white/20" />
          </th>
          <th class="pb-3 pr-4">{{ t('analytics.topDeals.company') }}</th>
          <th class="pb-3 pr-4">{{ t('analytics.topDeals.dealValue') }}</th>
          <th class="pb-3 pr-4">{{ t('analytics.topDeals.created') }}</th>
          <th class="pb-3 pr-4">{{ t('analytics.topDeals.won') }}</th>
          <th class="pb-3 pr-4">{{ t('analytics.topDeals.probability') }}</th>
          <th class="pb-3 pr-4">{{ t('analytics.topDeals.status') }}</th>
          <th class="pb-3 pr-4">{{ t('analytics.topDeals.owner') }}</th>
          <th class="pb-3 w-10" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.company"
          class="border-b border-gray-50 transition hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5"
        >
          <td class="py-3.5 pl-1 pr-3">
            <input type="checkbox" class="rounded border-gray-300 dark:border-white/20" />
          </td>
          <td class="py-3.5 pr-4">
            <div class="flex items-center gap-2.5">
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-bold text-white"
                :class="[row.logoBg, row.logo.length > 1 ? 'text-[9px]' : 'text-xs']"
              >{{ row.logo }}</span>
              <span class="font-medium text-gray-900 dark:text-white">{{ row.company }}</span>
            </div>
          </td>
          <td class="py-3.5 pr-4 font-medium text-gray-900 dark:text-white">{{ row.dealValue }}</td>
          <td class="py-3.5 pr-4 text-gray-600 dark:text-gray-300">{{ row.created }}</td>
          <td class="py-3.5 pr-4 text-gray-600 dark:text-gray-300">{{ row.won }}</td>
          <td class="py-3.5 pr-4 font-semibold" :class="probabilityClass(row.probability)">{{ row.probability }}%</td>
          <td class="py-3.5 pr-4">
            <span class="badge" :class="row.statusClass">{{ row.status }}</span>
          </td>
          <td class="py-3.5 pr-4 text-gray-600 dark:text-gray-300">{{ row.owner }}</td>
          <td class="py-3.5">
            <button type="button" class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5">
              <MoreHorizontal class="h-4 w-4" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
