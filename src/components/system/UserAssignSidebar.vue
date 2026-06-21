<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppPagination from '@/components/ui/AppPagination.vue'
import type { UserVo } from '@/types/user'
import { Search, ShieldCheck } from 'lucide-vue-next'

const props = defineProps<{
  users: UserVo[]
  total: number
  loading?: boolean
  selectedId?: string
  userName: string
  pageNum: number
  pageSize: number
  isSuperAdminUser: (user?: UserVo | null) => boolean
}>()

const emit = defineEmits<{
  select: [id: number | string]
  'update:userName': [value: string]
  'update:pageNum': [value: number]
  'update:pageSize': [value: number]
  search: []
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

const showPagination = computed(() => props.total > 0)
const listHint = computed(() =>
  props.total > props.pageSize ? t('system.userAssign.userListLargeHint', { total: props.total }) : '',
)

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
</script>

<template>
  <div class="user-assign-sidebar">
    <form class="user-assign-sidebar-search" @submit.prevent="submitSearch">
      <Search class="h-4 w-4 shrink-0 text-gray-400" />
      <input
        :value="draftKeyword"
        type="search"
        class="field-input min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus:ring-0"
        :placeholder="t('system.userAssign.userSearchPlaceholder')"
        @input="onKeywordInput(($event.target as HTMLInputElement).value)"
      />
    </form>

    <p v-if="listHint" class="user-assign-sidebar-hint">{{ listHint }}</p>

    <div v-if="loading" class="py-10 text-center text-sm text-gray-400">{{ t('system.user.loading') }}</div>
    <div v-else-if="!users.length" class="py-10 text-center text-sm text-gray-400">
      {{ userName ? t('system.userAssign.userSearchEmpty') : t('system.userAssign.userListEmpty') }}
    </div>
    <ul v-else class="user-assign-sidebar-list">
      <li v-for="user in users" :key="String(user.id)">
        <button
          type="button"
          class="user-assign-sidebar-item"
          :class="selectedId === String(user.id) && 'user-assign-sidebar-item-active'"
          @click="emit('select', user.id!)"
        >
          <div
            class="user-assign-sidebar-avatar"
            :class="
              isSuperAdminUser(user)
                ? 'from-amber-400 to-orange-500'
                : 'from-brand-400 to-brand-600'
            "
          >
            {{ userInitial(user) }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1">
              <span class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ user.userName }}</span>
              <ShieldCheck v-if="isSuperAdminUser(user)" class="h-3 w-3 shrink-0 text-amber-500" />
            </div>
            <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ user.nickName || user.deptName || '—' }}</p>
          </div>
        </button>
      </li>
    </ul>

    <div v-if="showPagination" class="mt-2">
      <AppPagination v-model:page-num="pageNumModel" v-model:page-size="pageSizeModel" :total="total" />
    </div>
  </div>
</template>

<style scoped>
.user-assign-sidebar-search {
  @apply mb-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-white/5;
}

.user-assign-sidebar-hint {
  @apply mb-2 text-xs text-gray-400 dark:text-gray-500;
}

.user-assign-sidebar-list {
  @apply space-y-0.5;
}

.user-assign-sidebar-item {
  @apply flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-gray-50 dark:hover:bg-white/5;
}

.user-assign-sidebar-item-active {
  @apply bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30;
}

.user-assign-sidebar-avatar {
  @apply flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white;
}
</style>
