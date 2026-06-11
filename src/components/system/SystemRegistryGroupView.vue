<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  SYSTEM_GROUP_ACCENT,
  groupSystemsByPortal,
  registryGroupDomId,
  type SystemGroup,
} from '@/constants/systemGroup'
import type { SysSystem } from '@/types/system'
import { ChevronDown, ExternalLink, LayoutGrid, Pencil, Trash2, Users } from 'lucide-vue-next'

const props = defineProps<{
  systems: SysSystem[]
  loading?: boolean
  canManage?: boolean
  selectedIds: Set<string>
  collapsedGroups: Set<string>
  filterGroup?: string
}>()

const emit = defineEmits<{
  'toggle-select': [id: number | string]
  members: [row: SysSystem]
  edit: [row: SysSystem]
  delete: [row: SysSystem]
  'toggle-collapse': [key: SystemGroup]
}>()

const { t } = useI18n()

const groupedSystems = computed(() => {
  const groups = groupSystemsByPortal(props.systems)
  if (!props.filterGroup) return groups
  return groups.filter((group) => group.key === props.filterGroup)
})

function systemGroupLabel(group?: string) {
  if (!group) return t('system.manage.systemGroupBusiness')
  const key = `system.portal.group.${group}`
  const label = t(key)
  return label === key ? group : label
}

function statusLabel(status?: number) {
  return status === 1 ? t('system.manage.statusOn') : t('system.manage.statusOff')
}

function ssoModeLabel(mode?: string) {
  if (mode === 'EXTERNAL') return t('system.manage.ssoModeExternal')
  if (mode === 'INTERNAL') return t('system.manage.ssoModeInternal')
  return mode || '-'
}

function isCollapsed(key: SystemGroup) {
  return props.collapsedGroups.has(key)
}
</script>

<template>
  <div v-if="loading" class="py-16 text-center text-sm text-gray-400">{{ t('system.manage.loading') }}</div>
  <div v-else-if="!systems.length" class="py-16 text-center text-sm text-gray-400">{{ t('system.manage.empty') }}</div>
  <div v-else class="space-y-6">
    <section
      v-for="group in groupedSystems"
      :id="registryGroupDomId(group.key)"
      :key="group.key"
      class="registry-group scroll-mt-24"
    >
      <button
        type="button"
        class="registry-group-head"
        @click="emit('toggle-collapse', group.key)"
      >
        <div
          class="registry-group-accent"
          :class="`bg-gradient-to-b ${SYSTEM_GROUP_ACCENT[group.key]}`"
        />
        <div class="min-w-0 flex-1 text-left">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ systemGroupLabel(group.key) }}
            </h3>
            <span class="registry-group-count">{{ t('system.manage.groupSystemCount', { count: group.items.length }) }}</span>
          </div>
        </div>
        <ChevronDown
          class="h-4 w-4 shrink-0 text-gray-400 transition"
          :class="!isCollapsed(group.key) && 'rotate-180'"
        />
      </button>

      <div v-show="!isCollapsed(group.key)" class="registry-group-body">
        <article
          v-for="(row, index) in group.items"
          :key="String(row.id)"
          class="registry-card"
          :style="{ '--registry-i': index }"
        >
          <div class="registry-card-top">
            <input
              v-if="canManage"
              type="checkbox"
              class="registry-card-check"
              :checked="selectedIds.has(String(row.id))"
              @change="emit('toggle-select', row.id!)"
            />
            <div
              class="registry-card-icon"
              :class="`bg-gradient-to-br ${SYSTEM_GROUP_ACCENT[group.key]}`"
            >
              <LayoutGrid class="h-4 w-4 text-white" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <h4 class="truncate text-sm font-semibold text-gray-900 dark:text-white">{{ row.systemName }}</h4>
                <span
                  v-if="row.ssoMode === 'EXTERNAL'"
                  class="registry-tag registry-tag-external"
                  :title="t('system.portal.externalBadge')"
                >
                  <ExternalLink class="h-3 w-3" />
                </span>
              </div>
              <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ row.systemCode }}</p>
            </div>
            <span
              :class="[
                'registry-tag',
                row.status === 1 ? 'registry-tag-on' : 'registry-tag-off',
              ]"
            >
              {{ statusLabel(row.status) }}
            </span>
          </div>

          <dl class="registry-card-meta">
            <div>
              <dt>{{ t('system.manage.ssoMode') }}</dt>
              <dd>{{ ssoModeLabel(row.ssoMode) }}</dd>
            </div>
            <div>
              <dt>{{ t('system.manage.sort') }}</dt>
              <dd>{{ row.sort ?? '—' }}</dd>
            </div>
            <div class="registry-card-meta-wide">
              <dt>{{ t('system.manage.baseUrl') }}</dt>
              <dd class="truncate" :title="row.baseUrl">{{ row.baseUrl || '—' }}</dd>
            </div>
          </dl>

          <div class="registry-card-actions">
            <button type="button" class="btn-action-add" @click="emit('members', row)">
              <Users class="h-3.5 w-3.5" />
              {{ t('system.manage.members') }}
            </button>
            <button v-if="canManage" type="button" class="btn-action-edit" @click="emit('edit', row)">
              <Pencil class="h-3.5 w-3.5" />
              {{ t('system.manage.edit') }}
            </button>
            <button v-if="canManage" type="button" class="btn-action-danger" @click="emit('delete', row)">
              <Trash2 class="h-3.5 w-3.5" />
              {{ t('system.manage.delete') }}
            </button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.registry-group-head {
  @apply mb-3 flex w-full items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5 transition hover:bg-gray-100/80 dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10;
}

.registry-group-accent {
  @apply h-8 w-1 shrink-0 rounded-full;
}

.registry-group-count {
  @apply rounded-full bg-white px-2 py-0.5 text-[10px] tabular-nums text-gray-500 shadow-sm dark:bg-white/10 dark:text-gray-400;
}

.registry-group-body {
  @apply grid gap-3 sm:grid-cols-2 xl:grid-cols-3;
}

.registry-card {
  @apply flex flex-col rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition hover:border-brand-200 hover:shadow-md dark:border-white/5 dark:bg-surface-dark-card dark:hover:border-brand-500/30;
  animation: registry-card-in 0.4s ease backwards;
  animation-delay: calc(var(--registry-i, 0) * 45ms);
}

.registry-card-top {
  @apply mb-3 flex items-start gap-2;
}

.registry-card-check {
  @apply mt-2 shrink-0;
}

.registry-card-icon {
  @apply flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm;
}

.registry-tag {
  @apply inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium;
}

.registry-tag-on {
  @apply bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300;
}

.registry-tag-off {
  @apply bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400;
}

.registry-tag-external {
  @apply bg-sky-100 p-1 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300;
}

.registry-card-meta {
  @apply mb-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-gray-50/80 px-2.5 py-2 text-[11px] dark:bg-white/5;
}

.registry-card-meta dt {
  @apply text-gray-400;
}

.registry-card-meta dd {
  @apply truncate font-medium text-gray-700 dark:text-gray-200;
}

.registry-card-meta-wide {
  @apply col-span-2;
}

.registry-card-actions {
  @apply mt-auto flex flex-wrap gap-1 border-t border-gray-100 pt-2 dark:border-white/5;
}

@keyframes registry-card-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
