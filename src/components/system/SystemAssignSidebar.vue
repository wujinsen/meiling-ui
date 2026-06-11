<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  SYSTEM_GROUP_ACCENT,
  SYSTEM_GROUP_ORDER,
  countSystemsByGroup,
  groupSystemsByPortal,
  normalizeSystemGroup,
  type SystemGroup,
} from '@/constants/systemGroup'
import type { SysSystem } from '@/types/system'
import { ChevronDown, LayoutGrid, Search } from 'lucide-vue-next'

const props = defineProps<{
  systems: SysSystem[]
  selectedId?: string
  loading?: boolean
  userCounts: Map<string, number>
  search: string
}>()

const emit = defineEmits<{
  select: [id: number | string]
  'update:search': [value: string]
  'filter-group': [group: SystemGroup | '']
}>()

const { t } = useI18n()
const collapsedGroups = ref(new Set<string>())
const activeGroupFilter = ref<SystemGroup | ''>('')

const filteredSystems = computed(() => {
  const keyword = props.search.trim().toLowerCase()
  return props.systems.filter((row) => {
    if (activeGroupFilter.value && normalizeSystemGroup(row.systemGroup) !== activeGroupFilter.value) {
      return false
    }
    if (!keyword) return true
    const haystack = `${row.systemName ?? ''} ${row.systemCode ?? ''}`.toLowerCase()
    return haystack.includes(keyword)
  })
})

const groupedSystems = computed(() => groupSystemsByPortal(filteredSystems.value))
const groupCounts = computed(() => countSystemsByGroup(props.systems))
const visibleGroupFilters = computed(() => SYSTEM_GROUP_ORDER.filter((key) => groupCounts.value[key] > 0))
const showGroupFilters = computed(() => props.systems.length > 6 || visibleGroupFilters.value.length > 1)

function ssoModeLabel(mode?: string) {
  if (mode === 'EXTERNAL') return t('system.manage.ssoModeExternal')
  if (mode === 'INTERNAL') return t('system.manage.ssoModeInternal')
  return mode || '-'
}

function statusLabel(status?: number) {
  return status === 1 ? t('system.manage.statusOn') : t('system.manage.statusOff')
}

function isSystemEnabled(status?: number) {
  return status === 1
}

function countUsers(id: number | string) {
  return props.userCounts.get(String(id))
}

function showUserCount(id: number | string) {
  return props.userCounts.has(String(id))
}

function toggleCollapse(key: SystemGroup) {
  const next = new Set(collapsedGroups.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsedGroups.value = next
}

function isCollapsed(key: SystemGroup) {
  return collapsedGroups.value.has(key)
}

function pickGroupFilter(group: SystemGroup | '') {
  activeGroupFilter.value = group
  emit('filter-group', group)
}
</script>

<template>
  <div class="assign-system-sidebar">
    <div class="assign-system-sidebar-search">
      <Search class="h-4 w-4 shrink-0 text-gray-400" />
      <input
        :value="search"
        type="search"
        class="field-input min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus:ring-0"
        :placeholder="t('system.userAssign.systemSearchPlaceholder')"
        @input="emit('update:search', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div v-if="showGroupFilters" class="assign-system-sidebar-chips">
      <button
        type="button"
        class="assign-system-sidebar-chip"
        :class="!activeGroupFilter && 'assign-system-sidebar-chip-active'"
        @click="pickGroupFilter('')"
      >
        {{ t('system.manage.systemGroupAll') }}
      </button>
      <button
        v-for="group in visibleGroupFilters"
        :key="group"
        type="button"
        class="assign-system-sidebar-chip"
        :class="activeGroupFilter === group && 'assign-system-sidebar-chip-active'"
        @click="pickGroupFilter(group)"
      >
        {{ t(`system.portal.group.${group}`) }}
        <span class="assign-system-sidebar-chip-count">{{ groupCounts[group] }}</span>
      </button>
    </div>

    <div v-if="loading" class="py-10 text-center text-sm text-gray-400">{{ t('system.manage.loading') }}</div>
    <div v-else-if="!groupedSystems.length" class="py-10 text-center text-sm text-gray-400">{{ t('system.manage.empty') }}</div>
    <div v-else class="assign-system-sidebar-groups">
      <section v-for="group in groupedSystems" :key="group.key" class="assign-system-sidebar-group">
        <button type="button" class="assign-system-sidebar-group-head" @click="toggleCollapse(group.key)">
          <span class="assign-system-sidebar-accent" :class="`bg-gradient-to-b ${SYSTEM_GROUP_ACCENT[group.key]}`" />
          <div class="min-w-0 flex-1 text-left">
            <div class="flex flex-wrap items-center gap-2">
              <span class="assign-system-sidebar-group-title">
                {{ t(`system.portal.group.${group.key}`) }}
              </span>
              <span class="assign-system-sidebar-group-count">{{ group.items.length }}</span>
            </div>
          </div>
          <ChevronDown class="h-4 w-4 shrink-0 text-gray-400 transition" :class="!isCollapsed(group.key) && 'rotate-180'" />
        </button>
        <ul v-show="!isCollapsed(group.key)" class="assign-system-sidebar-list">
          <li v-for="system in group.items" :key="String(system.id)">
            <button
              type="button"
              class="assign-system-sidebar-item"
              :class="selectedId === String(system.id) && 'assign-system-sidebar-item-active'"
              @click="emit('select', system.id!)"
            >
              <div
                class="assign-system-sidebar-icon"
                :class="`bg-gradient-to-br ${SYSTEM_GROUP_ACCENT[group.key]}`"
              >
                <LayoutGrid class="h-4 w-4 text-white" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ system.systemName }}</div>
                <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                  <span class="font-mono">{{ system.systemCode }}</span>
                  <span class="assign-system-sidebar-meta-dot" />
                  <span>{{ ssoModeLabel(system.ssoMode) }}</span>
                  <span class="assign-system-sidebar-meta-dot" />
                  <span
                    class="assign-system-sidebar-status"
                    :class="isSystemEnabled(system.status) ? 'assign-system-sidebar-status-on' : 'assign-system-sidebar-status-off'"
                  >
                    {{ statusLabel(system.status) }}
                  </span>
                </div>
              </div>
              <span
                v-if="showUserCount(system.id!)"
                class="assign-system-sidebar-user-count"
                :title="t('system.userAssign.authorizedUsers')"
              >
                {{ countUsers(system.id!) }}
              </span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.assign-system-sidebar-search {
  @apply mb-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-white/5;
}

