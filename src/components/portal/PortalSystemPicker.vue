<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PortalCardPopFx from '@/components/portal/PortalCardPopFx.vue'
import {
  filterPortalSystems,
  groupPortalSystems,
  portalGroupDomId,
  type SystemGroup,
} from '@/constants/systemGroup'
import { isPortalSystemReady } from '@/constants/portalEnterable'
import type { SystemVo } from '@/types/system'
import { ExternalLink, LayoutGrid, Loader2, Search, Star } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    systems: SystemVo[]
    variant?: 'page' | 'menu'
    currentId?: number | string | null
    loadingId?: number | string | null
    disabled?: boolean
    showSearch?: boolean
    searchQuery?: string
    /** 选系统页：未就绪系统点击不跳转，卡片蹦出日月星特效 */
    blockUnavailable?: boolean
  }>(),
  {
    variant: 'page',
    currentId: null,
    loadingId: null,
    disabled: false,
    blockUnavailable: false,
  },
)

const emit = defineEmits<{
  select: [id: number | string]
  'update:searchQuery': [value: string]
}>()

const { t } = useI18n()
const internalKeyword = ref('')

const keyword = computed({
  get() {
    return props.searchQuery ?? internalKeyword.value
  },
  set(value: string) {
    internalKeyword.value = value
    emit('update:searchQuery', value)
  },
})

const searchEnabled = computed(() => props.showSearch ?? props.systems.length > 6)

const filteredSystems = computed(() => filterPortalSystems(props.systems, keyword.value))
const groupedSystems = computed(() => groupPortalSystems(filteredSystems.value))
const isEmpty = computed(() => !filteredSystems.value.length)

const popFx = ref<InstanceType<typeof PortalCardPopFx> | null>(null)
const bounceId = ref<number | string | null>(null)
let bounceTimer: ReturnType<typeof setTimeout> | null = null

function isEnterable(item: SystemVo) {
  if (!props.blockUnavailable) return true
  return isPortalSystemReady(item)
}

function onSelect(item: SystemVo, event: MouseEvent) {
  if (props.disabled || props.loadingId != null) return
  if (!isEnterable(item)) {
    const el = event.currentTarget
    if (el instanceof HTMLElement) popFx.value?.spawnFromElement(el)
    bounceId.value = item.id ?? null
    if (bounceTimer) clearTimeout(bounceTimer)
    bounceTimer = setTimeout(() => {
      bounceId.value = null
      bounceTimer = null
    }, 620)
    return
  }
  emit('select', item.id)
}

function isCurrent(id: number | string) {
  return props.currentId != null && String(props.currentId) === String(id)
}

function groupLabel(key: SystemGroup) {
  return t(`system.portal.group.${key}`)
}
</script>

<template>
  <div class="portal-system-picker" :class="variant === 'menu' ? 'portal-system-picker-menu' : 'portal-system-picker-page'">
    <PortalCardPopFx v-if="blockUnavailable" ref="popFx" />
    <div v-if="searchEnabled" class="portal-system-picker-search">
      <Search class="h-4 w-4 shrink-0 text-gray-400" />
      <input
        v-model="keyword"
        type="search"
        class="field-input min-w-0 flex-1 border-0 bg-transparent px-0 py-0 shadow-none focus:ring-0"
        :placeholder="t('system.portal.searchPlaceholder')"
        @click.stop
      />
    </div>

    <p v-if="isEmpty" class="portal-system-picker-empty">{{ t('system.portal.searchEmpty') }}</p>

    <template v-else>
      <section
        v-for="group in groupedSystems"
        :key="group.key"
        :id="variant === 'page' ? portalGroupDomId(group.key) : undefined"
        class="portal-system-picker-group"
      >
        <div class="portal-system-picker-group-head">
          <h2 v-if="variant === 'page'" class="portal-system-picker-group-title">
            {{ groupLabel(group.key) }}
          </h2>
          <p v-else class="portal-system-picker-group-label">
            {{ groupLabel(group.key) }}
          </p>
          <span class="portal-system-picker-group-count">{{ t('system.portal.groupCount', { count: group.items.length }) }}</span>
        </div>

        <div
          class="portal-system-picker-items"
          :class="variant === 'page' ? 'portal-system-picker-grid' : 'portal-system-picker-list'"
        >
          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            class="portal-system-picker-item"
            :class="{
              'portal-system-picker-item-active': isCurrent(item.id),
              'portal-system-picker-item-menu': variant === 'menu',
              'portal-system-picker-item-soon': blockUnavailable && !isEnterable(item),
              'portal-system-picker-item-bounce': bounceId != null && String(bounceId) === String(item.id),
            }"
            :disabled="disabled || loadingId != null"
            @click="onSelect(item, $event)"
          >
            <div
              v-if="variant === 'page'"
              class="portal-system-picker-icon"
            >
              <LayoutGrid class="h-4 w-4" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 items-center gap-1.5">
                <span class="portal-system-picker-name">{{ item.systemName }}</span>
                <span
                  v-if="item.isDefault"
                  class="portal-system-badge portal-system-badge-default"
                  :title="t('system.portal.defaultBadge')"
                >
                  <Star class="h-2.5 w-2.5" />
                </span>
                <span
                  v-if="item.ssoMode === 'EXTERNAL'"
                  class="portal-system-badge portal-system-badge-external"
                  :title="t('system.portal.externalBadge')"
                >
                  <ExternalLink class="h-2.5 w-2.5" />
                </span>
              </div>
              <p class="portal-system-picker-code">{{ item.systemCode }}</p>
            </div>
            <Loader2
              v-if="loadingId === item.id"
              class="h-4 w-4 shrink-0 animate-spin text-brand-500"
            />
          </button>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.portal-system-picker-search {
  @apply mb-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5;
}

