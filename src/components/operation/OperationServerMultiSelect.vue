<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getServerApi, listServerApi } from '@/api/operation'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { Environment, OperationServer } from '@/types/operation'

const model = defineModel<string[]>({ default: () => [] })

const props = withDefaults(
  defineProps<{
    environment?: Environment | number | ''
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  primaryChange: [server: OperationServer | null]
}>()

const { t } = useI18n()

const loading = ref(false)
const search = ref('')
const servers = ref<OperationServer[]>([])

const serverById = computed(() => {
  const map = new Map<string, OperationServer>()
  for (const srv of servers.value) {
    if (srv.id != null) map.set(String(srv.id), srv)
  }
  return map
})

const filteredServers = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return servers.value
  return servers.value.filter((srv) => {
    const ip = srv.innerIp || srv.ip || ''
    const name = srv.serverName || ''
    return name.toLowerCase().includes(q) || ip.toLowerCase().includes(q)
  })
})

const selectedSet = computed(() => new Set(model.value.map(String)))

function formatServerLabel(srv: OperationServer) {
  const ip = srv.innerIp || srv.ip || '-'
  return `${srv.serverName || ip} · ${ip}`
}

function isSelected(id: string | number | undefined) {
  return id != null && selectedSet.value.has(String(id))
}

function toggleServer(id: string | number | undefined, checked: boolean) {
  if (id == null) return
  const key = String(id)
  const next = [...model.value.map(String)]
  if (checked) {
    if (!next.includes(key)) next.push(key)
  } else {
    const idx = next.indexOf(key)
    if (idx >= 0) next.splice(idx, 1)
  }
  model.value = next
  emitPrimary()
}

function removeServer(id: string) {
  model.value = model.value.filter((sid) => String(sid) !== id)
  emitPrimary()
}

function emitPrimary() {
  const primaryId = model.value[0]
  if (primaryId == null || primaryId === '') {
    emit('primaryChange', null)
    return
  }
  emit('primaryChange', serverById.value.get(String(primaryId)) ?? null)
}

async function ensureSelectedInList(ids: string[]) {
  const missing = ids.filter((id) => !serverById.value.has(id))
  if (!missing.length) return
  const extras: OperationServer[] = []
  await Promise.all(
    missing.map(async (id) => {
      try {
        const result = await getServerApi(id)
        if (result.code === API_SUCCESS_CODE && result.data) extras.push(result.data)
      } catch {
        /* ignore */
      }
    }),
  )
  if (extras.length) {
    const existing = new Set(servers.value.map((s) => String(s.id)))
    servers.value = [...extras.filter((s) => !existing.has(String(s.id))), ...servers.value]
  }
}

async function loadServers() {
  loading.value = true
  try {
    const result = await listServerApi({
      pageNum: 1,
      pageSize: 500,
      environment: props.environment === '' || props.environment == null
        ? undefined
        : (props.environment as Environment),
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('operation.server.loadFailed'))
    }
    servers.value = result.data.list ?? []
    if (model.value.length) await ensureSelectedInList(model.value.map(String))
    emitPrimary()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.server.loadFailed'))
  } finally {
    loading.value = false
  }
}

watch(
  () => props.environment,
  () => {
    void loadServers()
  },
)

watch(model, () => emitPrimary(), { deep: true })

onMounted(loadServers)
</script>

<template>
  <div class="operation-server-multi" :class="disabled && 'pointer-events-none opacity-60'">
    <div v-if="model.length" class="mb-2 flex flex-wrap gap-1.5">
      <span
        v-for="(id, index) in model"
        :key="String(id)"
        class="operation-alias-chip operation-alias-chip--compact"
        :class="index === 0 && 'operation-server-multi-primary'"
      >
        <span class="max-w-[200px] truncate">{{ serverById.get(String(id)) ? formatServerLabel(serverById.get(String(id))!) : id }}</span>
        <span v-if="index === 0" class="ml-1 text-[10px] opacity-80">{{ t('operation.project.primaryServer') }}</span>
        <button
          v-if="!disabled"
          type="button"
          class="operation-server-multi-remove"
          :aria-label="t('operation.common.delete')"
          @click="removeServer(String(id))"
        >
          ×
        </button>
      </span>
    </div>
    <input
      v-model="search"
      type="search"
      class="field-input mb-2 text-sm"
      :placeholder="t('operation.serverMulti.searchPlaceholder')"
      :disabled="disabled || loading"
    />
    <div
      v-if="loading"
      class="rounded-lg border border-gray-100 px-3 py-6 text-center text-sm text-gray-400 dark:border-white/10"
    >
      {{ t('operation.common.loading') }}
    </div>
    <div
      v-else-if="!filteredServers.length"
      class="rounded-lg border border-gray-100 px-3 py-4 text-sm text-gray-400 dark:border-white/10"
    >
      {{ search ? t('operation.serverMulti.searchEmpty') : t('operation.common.empty') }}
    </div>
    <div v-else class="operation-server-multi-list">
      <label
        v-for="srv in filteredServers"
        :key="String(srv.id)"
        class="operation-server-multi-item"
        :class="isSelected(srv.id) && 'operation-server-multi-item--selected'"
      >
        <input
          type="checkbox"
          class="shrink-0"
          :checked="isSelected(srv.id)"
          :disabled="disabled"
          @change="toggleServer(srv.id, ($event.target as HTMLInputElement).checked)"
        />
        <span class="min-w-0 flex-1 truncate">{{ formatServerLabel(srv) }}</span>
      </label>
    </div>
    <p class="mt-1.5 text-xs text-gray-400">{{ t('operation.project.multiServerHint') }}</p>
  </div>
</template>
