<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from 'lucide-vue-next'
import { getServerApi, listServerApi } from '@/api/operation'
import EnvironmentSelect from '@/components/operation/EnvironmentSelect.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { Environment, OperationServer } from '@/types/operation'
import { environmentI18nKey } from '@/utils/operationEnv'
import { resolveServerSearchParams } from '@/utils/operationServerSearch'

const PAGE_SIZE = 20
const PAGE_SIZES = [20, 50, 100] as const

const props = withDefaults(
  defineProps<{
    open: boolean
    modelValue: string[]
    entityName?: string
    defaultEnvironment?: Environment | number | ''
    disabled?: boolean
    saving?: boolean
  }>(),
  { defaultEnvironment: '', disabled: false, saving: false },
)

const emit = defineEmits<{
  confirm: [ids: string[]]
  close: []
}>()

const { t } = useI18n()

const draftIds = ref<string[]>([])
const keyword = ref('')
const environment = ref<number | ''>('')
const pageNum = ref(1)
const pageSize = ref(PAGE_SIZE)
const total = ref(0)
const list = ref<OperationServer[]>([])
const loading = ref(false)
const serverCache = ref<Map<string, OperationServer>>(new Map())

const selectedSet = computed(() => new Set(draftIds.value.map(String)))

const offPageSelected = computed(() =>
  draftIds.value.filter((id) => !list.value.some((srv) => String(srv.id) === id)),
)

function envLabel(env?: number) {
  return t(environmentI18nKey(env))
}

function formatServerLabel(srv: OperationServer) {
  const ip = srv.innerIp || srv.ip || '-'
  return `${srv.serverName || ip} · ${ip}`
}

function isSelected(id: string | number | undefined) {
  return id != null && selectedSet.value.has(String(id))
}

function cacheServer(srv: OperationServer) {
  if (srv.id == null) return
  serverCache.value.set(String(srv.id), srv)
}

function toggleServer(id: string | number | undefined, checked: boolean) {
  if (id == null || props.disabled) return
  const key = String(id)
  const next = [...draftIds.value]
  if (checked) {
    if (!next.includes(key)) next.push(key)
  } else {
    const idx = next.indexOf(key)
    if (idx >= 0) next.splice(idx, 1)
  }
  draftIds.value = next
}

function removeServer(id: string) {
  if (props.disabled) return
  draftIds.value = draftIds.value.filter((sid) => sid !== id)
}

function setPrimary(id: string) {
  if (props.disabled) return
  const next = draftIds.value.filter((sid) => sid !== id)
  draftIds.value = [id, ...next]
}

async function ensureCache(ids: string[]) {
  const missing = ids.filter((id) => !serverCache.value.has(id))
  if (!missing.length) return
  await Promise.all(
    missing.map(async (id) => {
      try {
        const result = await getServerApi(id)
        if (result.code === API_SUCCESS_CODE && result.data) cacheServer(result.data)
      } catch {
        /* ignore */
      }
    }),
  )
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
    for (const srv of list.value) cacheServer(srv)
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.server.loadFailed'))
  } finally {
    loading.value = false
  }
}

function confirm() {
  if (props.disabled || props.saving) return
  emit('confirm', [...draftIds.value])
}

const modalTitle = computed(() =>
  props.entityName
    ? t('operation.serverMulti.modalTitleNamed', { name: props.entityName })
    : t('operation.serverMulti.modalTitle'),
)

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
    draftIds.value = props.modelValue.map(String)
    keyword.value = ''
    environment.value = props.defaultEnvironment === '' || props.defaultEnvironment == null
      ? ''
      : Number(props.defaultEnvironment)
    pageNum.value = 1
    void ensureCache(draftIds.value)
    void loadList()
  },
)
</script>