.assign-system-sidebar-chips {
  @apply -mx-0.5 mb-3 flex gap-1.5 overflow-x-auto pb-1;
  scrollbar-width: thin;
}

.assign-system-sidebar-chip {
  @apply inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-600 transition hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15;
}

.assign-system-sidebar-chip-active {
  @apply bg-brand-100 font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-300;
}

.assign-system-sidebar-chip-count {
  @apply tabular-nums opacity-70;
}

.assign-system-sidebar-groups {
  @apply max-h-[520px] space-y-3 overflow-y-auto pr-0.5;
}

.assign-system-sidebar-group {
  @apply rounded-xl border border-gray-100 bg-gray-50/50 dark:border-white/5 dark:bg-white/[0.02];
}

.assign-system-sidebar-group-head {
  @apply flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-gray-100/80 dark:hover:bg-white/5;
}

.assign-system-sidebar-accent {
  @apply h-7 w-1 shrink-0 rounded-full;
}

.assign-system-sidebar-group-title {
  @apply text-sm font-semibold text-gray-900 dark:text-white;
}

.assign-system-sidebar-group-count {
  @apply inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-white px-2 py-0.5 text-xs tabular-nums text-gray-500 shadow-sm dark:bg-white/10 dark:text-gray-400;
}

.assign-system-sidebar-list {
  @apply space-y-1 px-2 pb-2;
}

.assign-system-sidebar-item {
  @apply flex w-full items-center gap-2.5 rounded-lg border border-transparent bg-white px-2.5 py-2.5 text-left transition hover:border-brand-100 hover:bg-brand-50/30 dark:bg-transparent dark:hover:border-brand-500/20 dark:hover:bg-white/5;
}

.assign-system-sidebar-item-active {
  @apply border-brand-200 bg-brand-50/70 shadow-sm dark:border-brand-500/30 dark:bg-brand-500/10;
}

.assign-system-sidebar-icon {
  @apply flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm;
}

.assign-system-sidebar-item-active .truncate {
  @apply text-brand-700 dark:text-brand-300;
}

.assign-system-sidebar-meta-dot {
  @apply h-1 w-1 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600;
}

.assign-system-sidebar-user-count {
  @apply shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-600 dark:bg-white/10 dark:text-gray-300;
}

.assign-system-sidebar-item-active .assign-system-sidebar-user-count {
  @apply bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300;
}

.assign-system-sidebar-status {
  @apply inline-flex rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none;
}

.assign-system-sidebar-status-on {
  @apply bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300;
}

.assign-system-sidebar-status-off {
  @apply bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400;
}
</style>
