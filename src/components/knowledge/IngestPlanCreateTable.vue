<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Trash2 } from 'lucide-vue-next'
import KbCategorySelect from '@/components/knowledge/KbCategorySelect.vue'
import type { KbCategoryFlatOption, KbCategoryTree } from '@/types/knowledge'
import type { IngestPlanCreateRow } from '@/utils/ingestPlanPath'
import { buildCategoryIndex, previewRelPath, wikiDirForSpace } from '@/utils/ingestPlanPath'

const rows = defineModel<IngestPlanCreateRow[]>({ required: true })

const props = withDefaults(
  defineProps<{
    categoryOptions: KbCategoryFlatOption[]
    categoryTree: KbCategoryTree[]
    categoriesLoading?: boolean
    spaceCode?: string
    readonly?: boolean
  }>(),
  { categoriesLoading: false, readonly: false },
)

const { t } = useI18n()

const categoryIndex = computed(() => buildCategoryIndex(props.categoryTree))
const wikiRoot = computed(() => wikiDirForSpace(props.spaceCode))

function categoryForRow(row: IngestPlanCreateRow): KbCategoryTree | undefined {
  const id = row.categoryId?.trim()
  return id ? categoryIndex.value.get(id) : undefined
}

function pathPreview(row: IngestPlanCreateRow): string {
  const rel = previewRelPath(row, categoryForRow(row))
  if (!rel) return '—'
  return `${wikiRoot.value}/${rel}.md`
}

function sourcesLabel(sources?: string[]): string {
  if (!sources?.length) return '—'
  return sources.map((s) => s.replace(/^raw\//, '')).join(', ')
}

function removeRow(index: number) {
  if (props.readonly) return
  const next = [...rows.value]
  next.splice(index, 1)
  rows.value = next
}

function patchRow(index: number, patch: Partial<IngestPlanCreateRow>) {
  if (props.readonly) return
  const next = [...rows.value]
  next[index] = { ...next[index], ...patch }
  rows.value = next
}
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
    <table class="w-full min-w-[720px] text-left text-xs">
      <thead class="bg-gray-50/80 text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
        <tr>
          <th class="px-3 py-2 font-medium">{{ t('knowledge.ingest.planCategory') }}</th>
          <th class="px-3 py-2 font-medium">{{ t('knowledge.ingest.planSlug') }}</th>
          <th class="px-3 py-2 font-medium">{{ t('knowledge.ingest.planTitle') }}</th>
          <th class="px-3 py-2 font-medium">{{ t('knowledge.ingest.planSources') }}</th>
          <th class="px-3 py-2 font-medium">{{ t('knowledge.ingest.planPathPreview') }}</th>
          <th v-if="!readonly" class="w-10 px-2 py-2" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in rows"
          :key="`${index}-${row.slug}-${row.categoryId}`"
          class="border-t border-gray-100 dark:border-white/5"
        >
          <td class="px-3 py-2 align-top">
            <KbCategorySelect
              :model-value="row.categoryId ?? ''"
              :options="categoryOptions"
              :loading="categoriesLoading"
              :disabled="readonly"
              :empty-label="t('knowledge.ingest.planCategoryNone')"
              @update:model-value="patchRow(index, { categoryId: $event || undefined })"
            />
          </td>
          <td class="px-3 py-2 align-top">
            <input
              :value="row.slug ?? ''"
              type="text"
              class="field-input w-full min-w-[10rem] font-mono text-xs"
              :placeholder="t('knowledge.ingest.planSlugPlaceholder')"
              :disabled="readonly"
              :title="t('knowledge.ingest.planSlugHint')"
              @input="patchRow(index, { slug: ($event.target as HTMLInputElement).value })"
            />
          </td>
          <td class="px-3 py-2 align-top">
            <input
              :value="row.title ?? ''"
              type="text"
              class="field-input w-full min-w-[8rem] text-xs"
              :disabled="readonly"
              @input="patchRow(index, { title: ($event.target as HTMLInputElement).value })"
            />
          </td>
          <td class="max-w-[12rem] px-3 py-2 align-top">
            <p class="truncate font-mono text-gray-500 dark:text-gray-400" :title="sourcesLabel(row.sources)">
              {{ sourcesLabel(row.sources) }}
            </p>
          </td>
          <td class="px-3 py-2 align-top">
            <code
              class="block max-w-[14rem] truncate rounded bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] text-brand-700 dark:bg-white/5 dark:text-brand-300"
              :title="pathPreview(row)"
            >
              {{ pathPreview(row) }}
            </code>
          </td>
          <td v-if="!readonly" class="px-2 py-2 align-top">
            <button
              type="button"
              class="btn-ghost p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
              :title="t('knowledge.ingest.planRemoveRow')"
              @click="removeRow(index)"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <p v-if="!categoryOptions.length && !categoriesLoading" class="mt-2 text-xs text-amber-700 dark:text-amber-300">
    {{ t('knowledge.ingest.planNoCategoryHint') }}
    <RouterLink to="/knowledge/documents" class="underline">{{ t('knowledge.docManage.title') }}</RouterLink>
  </p>
  <p class="mt-2 text-xs text-gray-400">{{ t('knowledge.ingest.planSlugHint') }}</p>
</template>