.portal-system-picker-empty {
  @apply py-8 text-center text-sm text-gray-400;
}

.portal-system-picker-group {
  @apply scroll-mt-24;
}

.portal-system-picker-group + .portal-system-picker-group {
  @apply mt-5;
}

.portal-system-picker-group-head {
  @apply mb-2 flex items-center gap-2;
}

.portal-system-picker-group-title {
  @apply text-sm font-medium text-gray-700 dark:text-gray-300;
}

.portal-system-picker-group-label {
  @apply px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400;
}

.portal-system-picker-group-count {
  @apply rounded-full bg-gray-100 px-2 py-0.5 text-[10px] tabular-nums text-gray-500 dark:bg-white/10 dark:text-gray-400;
}

.portal-system-picker-grid {
  @apply grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4;
}

.portal-system-picker-list {
  @apply flex flex-col gap-0.5 px-1;
}

.portal-system-picker-item {
  @apply flex items-center gap-2.5 rounded-lg border border-gray-100 bg-white p-2.5 text-left transition hover:border-brand-200 hover:bg-brand-50/40 dark:border-white/5 dark:bg-transparent dark:hover:border-brand-500/30 dark:hover:bg-white/5;
}

.portal-system-picker-item-menu {
  @apply border-transparent px-2 py-1.5 hover:border-transparent;
}

.portal-system-picker-item-active {
  @apply border-brand-200 bg-brand-50/60 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300;
}

.portal-system-picker-item-soon {
  @apply cursor-pointer;
}

.portal-system-picker-item-soon:hover {
  @apply border-amber-200/80 bg-amber-50/30 dark:border-amber-500/25 dark:bg-amber-500/5;
}

.portal-system-picker-item-bounce {
  animation: portal-system-card-bounce 0.62s cubic-bezier(0.34, 1.4, 0.64, 1);
  z-index: 1;
}

@keyframes portal-system-card-bounce {
  0% {
    transform: scale(1) translateY(0);
  }
  22% {
    transform: scale(1.06) translateY(-4px);
  }
  45% {
    transform: scale(0.98) translateY(1px);
  }
  68% {
    transform: scale(1.02) translateY(-2px);
  }
  100% {
    transform: scale(1) translateY(0);
  }
}

.portal-system-picker-icon {
  @apply flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400;
}

.portal-system-picker-name {
  @apply truncate text-sm font-medium text-gray-900 dark:text-white;
}

.portal-system-picker-item-active .portal-system-picker-name {
  @apply text-brand-700 dark:text-brand-300;
}

.portal-system-picker-code {
  @apply truncate text-[11px] text-gray-500 dark:text-gray-400;
}

.portal-system-badge {
  @apply inline-flex shrink-0 items-center rounded-full p-0.5;
}

.portal-system-badge-default {
  @apply bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300;
}

.portal-system-badge-external {
  @apply bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300;
}

.portal-system-picker-menu .portal-system-picker-search {
  @apply mx-2 mb-2 mt-1;
}

.portal-system-picker-menu .portal-system-picker-group + .portal-system-picker-group {
  @apply mt-1 border-t border-gray-100 pt-1 dark:border-white/10;
}
</style>