<template>
  <AppModal
    :open="open"
    :title="modalTitle"
    extra-wide
    @close="emit('close')"
  >
    <div class="operation-server-links-modal">
      <section class="operation-server-links-modal__selected">
        <div class="operation-server-links-modal__selected-head">
          <h4 class="operation-server-links-modal__section-title">{{ t('operation.serverMulti.selectedSection') }}</h4>
          <span v-if="draftIds.length" class="text-xs text-gray-400">
            {{ t('operation.serverMulti.selectedCount', { n: draftIds.length }) }}
          </span>
        </div>
        <div v-if="draftIds.length" class="operation-server-links-modal__chips">
          <div
            v-for="(id, index) in draftIds"
            :key="id"
            class="operation-alias-chip operation-alias-chip--compact"
            :class="index === 0 && 'operation-server-multi-primary'"
          >
            <span class="max-w-[220px] truncate">
              {{ serverCache.get(id) ? formatServerLabel(serverCache.get(id)!) : id }}
            </span>
            <span v-if="index === 0" class="ml-1 text-[10px] opacity-80">{{ t('operation.project.primaryServer') }}</span>
            <button
              v-else-if="!disabled"
              type="button"
              class="ml-1 text-[10px] text-brand-600 hover:underline dark:text-brand-400"
              @click="setPrimary(id)"
            >
              {{ t('operation.serverMulti.setPrimary') }}
            </button>
            <button
              v-if="!disabled"
              type="button"
              class="operation-server-multi-remove"
              :aria-label="t('operation.common.delete')"
              @click="removeServer(id)"
            >
              ×
            </button>
          </div>
        </div>
        <p v-else class="text-sm text-gray-400">{{ t('operation.serverMulti.empty') }}</p>
        <p class="mt-2 text-xs text-gray-400">{{ t('operation.project.multiServerHint') }}</p>
      </section>

      <section class="operation-server-links-modal__browse">
        <div class="operation-server-links-modal__filters">
          <div class="operation-server-links-modal__search">
            <Search class="operation-server-links-modal__search-icon" />
            <input
              v-model="keyword"
              type="search"
              class="field-input operation-server-links-modal__search-input"
              :placeholder="t('operation.serverMulti.searchPlaceholder')"
              :disabled="disabled"
            />
          </div>
          <div class="operation-server-links-modal__env">
            <span class="operation-server-links-modal__env-label">{{ t('operation.common.environment') }}</span>
            <EnvironmentSelect v-model="environment" include-all :block="false" />
          </div>
        </div>

        <div v-if="loading" class="operation-server-links-modal__state">{{ t('operation.common.loading') }}</div>
        <template v-else>
          <div
            v-if="offPageSelected.length"
            class="mb-2 rounded-lg border border-brand-100 bg-brand-50/40 px-3 py-2 text-xs text-gray-500 dark:border-brand-500/20 dark:bg-brand-500/5"
          >
            {{ t('operation.serverMulti.offPageSelected', { n: offPageSelected.length }) }}
          </div>

          <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
            <table class="w-full min-w-[640px] text-left text-sm">
              <thead class="bg-gray-50 text-xs uppercase text-gray-400 dark:bg-white/5">
                <tr>
                  <th class="w-10 px-3 py-2" />
                  <th class="px-3 py-2">{{ t('operation.server.serverName') }}</th>
                  <th class="px-3 py-2">{{ t('operation.component.serverIp') }}</th>
                  <th class="px-3 py-2">{{ t('operation.common.environment') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!list.length">
                  <td colspan="4" class="px-3 py-8 text-center text-gray-400">
                    {{ keyword ? t('operation.serverMulti.searchEmpty') : t('operation.common.empty') }}
                  </td>
                </tr>
                <tr
                  v-for="srv in list"
                  v-else
                  :key="String(srv.id)"
                  class="border-t border-gray-50 transition hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5"
                  :class="isSelected(srv.id) && 'bg-brand-50/50 dark:bg-brand-500/5'"
                >
                  <td class="px-3 py-2.5">
                    <input
                      type="checkbox"
                      class="shrink-0"
                      :checked="isSelected(srv.id)"
                      :disabled="disabled"
                      @change="toggleServer(srv.id, ($event.target as HTMLInputElement).checked)"
                    />
                  </td>
                  <td class="px-3 py-2.5 font-medium">{{ srv.serverName || '-' }}</td>
                  <td class="px-3 py-2.5">{{ srv.innerIp || srv.ip || '-' }}</td>
                  <td class="px-3 py-2.5">
                    <span class="badge bg-gray-100 text-xs dark:bg-white/10">{{ envLabel(srv.environment) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <AppPagination
            v-if="total > 0"
            v-model:page-num="pageNum"
            v-model:page-size="pageSize"
            class="operation-server-links-modal__pagination"
            :total="total"
            :page-size-options="PAGE_SIZES"
          />
        </template>
      </section>
    </div>

    <template #footer>
      <button type="button" class="btn-ghost" @click="emit('close')">{{ t('operation.common.cancel') }}</button>
      <button type="button" class="btn-primary" :disabled="disabled || saving" @click="confirm">
        {{ saving ? t('operation.common.saving') : t('operation.serverMulti.confirm', { n: draftIds.length }) }}
      </button>
    </template>
  </AppModal>
</template>
