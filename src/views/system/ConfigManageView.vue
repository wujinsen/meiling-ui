<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { listConfigApi, resetConfigApi, updateConfigApi } from '@/api/config'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import { confirm } from '@/composables/useConfirm'
import { guardAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { PERM } from '@/constants/permissions'
import { API_SUCCESS_CODE } from '@/types/api'
import type { ConfigGroupCode, ConfigItem, ConfigSource } from '@/types/config'
import { RefreshCw } from 'lucide-vue-next'

const { t } = useI18n()

const loading = ref(false)
const savingKey = ref<string | null>(null)
const resettingKey = ref<string | null>(null)
const items = ref<ConfigItem[]>([])
const draftValues = reactive<Record<string, string>>({})

const groupFilter = ref<'ALL' | ConfigGroupCode>('ALL')

const GROUP_OPTIONS: Array<'ALL' | ConfigGroupCode> = ['ALL', 'SECURITY', 'PORTAL', 'OPS']

const filteredItems = computed(() => {
  if (groupFilter.value === 'ALL') return items.value
  return items.value.filter((item) => item.groupCode === groupFilter.value)
})

const groupedItems = computed(() => {
  const map = new Map<string, ConfigItem[]>()
  for (const item of filteredItems.value) {
    const key = item.groupName || item.groupCode || t('system.config.ungrouped')
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }
  return [...map.entries()]
})

function sourceLabel(source?: ConfigSource) {
  if (source === 'DB_OVERRIDE') return t('system.config.sourceOverride')
  if (source === 'ENVIRONMENT') return t('system.config.sourceEnvironment')
  return t('system.config.sourceDefault')
}

function sourceBadgeClass(source?: ConfigSource) {
  if (source === 'DB_OVERRIDE') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
  }
  if (source === 'ENVIRONMENT') {
    return 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300'
  }
  return 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400'
}

function groupLabel(group: 'ALL' | ConfigGroupCode) {
  if (group === 'ALL') return t('system.config.groupAll')
  return t(`system.config.group.${group}`)
}

function syncDraftValues(list: ConfigItem[]) {
  for (const key of Object.keys(draftValues)) {
    if (!list.some((item) => item.configKey === key)) delete draftValues[key]
  }
  for (const item of list) {
    if (item.configKey) draftValues[item.configKey] = item.effectiveValue ?? ''
  }
}

function isDirty(item: ConfigItem) {
  const key = item.configKey
  if (!key) return false
  return (draftValues[key] ?? '') !== (item.effectiveValue ?? '')
}

function boolValue(item: ConfigItem) {
  const raw = draftValues[item.configKey] ?? item.effectiveValue ?? 'false'
  return raw === 'true'
}

async function loadItems() {
  loading.value = true
  try {
    const result = await listConfigApi()
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.config.loadFailed'))
    }
    items.value = result.data
    syncDraftValues(result.data)
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.config.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function saveItem(item: ConfigItem) {
  if (!guardAction(PERM.CONFIG_EDIT)) return false
  const key = item.configKey
  if (!key) return false

  savingKey.value = key
  try {
    const result = await updateConfigApi({
      configKey: key,
      configValue: draftValues[key] ?? '',
    })
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.config.saveFailed'))
    }
    showToast('success', t('system.config.saveOk'))
    await loadItems()
    return true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.config.saveFailed'))
    return false
  } finally {
    savingKey.value = null
  }
}

async function resetItem(item: ConfigItem) {
  if (!guardAction(PERM.CONFIG_REMOVE)) return
  const key = item.configKey
  if (!key) return
  if (!(await confirm({ message: t('system.config.resetConfirm', { name: key }), title: t('system.config.resetTitle'), confirmText: t('system.config.resetOkBtn'), danger: false }))) return

  resettingKey.value = key
  try {
    const result = await resetConfigApi(key)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.config.resetFailed'))
    }
    showToast('success', t('system.config.resetOk'))
    await loadItems()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.config.resetFailed'))
  } finally {
    resettingKey.value = null
  }
}

