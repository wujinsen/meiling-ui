<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppPagination from '@/components/ui/AppPagination.vue'
import type { UserVo } from '@/types/user'
import { Search, ShieldCheck } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    title: string
    total: number
    users: UserVo[]
    loading?: boolean
    selectedIds: Set<string>
    userName: string
    pageNum: number
    pageSize: number
    isSuperAdminUser: (user?: UserVo | null) => boolean
    emptyText: string
    batchSelecting?: boolean
  }>(),
  {
    batchSelecting: false,
  },
)

const emit = defineEmits<{
  'update:userName': [value: string]
  'update:pageNum': [value: number]
  'update:pageSize': [value: number]
  search: []
  toggle: [id: number | string]
  'select-all-page': []
  'deselect-page': []
  'clear-selection': []
  'select-all-filtered': []
}>()

const { t } = useI18n()
const draftKeyword = ref(props.userName)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const pageNumModel = computed({
  get: () => props.pageNum,
  set: (value: number) => emit('update:pageNum', value),
})

const pageSizeModel = computed({
  get: () => props.pageSize,
  set: (value: number) => {
    emit('update:pageSize', value)
    emit('search')
  },
})

const selectableUsers = computed(() => props.users.filter((user) => !props.isSuperAdminUser(user)))
const pageAllSelected = computed(
  () =>
    selectableUsers.value.length > 0 &&
    selectableUsers.value.every((user) => props.selectedIds.has(String(user.id))),
)
const pagePartialSelected = computed(
  () =>
    !pageAllSelected.value &&
    selectableUsers.value.some((user) => props.selectedIds.has(String(user.id))),
)
const selectedCount = computed(() => props.selectedIds.size)
const useCompactList = computed(() => props.users.length > 8)

watch(
  () => props.userName,
  (value) => {
    if (value !== draftKeyword.value) draftKeyword.value = value
  },
)

function userInitial(user: UserVo) {
  return (user.nickName || user.userName || 'U').charAt(0).toUpperCase()
}

function onKeywordInput(value: string) {
  draftKeyword.value = value
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    emit('update:userName', value.trim())
    emit('search')
  }, 320)
}

function submitSearch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  emit('update:userName', draftKeyword.value.trim())
  emit('search')
}

function togglePageSelect() {
  if (pageAllSelected.value) {
    emit('deselect-page')
    return
  }
  emit('select-all-page')
}
</script>

<template>
  <section class="assign-user-panel">
    <div class="assign-panel-head">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ title }}
        <span class="ml-1 font-normal tabular-nums text-gray-400">({{ total }})</span>
      </h3>
      <form class="flex flex-wrap items-end gap-2" @submit.prevent="submitSearch">
        <input
          :value="draftKeyword"
          type="search"
          class="field-input min-w-0 flex-1"
          :placeholder="t('system.role.userNamePlaceholder')"
          @input="onKeywordInput(($event.target as HTMLInputElement).value)"
        />
        <button type="submit" class="btn-ghost shrink-0 text-xs">
          <Search class="h-3.5 w-3.5" />
        </button>
      </form>
    </div>

    <div class="assign-user-toolbar">
      <label
        class="assign-user-toolbar-check"
        :class="!selectableUsers.length && 'cursor-not-allowed opacity-50'"
      >
        <input
          type="checkbox"
          :disabled="!selectableUsers.length"
          :checked="pageAllSelected"
          :indeterminate="pagePartialSelected"
          @change="togglePageSelect"
        />
        <span>{{ t('system.userAssign.selectAllPage') }}</span>
      </label>
      <span v-if="selectedCount" class="assign-user-toolbar-selected">
        {{ t('system.userAssign.selectedCount', { count: selectedCount }) }}
        <button type="button" class="assign-user-toolbar-clear" @click="emit('clear-selection')">
          {{ t('system.userAssign.clearSelection') }}
        </button>
      </span>
      <button
        v-if="total > users.length && total > 0"
        type="button"
        class="assign-user-toolbar-batch"
        :disabled="batchSelecting"
        @click="emit('select-all-filtered')"
      >
        {{ batchSelecting ? t('system.userAssign.batchSelectLoading') : t('system.userAssign.selectAllFiltered', { count: total }) }}
      </button>
    </div>

    <div v-if="loading" class="py-12 text-center text-sm text-gray-400">{{ t('system.user.loading') }}</div>
    <div v-else-if="!users.length" class="py-12 text-center text-sm text-gray-400">{{ emptyText }}</div>
    <ul v-else class="assign-user-list" :class="!useCompactList && 'assign-user-list-animated'">
      <li
        v-for="(user, index) in users"
        :key="String(user.id)"
        class="assign-user-item"
        :style="!useCompactList ? { '--assign-i': index } : undefined"
      >
        <label class="flex cursor-pointer items-center gap-2.5 py-0.5">
          <input
            type="checkbox"
            class="shrink-0"
            :disabled="isSuperAdminUser(user)"
            :checked="selectedIds.has(String(user.id))"
            @change="emit('toggle', user.id!)"
          />
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            :class="isSuperAdminUser(user) ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-brand-400 to-brand-600'"
          >
            {{ userInitial(user) }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ user.userName }}</span>
              <span
                v-if="isSuperAdminUser(user)"
                class="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
              >
                <ShieldCheck class="h-3 w-3" />
                {{ t('system.userAssign.superAdminBadge') }}
              </span>
            </div>
            <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ user.nickName || user.deptName || '—' }}</p>
          </div>
        </label>
      </li>
    </ul>

    <div v-if="total > pageSize" class="mt-2">
      <AppPagination v-model:page-num="pageNumModel" v-model:page-size="pageSizeModel" :total="total" />
    </div>
  </section>
</template>

<style scoped>
.assign-user-toolbar {
  @apply mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-gray-50 px-2.5 py-2 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300;
}

.assign-user-toolbar-check {
  @apply inline-flex cursor-pointer items-center gap-1.5;
}

.assign-user-toolbar-selected {
  @apply inline-flex items-center gap-1.5 text-brand-700 dark:text-brand-300;
}

.assign-user-toolbar-clear {
  @apply text-gray-500 underline-offset-2 hover:text-brand-600 hover:underline dark:text-gray-400 dark:hover:text-brand-300;
}

.assign-user-toolbar-batch {
  @apply text-brand-600 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-brand-300 dark:hover:text-brand-200;
}

.assign-user-toolbar-size {
  @apply inline-flex items-center gap-1.5;
}

.assign-user-list {
  @apply max-h-[min(480px,55vh)] space-y-0.5 overflow-y-auto rounded-lg border border-gray-100 p-1 dark:border-white/5;
}

.assign-user-list-animated .assign-user-item {
  animation: assign-user-in 0.35s ease backwards;
  animation-delay: calc(var(--assign-i, 0) * 35ms);
}

@keyframes assign-user-in {
  from {
    opacity: 0;
    transform: translateX(-6px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
