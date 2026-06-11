<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  SYSTEM_GROUP_ACCENT,
  groupSystemsByPortal,
  type SystemGroup,
} from '@/constants/systemGroup'
import type { SysSystem } from '@/types/system'
import { ChevronDown, ExternalLink, LayoutGrid } from 'lucide-vue-next'

const props = defineProps<{
  systems: SysSystem[]
  checkedIds: Set<string>
  readonly?: boolean
}>()

const emit = defineEmits<{
  toggle: [systemId: number | string, checked: boolean]
  'select-all': []
  'clear-all': []
  'toggle-group': [group: SystemGroup, checked: boolean]
}>()

const { t } = useI18n()
const collapsedGroups = ref(new Set<string>())

const groupedSystems = computed(() => groupSystemsByPortal(props.systems))
const checkedCount = computed(() => props.checkedIds.size)
const allSelected = computed(
  () => props.systems.length > 0 && props.systems.every((row) => props.checkedIds.has(String(row.id))),
)
const partialSelected = computed(
  () => !allSelected.value && props.systems.some((row) => props.checkedIds.has(String(row.id))),
)

function toggleCollapse(key: SystemGroup) {
  const next = new Set(collapsedGroups.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsedGroups.value = next
}

function isCollapsed(key: SystemGroup) {
  return collapsedGroups.value.has(key)
}

function groupCheckedCount(group: { items: SysSystem[] }) {
  return group.items.filter((row) => props.checkedIds.has(String(row.id))).length
}

function isGroupAllChecked(group: { items: SysSystem[] }) {
  return group.items.length > 0 && group.items.every((row) => props.checkedIds.has(String(row.id)))
}

function toggleBatchSelect() {
  if (allSelected.value || partialSelected.value) emit('clear-all')
  else emit('select-all')
}
</script>

<template>
  <div class="user-system-checklist">
    <div class="user-system-checklist-toolbar">
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('system.userAssign.userSystemsSelected', { count: checkedCount, total: systems.length }) }}
      </p>
      <div v-if="!readonly" class="flex flex-wrap gap-2">
        <label class="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            :checked="allSelected"
            :indeterminate="partialSelected"
            @change="toggleBatchSelect"
          />
          <span>{{ t('system.userAssign.selectAllSystems') }}</span>
        </label>
        <button
          v-if="checkedCount"
          type="button"
          class="text-xs text-gray-500 hover:text-brand-600 dark:hover:text-brand-300"
          @click="emit('clear-all')"
        >
          {{ t('system.userAssign.clearAllSystems') }}
        </button>
      </div>
    </div>

    <section v-for="group in groupedSystems" :key="group.key" class="user-system-checklist-group">
      <div class="user-system-checklist-head-row">
        <button type="button" class="user-system-checklist-head" @click="toggleCollapse(group.key)">
          <span class="user-system-checklist-accent" :class="`bg-gradient-to-b ${SYSTEM_GROUP_ACCENT[group.key]}`" />
          <span class="flex-1 text-left text-sm font-medium text-gray-900 dark:text-white">
            {{ t(`system.portal.group.${group.key}`) }}
          </span>
          <span class="text-xs tabular-nums text-gray-400">
            {{ groupCheckedCount(group) }}/{{ group.items.length }}
          </span>
          <ChevronDown class="h-4 w-4 text-gray-400 transition" :class="!isCollapsed(group.key) && 'rotate-180'" />
        </button>
        <div v-if="!readonly" class="user-system-checklist-group-actions">
          <button
            type="button"
            class="user-system-checklist-group-btn"
            @click="emit('toggle-group', group.key, !isGroupAllChecked(group))"
          >
            {{
              isGroupAllChecked(group)
                ? t('system.userAssign.clearGroupSystems')
                : t('system.userAssign.selectGroupSystems')
            }}
          </button>
        </div>
      </div>
      <div v-show="!isCollapsed(group.key)" class="user-system-checklist-grid">
        <label
          v-for="(system, index) in group.items"
          :key="String(system.id)"
          class="user-system-checklist-item"
          :class="checkedIds.has(String(system.id)) && 'user-system-checklist-item-checked'"
          :style="{ '--check-i': index }"
        >
          <input
            type="checkbox"
            class="shrink-0"
            :checked="checkedIds.has(String(system.id))"
            :disabled="readonly"
            @change="emit('toggle', system.id!, ($event.target as HTMLInputElement).checked)"
          />
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm"
            :class="`bg-gradient-to-br ${SYSTEM_GROUP_ACCENT[group.key]}`"
          >
            <LayoutGrid class="h-3.5 w-3.5 text-white" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1">
              <span class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ system.systemName }}</span>
              <ExternalLink
                v-if="system.ssoMode === 'EXTERNAL'"
                class="h-3 w-3 shrink-0 text-sky-500"
              />
            </div>
            <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ system.systemCode }}</p>
          </div>
        </label>
      </div>
    </section>
  </div>
</template>

<style scoped>
.user-system-checklist-toolbar {
  @apply mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5;
}

.user-system-checklist-group + .user-system-checklist-group {
  @apply mt-4 border-t border-gray-100 pt-4 dark:border-white/5;
}

.user-system-checklist-head-row {
  @apply mb-2 flex items-center gap-2;
}

.user-system-checklist-head {
  @apply flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-gray-50 dark:hover:bg-white/5;
}

.user-system-checklist-group-actions {
  @apply shrink-0;
}

.user-system-checklist-group-btn {
  @apply rounded-lg px-2 py-1 text-xs text-brand-600 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10;
}

.user-system-checklist-accent {
  @apply h-6 w-1 shrink-0 rounded-full;
}

.user-system-checklist-grid {
  @apply grid gap-2 sm:grid-cols-2 xl:grid-cols-3;
}

.user-system-checklist-item {
  @apply flex cursor-pointer items-center gap-2.5 rounded-xl border border-gray-100 bg-white p-2.5 transition hover:border-brand-200 dark:border-white/5 dark:bg-transparent dark:hover:border-brand-500/30;
  animation: checklist-in 0.35s ease backwards;
  animation-delay: calc(var(--check-i, 0) * 40ms);
}

.user-system-checklist-item-checked {
  @apply border-brand-200 bg-brand-50/50 dark:border-brand-500/30 dark:bg-brand-500/10;
}

@keyframes checklist-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
