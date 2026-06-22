<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, FileText, Link2, Search } from 'lucide-vue-next'
import { getKbIndexApi, getKbPageApi } from '@/api/knowledge'
import { API_SUCCESS_CODE } from '@/types/api'
import { renderMarkdown } from '@/utils/markdown'
import type { KbIndex, KbPage } from '@/types/knowledge'

const { t } = useI18n()

const loading = ref(false)
const detailLoading = ref(false)
const index = ref<KbIndex>({ total: 0, groups: [] })
const keyword = ref('')
const page = ref<KbPage | null>(null)
const activeSlug = ref('')
const openGroups = ref<Record<string, boolean>>({})

const filteredGroups = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return index.value.groups
  return index.value.groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (it) => it.title.toLowerCase().includes(kw) || it.summary?.toLowerCase().includes(kw),
      ),
    }))
    .filter((g) => g.items.length)
})

const contentHtml = computed(() => renderMarkdown(page.value?.content))

function isGroupOpen(type: string) {
  return openGroups.value[type] !== false
}

function toggleGroup(type: string) {
  openGroups.value[type] = !isGroupOpen(type)
}

function formatTime(value?: string) {
  return value || '-'
}

async function loadIndex() {
  loading.value = true
  try {
    const res = await getKbIndexApi()
    if (res.code === API_SUCCESS_CODE && res.data) {
      index.value = res.data
      const first = index.value.groups.find((g) => g.items.length)?.items[0]
      if (first) void openSlug(first.slug)
    }
  } finally {
    loading.value = false
  }
}

async function openSlug(slug: string) {
  if (!slug) return
  activeSlug.value = slug
  detailLoading.value = true
  try {
    const res = await getKbPageApi(slug)
    if (res.code === API_SUCCESS_CODE) page.value = res.data ?? null
  } finally {
    detailLoading.value = false
  }
}

/** 委托点击：正文里的 [[slug]] 站内链接 */
function onContentClick(event: MouseEvent) {
  const target = (event.target as HTMLElement)?.closest('[data-slug]') as HTMLElement | null
  if (target?.dataset.slug) {
    event.preventDefault()
    void openSlug(target.dataset.slug)
  }
}

onMounted(() => loadIndex())
</script>

<template>
  <div class="page-stack">
    <div>
      <h1 class="page-title text-xl">{{ t('knowledge.browse.title') }}</h1>
      <p class="page-subtitle">{{ t('knowledge.browse.subtitle') }}</p>
    </div>

    <div class="flex flex-col gap-4 xl:flex-row xl:items-start">
      <!-- 左：分组目录树 -->
      <aside class="card w-full p-4 xl:w-[22rem] xl:shrink-0 xl:sticky xl:top-20 xl:self-start">
        <div class="relative mb-3">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input v-model="keyword" type="text" class="field-input pl-9" :placeholder="t('knowledge.browse.searchPlaceholder')" />
        </div>

        <p v-if="loading" class="py-8 text-center text-sm text-gray-400">{{ t('common.loading') }}</p>
        <p v-else-if="!filteredGroups.length" class="py-8 text-center text-sm text-gray-400">{{ t('knowledge.browse.empty') }}</p>

        <div v-else class="space-y-1">
          <div v-for="group in filteredGroups" :key="group.type">
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
              @click="toggleGroup(group.type)"
            >
              <ChevronDown class="h-4 w-4 shrink-0 text-gray-400 transition" :class="!isGroupOpen(group.type) && '-rotate-90'" />
              <span class="flex-1 truncate">{{ group.label }}</span>
              <span class="badge bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400">{{ group.items.length }}</span>
            </button>
            <div v-show="isGroupOpen(group.type)" class="ml-2 space-y-0.5 border-l border-gray-100 pl-2 dark:border-white/10">
              <button
                v-for="item in group.items"
                :key="item.slug"
                type="button"
                :class="[
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition',
                  item.slug === activeSlug
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5',
                ]"
                @click="openSlug(item.slug)"
              >
                <FileText class="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span class="truncate">{{ item.title }}</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <!-- 右：单页详情 -->
      <div class="card min-w-0 flex-1 p-6">
        <p v-if="detailLoading" class="py-16 text-center text-sm text-gray-400">{{ t('common.loading') }}</p>
        <div v-else-if="!page" class="flex flex-col items-center justify-center py-20 text-gray-400">
          <FileText class="mb-3 h-10 w-10 opacity-40" />
          <p class="text-sm">{{ t('knowledge.browse.detailEmpty') }}</p>
        </div>
        <article v-else>
          <header class="border-b border-gray-100 pb-4 dark:border-white/5">
            <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ page.title }}</h2>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span class="font-mono text-xs">{{ page.slug }}</span>
              <span v-if="page.kbType">· {{ page.kbType }}</span>
              <span v-if="page.domain">· {{ page.domain }}</span>
              <span>· {{ formatTime(page.updateTime) }}</span>
            </div>
            <div v-if="page.tags?.length" class="mt-3 flex flex-wrap gap-1.5">
              <span v-for="tag in page.tags" :key="tag" class="user-role-tag">{{ tag }}</span>
            </div>
          </header>

          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="kb-markdown mt-4" @click="onContentClick" v-html="contentHtml" />

          <section
            v-if="page.outLinks?.length || page.backLinks?.length"
            class="mt-6 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 dark:border-white/5 sm:grid-cols-2"
          >
            <div v-if="page.outLinks?.length">
              <h3 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <Link2 class="h-4 w-4" /> {{ t('knowledge.browse.outLinks') }}
              </h3>
              <ul class="space-y-1.5">
                <li v-for="l in page.outLinks" :key="l.slug">
                  <button type="button" class="kb-linkrow" @click="openSlug(l.slug)">
                    <span class="truncate">{{ l.title }}</span>
                    <span v-if="l.relationType" class="badge bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400">{{ l.relationType }}</span>
                  </button>
                </li>
              </ul>
            </div>
            <div v-if="page.backLinks?.length">
              <h3 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <Link2 class="h-4 w-4 -scale-x-100" /> {{ t('knowledge.browse.backLinks') }}
              </h3>
              <ul class="space-y-1.5">
                <li v-for="l in page.backLinks" :key="l.slug">
                  <button type="button" class="kb-linkrow" @click="openSlug(l.slug)">
                    <span class="truncate">{{ l.title }}</span>
                    <span v-if="l.relationType" class="badge bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400">{{ l.relationType }}</span>
                  </button>
                </li>
              </ul>
            </div>
          </section>
        </article>
      </div>
    </div>
  </div>
</template>
