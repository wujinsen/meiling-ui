<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from 'lucide-vue-next'
import { listServerApi } from '@/api/operation'
import EnvironmentSelect from '@/components/operation/EnvironmentSelect.vue'
import EnvironmentBadge from '@/components/operation/EnvironmentBadge.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { OperationServer } from '@/types/operation'

const model = defineModel<string>({ default: '' })

const emit = defineEmits<{
  select: [server: OperationServer]
}>()

const { t } = useI18n()

const DEPLOY_SERVER_PAGE_SIZE = 20
const DEPLOY_SERVER_PAGE_SIZES = [20, 50, 100] as const

const keyword = ref('')
const environment = ref<number | ''>('')
const pageNum = ref(1)
const pageSize = ref(DEPLOY_SERVER_PAGE_SIZE)
const total = ref(0)
const list = ref<OperationServer[]>([])
const loading = ref(false)
const pinnedServer = ref<OperationServer | null>(null)
const initialPickDone = ref(false)

const showPinned = computed(
  () =>
    Boolean(pinnedServer.value) &&
    !list.value.some((srv) => String(srv.id) === model.value),
)

function resolveSearchParams() {
  const q = keyword.value.trim()
  if (!q) return {}
  if (q.includes('.') || /^\d{1,3}(\.\d{1,3}){0,3}$/.test(q)) {
    return { ip: q }
  }
  return { serverName: q }
}

function pickServer(srv: OperationServer) {
  if (srv.id == null) return
  const id = String(srv.id)
  model.value = id
  pinnedServer.value = srv
  emit('select', srv)
}

async function loadList() {
  loading.value = true
  try {
    const result = await listServerApi({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      environment: environment.value === '' ? undefined : (environment.value as 1 | 2 | 3 | 4),
      ...resolveSearchParams(),
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('operation.server.loadFailed'))
    }
    list.value = result.data.list ?? []
    total.value = result.data.total ?? 0
    const matched = list.value.find((srv) => String(srv.id) === model.value)
    if (matched) pinnedServer.value = matched
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.server.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function pickInitialServer() {
  if (initialPickDone.value || model.value) {
    initialPickDone.value = true
    return
  }
  const fromPage = list.value.find((srv) => srv.environment === 4) ?? list.value[0]
  if (fromPage) {
    pickServer(fromPage)
    initialPickDone.value = true
    return
  }
  try {
    const result = await listServerApi({ pageNum: 1, pageSize: 1, environment: 4 })
    if (result.code === API_SUCCESS_CODE && result.data?.list?.[0]) {
      pickServer(result.data.list[0])
    }
  } catch {
    // ignore — empty list handled by parent
  } finally {
    initialPickDone.value = true
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
  void loadList()
})

onMounted(async () => {
  await loadList()
  await pickInitialServer()
})
</script>

<template>
  <aside class="deploy-server-picker">
    <div class="deploy-server-picker__head">
      <h2 class="deploy-server-picker__title">{{ t('operation.deployCenter.serverList') }}</h2>
      <p v-if="total > 0" class="deploy-server-picker__meta">
        {{ t('common.paginationTotal', { total }) }}
      </p>
    </div>

    <div class="deploy-server-picker__filters">
      <div class="deploy-server-picker__search">
        <Search class="deploy-server-picker__search-icon" />
        <input
          v-model="keyword"
          type="search"
          class="field-input deploy-server-picker__search-input"
          :placeholder="t('operation.deployCenter.serverSearchPlaceholder')"
        />
      </div>
      <div class="deploy-server-picker__env">
        <span class="deploy-server-picker__env-label">{{ t('operation.common.environment') }}</span>
        <EnvironmentSelect v-model="environment" include-all :block="false" />
      </div>
    </div>

    <div v-if="loading" class="deploy-server-picker__state">{{ t('operation.common.loading') }}</div>
    <template v-else>
      <button
        v-if="showPinned && pinnedServer"
        type="button"
        class="deploy-server-picker__item deploy-server-picker__item--active deploy-server-picker__item--pinned"
        @click="pickServer(pinnedServer)"
      >
        <div class="deploy-server-picker__item-top">
          <span class="deploy-server-picker__name">{{ pinnedServer.serverName }}</span>
          <EnvironmentBadge :environment="pinnedServer.environment" size="sm" />
        </div>
        <div class="deploy-server-picker__sub">
          {{ pinnedServer.innerIp || pinnedServer.ip || '-' }}
          <span v-if="pinnedServer.sshConfigured" class="deploy-server-picker__ssh">SSH</span>
        </div>
        <span class="deploy-server-picker__pinned-tag">{{ t('operation.deployCenter.serverCurrent') }}</span>
      </button>

      <div v-if="list.length" class="deploy-server-picker__list">
        <button
          v-for="srv in list"
          :key="String(srv.id)"
          type="button"
          class="deploy-server-picker__item"
          :class="model === String(srv.id) && 'deploy-server-picker__item--active'"
          @click="pickServer(srv)"
        >
          <div class="deploy-server-picker__item-top">
            <span class="deploy-server-picker__name">{{ srv.serverName }}</span>
            <EnvironmentBadge :environment="srv.environment" size="sm" />
          </div>
          <div class="deploy-server-picker__sub">
            {{ srv.innerIp || srv.ip || '-' }}
            <span v-if="srv.sshConfigured" class="deploy-server-picker__ssh">SSH</span>
          </div>
        </button>
      </div>
      <p v-else class="deploy-server-picker__state">{{ t('operation.common.empty') }}</p>

      <AppPagination
        v-if="total > 0"
        v-model:page-num="pageNum"
        v-model:page-size="pageSize"
        class="deploy-server-picker__pagination"
        :total="total"
        :page-size-options="DEPLOY_SERVER_PAGE_SIZES"
      />
    </template>
  </aside>
</template>
