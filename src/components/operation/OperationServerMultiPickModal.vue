<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from 'lucide-vue-next'
import { listServerApi } from '@/api/operation'
import EnvironmentSelect from '@/components/operation/EnvironmentSelect.vue'
import EnvironmentBadge from '@/components/operation/EnvironmentBadge.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { Environment, OperationServer } from '@/types/operation'
import { resolveServerSearchParams } from '@/utils/operationServerSearch'

const PAGE_SIZE = 20
const PAGE_SIZES = [20, 50, 100] as const

const props = defineProps<{
  open: boolean
  /** 已在目标清单中的服务器 id（列表中置灰不可重复选） */
  excludeIds?: string[]
  title?: string
}>()

const emit = defineEmits<{
  confirm: [servers: OperationServer[]]
  close: []
}>()

const { t } = useI18n()

const keyword = ref('')
const environment = ref<number | ''>('')
const pageNum = ref(1)
const pageSize = ref(PAGE_SIZE)
const total = ref(0)
const list = ref<OperationServer[]>([])
const loading = ref(false)
const picked = ref(new Map<string, OperationServer>())

const excludeSet = computed(() => new Set((props.excludeIds ?? []).map(String)))

const pickedCount = computed(() => picked.value.size)

const modalTitle = computed(() => props.title ?? t('operation.deployCenter.appendServersTitle'))

function isExcluded(srv: OperationServer) {
  return srv.id != null && excludeSet.value.has(String(srv.id))
}

function isPicked(srv: OperationServer) {
  return srv.id != null && picked.value.has(String(srv.id))
}

function togglePick(srv: OperationServer) {
  if (srv.id == null || isExcluded(srv)) return
  const id = String(srv.id)
  const next = new Map(picked.value)
  if (next.has(id)) next.delete(id)
  else next.set(id, srv)
  picked.value = next
}

function confirmPick() {
  emit('confirm', [...picked.value.values()])
}

async function loadList() {
  loading.value = true
  try {
    const result = await listServerApi({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      environment: environment.value === '' ? undefined : (environment.value as Environment),
      ...resolveServerSearchParams(keyword.value),
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('operation.server.loadFailed'))
    }
    list.value = result.data.list ?? []
    total.value = result.data.total ?? 0
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.server.loadFailed'))
  } finally {
    loading.value = false
  }
}

function onSearchInput() {
  if (pageNum.value !== 1) {
    pageNum.value = 1
    return
  }
  void loadList()
}

let searchTimer: ReturnType<typeof setTimeout> | undefined

watch(keyword, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(onSearchInput, 300)
})

watch(environment, () => {
  if (pageNum.value !== 1) pageNum.value = 1
  else void loadList()
})

watch([pageNum, pageSize], () => {
  if (props.open) void loadList()
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    keyword.value = ''
    environment.value = ''
    pageNum.value = 1
    picked.value = new Map()
    void loadList()
  },
)
</script>

<template>
  <AppModal :open="open" :title="modalTitle" wide @close="emit('close')">
    <div class="operation-server-pick-modal">
      <p class="operation-server-pick-modal__hint">{{ t('operation.deployCenter.appendServersHint') }}</p>

      <div class="operation-server-pick-modal__filters">
        <div class="operation-server-pick-modal__search">
          <Search class="operation-server-pick-modal__search-icon" />
          <input
            v-model="keyword"
            type="search"
            class="field-input operation-server-pick-modal__search-input"
            :placeholder="t('operation.serverMulti.searchPlaceholder')"
          />
        </div>
        <div class="operation-server-pick-modal__env">
          <span class="operation-server-pick-modal__env-label">{{ t('operation.common.environment') }}</span>
          <EnvironmentSelect v-model="environment" include-all :block="false" />
        </div>
      </div>

      <div v-if="loading" class="operation-server-pick-modal__state">{{ t('operation.common.loading') }}</div>
      <template v-else>
        <div v-if="list.length" class="operation-server-pick-modal__list">
          <label
            v-for="srv in list"
            :key="String(srv.id)"
            class="operation-server-pick-modal__item operation-server-pick-modal__item--check"
            :class="[
              isPicked(srv) && 'operation-server-pick-modal__item--active',
              isExcluded(srv) && 'operation-server-pick-modal__item--disabled',
            ]"
          >
            <input
              type="checkbox"
              class="h-4 w-4 shrink-0 accent-brand-600"
              :checked="isPicked(srv)"
              :disabled="isExcluded(srv)"
              @change="togglePick(srv)"
            />
            <span class="min-w-0 flex-1">
              <span class="operation-server-pick-modal__item-top">
                <span class="operation-server-pick-modal__name">{{ srv.serverName }}</span>
                <EnvironmentBadge :environment="srv.environment" size="sm" />
              </span>
              <span class="operation-server-pick-modal__sub">{{ srv.innerIp || srv.ip || '-' }}</span>
            </span>
            <span v-if="isExcluded(srv)" class="text-xs text-gray-400">{{ t('operation.deployCenter.appendAlready') }}</span>
          </label>
        </div>
        <p v-else class="operation-server-pick-modal__state">{{ keyword ? t('operation.serverMulti.searchEmpty') : t('operation.common.empty') }}</p>

        <AppPagination
          v-if="total > 0"
          v-model:page-num="pageNum"
          v-model:page-size="pageSize"
          class="operation-server-pick-modal__pagination"
          :total="total"
          :page-size-options="PAGE_SIZES"
        />
      </template>
    </div>
    <template #footer>
      <span class="text-sm text-gray-500">{{ t('operation.deployCenter.appendPickedCount', { count: pickedCount }) }}</span>
      <button type="button" class="btn-ghost" @click="emit('close')">{{ t('operation.common.cancel') }}</button>
      <button type="button" class="btn-primary" :disabled="!pickedCount" @click="confirmPick">
        {{ t('operation.deployCenter.appendConfirm') }}
      </button>
    </template>
  </AppModal>
</template>
