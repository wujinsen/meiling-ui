<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { CopyMinus, X, XCircle } from 'lucide-vue-next'
import { usePageTabs } from '@/composables/usePageTabs'
import { usePermission } from '@/composables/usePermission'
import { normalizePath, findMenuByPath } from '@/utils/breadcrumb'
import { resolveMenuLabel } from '@/utils/menuLabel'

const route = useRoute()
const { t, locale } = useI18n()
const { menus } = usePermission()
const { tabs, switchTab, closeTab, closeOtherTabs, closeAllTabs } = usePageTabs()

const scrollerRef = ref<HTMLElement | null>(null)

const activeKey = computed(() => route.fullPath)

function tabLabel(tab: (typeof tabs.value)[number]) {
  if (tab.titleKey) return t(tab.titleKey)
  const menu = findMenuByPath(menus.value, tab.path)
  if (menu) return resolveMenuLabel(menu, t, locale.value)
  return tab.title || t('nav.dashboard')
}

function isActive(tab: (typeof tabs.value)[number]) {
  return normalizePath(tab.fullPath) === normalizePath(activeKey.value)
}

async function scrollActiveIntoView() {
  await nextTick()
  const scroller = scrollerRef.value
  if (!scroller) return
  const activeEl = scroller.querySelector<HTMLElement>('[data-active="true"]')
  activeEl?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

watch(activeKey, () => scrollActiveIntoView(), { immediate: true })
watch(() => tabs.value.length, () => scrollActiveIntoView())
</script>

<template>
  <div
    v-if="tabs.length"
    class="page-tabs-bar flex shrink-0 items-center gap-2 border-b border-gray-100 bg-gray-50/80 px-3 dark:border-white/5 dark:bg-surface-dark-card/60 sm:px-4"
  >
    <div v-if="tabs.length > 1" class="page-tabs-actions shrink-0">
      <button
        type="button"
        class="page-tabs-action-btn"
        :title="t('tabs.closeOthers')"
        @click="closeOtherTabs(activeKey)"
      >
        <CopyMinus class="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span class="hidden sm:inline">{{ t('tabs.closeOthers') }}</span>
      </button>
      <button
        type="button"
        class="page-tabs-action-btn"
        :title="t('tabs.closeAll')"
        @click="closeAllTabs"
      >
        <XCircle class="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span class="hidden sm:inline">{{ t('tabs.closeAll') }}</span>
      </button>
    </div>

    <div ref="scrollerRef" class="page-tabs-scroll flex min-w-0 flex-1 items-end gap-1 overflow-x-auto py-2">
      <div
        v-for="tab in tabs"
        :key="tab.key"
        :data-active="isActive(tab) ? 'true' : 'false'"
        :class="['page-tab', isActive(tab) && 'page-tab-active']"
        @click="switchTab(tab)"
      >
        <span class="max-w-[9rem] truncate sm:max-w-[11rem]">{{ tabLabel(tab) }}</span>
        <button
          v-if="!tab.affix"
          type="button"
          class="page-tab-close"
          :aria-label="t('tabs.close')"
          @click.stop="closeTab(tab.key)"
        >
          <X class="h-3 w-3" />
        </button>
      </div>
    </div>
  </div>
</template>