async function onBooleanChange(item: ConfigItem, next: boolean) {
  if (!guardAction(PERM.CONFIG_EDIT)) return
  const key = item.configKey
  const prev = draftValues[key] ?? item.effectiveValue ?? 'false'
  draftValues[key] = next ? 'true' : 'false'
  const ok = await saveItem(item)
  if (!ok) draftValues[key] = prev
}

watch(groupFilter, () => {
  /* client-side filter only */
})

onMounted(loadItems)
</script>

<template>
  <div class="page-stack">
    <div class="card p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="group in GROUP_OPTIONS"
            :key="group"
            type="button"
            :class="[
              'rounded-full border px-3 py-1.5 text-sm transition',
              groupFilter === group
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-300'
                : 'border-gray-200 text-gray-600 hover:border-brand-300 dark:border-white/10 dark:text-gray-300 dark:hover:border-brand-500/40',
            ]"
            @click="groupFilter = group"
          >
            {{ groupLabel(group) }}
          </button>
        </div>
        <button type="button" class="btn-ghost shrink-0" @click="loadItems">
          <RefreshCw class="h-4 w-4" /> {{ t('system.config.refresh') }}
        </button>
      </div>

      <div v-if="loading" class="py-16 text-center text-gray-400">{{ t('system.config.loading') }}</div>
      <div v-else-if="!filteredItems.length" class="py-16 text-center text-gray-400">{{ t('system.config.empty') }}</div>
      <div v-else class="space-y-6">
        <section v-for="[groupName, groupItems] in groupedItems" :key="groupName">
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {{ groupName }}
          </h2>
          <div class="overflow-hidden rounded-lg border border-gray-100 dark:border-white/5">
            <div
              v-for="item in groupItems"
              :key="item.configKey"
              class="border-t border-gray-50 px-4 py-4 first:border-t-0 dark:border-white/5"
            >
              <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="font-medium text-gray-900 dark:text-white">{{ item.description || item.configKey }}</p>
                    <span :class="['badge', sourceBadgeClass(item.source)]">{{ sourceLabel(item.source) }}</span>
                  </div>
                  <p class="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">{{ item.configKey }}</p>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {{ t('system.config.defaultValue') }}: {{ item.defaultValue ?? '-' }}
                  </p>
                </div>

                <div class="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[16rem]">
                  <AppSwitch
                    v-if="item.valueType === 'BOOLEAN'"
                    :model-value="boolValue(item)"
                    :disabled="savingKey === item.configKey"
                    :label="item.description || item.configKey"
                    confirm-before-change
                    @change="(next) => onBooleanChange(item, next)"
                  />
                  <input
                    v-else-if="item.valueType === 'INT'"
                    v-model="draftValues[item.configKey]"
                    type="number"
                    class="field-input"
                    :disabled="savingKey === item.configKey"
                  />
                  <input
                    v-else
                    v-model="draftValues[item.configKey]"
                    type="text"
                    class="field-input"
                    :disabled="savingKey === item.configKey"
                  />

                  <div v-if="item.valueType !== 'BOOLEAN'" class="flex flex-wrap gap-2">
                    <button
                      type="button"
                      class="btn-primary"
                      :disabled="!isDirty(item) || savingKey === item.configKey"
                      @click="saveItem(item)"
                    >
                      {{ savingKey === item.configKey ? t('system.config.saving') : t('system.config.save') }}
                    </button>
                    <button
                      v-if="item.overridden"
                      type="button"
                      class="btn-ghost"
                      :disabled="resettingKey === item.configKey"
                      @click="resetItem(item)"
                    >
                      {{ resettingKey === item.configKey ? t('system.config.resetting') : t('system.config.reset') }}
                    </button>
                  </div>
                  <button
                    v-else-if="item.overridden"
                    type="button"
                    class="btn-ghost self-start"
                    :disabled="resettingKey === item.configKey"
                    @click="resetItem(item)"
                  >
                    {{ resettingKey === item.configKey ? t('system.config.resetting') : t('system.config.reset') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
