<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from 'lucide-vue-next'
import { getComponentApi, listComponentApi } from '@/api/operation'
import EnvironmentSelect from '@/components/operation/EnvironmentSelect.vue'
import EnvironmentBadge from '@/components/operation/EnvironmentBadge.vue'
import HealthStatusBadge from '@/components/operation/HealthStatusBadge.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { Environment, OperationComponent } from '@/types/operation'

const PAGE_SIZE = 20
const PAGE_SIZES = [20, 50, 100] as const

const props = withDefaults(
  defineProps<{
    open: boolean
    modelValue: string[]
    entityName?: string
    disabled?: boolean
    saving?: boolean
  }>(),
  { disabled: false, saving: false },
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
const list = ref<OperationComponent[]>([])
const loading = ref(false)
const componentCache = ref<Map<string, OperationComponent>>(new Map())

const selectedSet = computed(() => new Set(draftIds.value.map(String)))

const offPageSelected = computed(() =>
  draftIds.value.filter((id) => !list.value.some((item) => String(item.id) === id)),
)

function formatComponentLabel(item: OperationComponent) {
  const ip = item.serverIp || '-'
  return `${item.componentName || ip} · ${ip}`
}

function isSelected(id: string | number | undefined) {
  return id != null && selectedSet.value.has(String(id))
}

function cacheComponent(item: OperationComponent) {
  if (item.id == null) return
  componentCache.value.set(String(item.id), item)
}

function toggleComponent(id: string | number | undefined, checked: boolean) {
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

function removeComponent(id: string) {
  if (props.disabled) return
  draftIds.value = draftIds.value.filter((cid) => cid !== id)
}

async function ensureCache(ids: string[]) {
  const missing = ids.filter((id) => !componentCache.value.has(id))
  if (!missing.length) return
  await Promise.all(
    missing.map(async (id) => {
      try {
        const result = await getComponentApi(id)
        if (result.code === API_SUCCESS_CODE && result.data) cacheComponent(result.data)
      } catch {
        /* ignore */
      }
    }),
  )
}

async function loadList() {
  loading.value = true
  try {
    const result = await listComponentApi({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      componentName: keyword.value.trim() || undefined,
      environment: environment.value === '' ? undefined : (environment.value as Environment),
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('operation.component.loadFailed'))
    }
    list.value = result.data.list ?? []
    total.value = result.data.total ?? 0
    for (const item of list.value) cacheComponent(item)
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.component.loadFailed'))
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
    ? t('operation.project.componentLinksTitleNamed', { name: props.entityName })
    : t('operation.project.componentLinksTitle'),
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
    environment.value = ''
    pageNum.value = 1
    void ensureCache(draftIds.value)
    void loadList()
  },
)
</script>

<template>
  <AppModal :open="open" :title="modalTitle" extra-wide @close="emit('close')">
    <div class="operation-server-links-modal">
      <section class="operation-server-links-modal__selected">
        <div class="operation-server-links-modal__selected-head">
          <h4 class="operation-server-links-modal__section-title">{{ t('operation.project.componentLinksSelected') }}</h4>
          <span v-if="draftIds.length" class="text-xs text-gray-400">
            {{ t('operation.project.componentLinksCount', { n: draftIds.length }) }}
          </span>
        </div>
        <div v-if="draftIds.length" class="operation-server-links-modal__chips">
          <div
            v-for="id in draftIds"
            :key="id"
            class="operation-alias-chip operation-alias-chip--compact"
          >
            <span class="max-w-[200px] truncate">
              {{ componentCache.get(id) ? formatComponentLabel(componentCache.get(id)!) : id }}
            </span>
            <EnvironmentBadge
              v-if="componentCache.get(id)"
              :environment="componentCache.get(id)!.environment"
              size="sm"
              class="ml-1 shrink-0"
            />
            <button
              v-if="!disabled"
              type="button"
              class="operation-server-multi-remove"
              :aria-label="t('operation.common.delete')"
              @click="removeComponent(id)"
            >
              ×
            </button>
          </div>
        </div>
        <p v-else class="text-sm text-gray-400">{{ t('operation.project.componentLinksEmpty') }}</p>
        <p class="mt-2 text-xs text-gray-400">{{ t('operation.project.componentLinksHint') }}</p>
      </section>

      <section class="operation-server-links-modal__browse">
        <div class="operation-server-links-modal__filters">
          <div class="operation-server-links-modal__search">
            <Search class="operation-server-links-modal__search-icon" />
            <input
              v-model="keyword"
              type="search"
              class="field-input operation-server-links-modal__search-input"
              :placeholder="t('operation.project.componentLinksSearch')"
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
            {{ t('operation.project.componentLinksOffPage', { n: offPageSelected.length }) }}
          </div>

          <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
            <table class="w-full min-w-[640px] text-left text-sm">
              <thead class="bg-gray-50 text-xs uppercase text-gray-400 dark:bg-white/5">
                <tr>
                  <th class="w-10 px-3 py-2" />
                  <th class="px-3 py-2">{{ t('operation.component.componentName') }}</th>
                  <th class="px-3 py-2">{{ t('operation.component.serverIp') }}</th>
                  <th class="px-3 py-2">{{ t('operation.health.status') }}</th>
                  <th class="px-3 py-2">{{ t('operation.common.environment') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!list.length">
                  <td colspan="5" class="px-3 py-8 text-center text-gray-400">
                    {{ keyword || environment !== '' ? t('operation.project.componentLinksSearchEmpty') : t('operation.common.empty') }}
                  </td>
                </tr>
                <tr
                  v-for="item in list"
                  v-else
                  :key="String(item.id)"
                  class="border-t border-gray-50 transition hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5"
                  :class="isSelected(item.id) && 'bg-brand-50/50 dark:bg-brand-500/5'"
                >
                  <td class="px-3 py-2.5">
                    <input
                      type="checkbox"
                      class="shrink-0"
                      :checked="isSelected(item.id)"
                      :disabled="disabled"
                      @change="toggleComponent(item.id, ($event.target as HTMLInputElement).checked)"
                    />
                  </td>
                  <td class="px-3 py-2.5 font-medium">{{ item.componentName || '-' }}</td>
                  <td class="px-3 py-2.5">{{ item.serverIp || '-' }}</td>
                  <td class="px-3 py-2.5">
                    <HealthStatusBadge :status="item.status" />
                  </td>
                  <td class="px-3 py-2.5">
                    <EnvironmentBadge :environment="item.environment" size="sm" />
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
        {{ saving ? t('operation.common.saving') : t('operation.project.componentLinksConfirm', { n: draftIds.length }) }}
      </button>
    </template>
  </AppModal>
</template>
