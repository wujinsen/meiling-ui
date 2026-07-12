<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from 'lucide-vue-next'
import { getServerApi, listServerApi } from '@/api/operation'
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

const props = withDefaults(
  defineProps<{
    open: boolean
    modelValue?: string | number | ''
    title?: string
    allLabel?: string
    defaultEnvironment?: Environment | number | ''
  }>(),
  { modelValue: '', defaultEnvironment: '' },
)

const emit = defineEmits<{
  pick: [id: string, server: OperationServer | null]
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
const pinnedServer = ref<OperationServer | null>(null)

const selectedId = computed(() => (props.modelValue == null || props.modelValue === '' ? '' : String(props.modelValue)))

const showPinned = computed(
  () => Boolean(pinnedServer.value) && !list.value.some((srv) => String(srv.id) === selectedId.value),
)

const modalTitle = computed(() => props.title ?? t('operation.serverPick.title'))

function pickServer(srv: OperationServer) {
  if (srv.id == null) return
  pinnedServer.value = srv
  emit('pick', String(srv.id), srv)
}

function pickAll() {
  pinnedServer.value = null
  emit('pick', '', null)
}

async function ensurePinned(id: string) {
  if (!id) {
    pinnedServer.value = null
    return
  }
  const matched = list.value.find((srv) => String(srv.id) === id)
  if (matched) {
    pinnedServer.value = matched
    return
  }
  try {
    const result = await getServerApi(id)
    if (result.code === API_SUCCESS_CODE && result.data) pinnedServer.value = result.data
  } catch {
    pinnedServer.value = null
  }
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
    if (selectedId.value) {
      const matched = list.value.find((srv) => String(srv.id) === selectedId.value)
      if (matched) pinnedServer.value = matched
    }
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
    environment.value = props.defaultEnvironment === '' || props.defaultEnvironment == null
      ? ''
      : Number(props.defaultEnvironment)
    pageNum.value = 1
    void ensurePinned(selectedId.value)
    void loadList()
  },
)
</script>

<template>
  <AppModal :open="open" :title="modalTitle" wide @close="emit('close')">
    <div class="operation-server-pick-modal">
      <button
        type="button"
        class="operation-server-pick-modal__all"
        :class="!selectedId && 'operation-server-pick-modal__all--active'"
        @click="pickAll"
      >
        {{ allLabel ?? t('operation.serverPick.all') }}
      </button>

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
        <button
          v-if="showPinned && pinnedServer"
          type="button"
          class="operation-server-pick-modal__item operation-server-pick-modal__item--active operation-server-pick-modal__item--pinned"
          @click="pickServer(pinnedServer)"
        >
          <div class="operation-server-pick-modal__item-top">
            <span class="operation-server-pick-modal__name">{{ pinnedServer.serverName }}</span>
            <EnvironmentBadge :environment="pinnedServer.environment" size="sm" />
          </div>
          <div class="operation-server-pick-modal__sub">{{ pinnedServer.innerIp || pinnedServer.ip || '-' }}</div>
          <span class="operation-server-pick-modal__pinned-tag">{{ t('operation.serverPick.current') }}</span>
        </button>

        <div v-if="list.length" class="operation-server-pick-modal__list">
          <button
            v-for="srv in list"
            :key="String(srv.id)"
            type="button"
            class="operation-server-pick-modal__item"
            :class="selectedId === String(srv.id) && 'operation-server-pick-modal__item--active'"
            @click="pickServer(srv)"
          >
            <div class="operation-server-pick-modal__item-top">
              <span class="operation-server-pick-modal__name">{{ srv.serverName }}</span>
              <EnvironmentBadge :environment="srv.environment" size="sm" />
            </div>
            <div class="operation-server-pick-modal__sub">{{ srv.innerIp || srv.ip || '-' }}</div>
          </button>
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
  </AppModal>
</template>
