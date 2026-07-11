<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getServerApi, listServerApi } from '@/api/operation'
import AppSelect from '@/components/ui/AppSelect.vue'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { Environment, OperationServer } from '@/types/operation'

const model = defineModel<string | number | '' | undefined>()

const props = withDefaults(
  defineProps<{
    /** 与表单环境联动筛选服务器 */
    environment?: Environment | number | ''
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  select: [server: OperationServer | null]
}>()

const { t } = useI18n()

const loading = ref(false)
const servers = ref<OperationServer[]>([])

const serverById = computed(() => {
  const map = new Map<string, OperationServer>()
  for (const srv of servers.value) {
    if (srv.id != null) map.set(String(srv.id), srv)
  }
  return map
})

const options = computed(() => {
  const list = servers.value.map((srv) => ({
    value: String(srv.id),
    label: formatServerLabel(srv),
  }))
  return [{ value: '', label: t('operation.common.linkServerNone') }, ...list]
})

function formatServerLabel(srv: OperationServer) {
  const ip = srv.innerIp || srv.ip || '-'
  return `${srv.serverName || ip} · ${ip}`
}

function emitSelection(id: string | number | '' | undefined) {
  if (id == null || id === '') {
    emit('select', null)
    return
  }
  emit('select', serverById.value.get(String(id)) ?? null)
}

async function ensureSelectedInList(id: string | number) {
  const key = String(id)
  if (serverById.value.has(key)) return
  try {
    const result = await getServerApi(id)
    if (result.code === API_SUCCESS_CODE && result.data) {
      servers.value = [result.data, ...servers.value.filter((s) => String(s.id) !== key)]
    }
  } catch {
    // ignore — dropdown may show empty until user re-picks
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
    if (model.value != null && model.value !== '') {
      await ensureSelectedInList(model.value)
    }
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

watch(model, (id) => {
  emitSelection(id)
})

onMounted(async () => {
  await loadServers()
  if (model.value != null && model.value !== '') {
    await ensureSelectedInList(model.value)
    emitSelection(model.value)
  }
})
</script>

<template>
  <AppSelect
    v-model="model"
    :options="options"
    :disabled="disabled || loading"
    :placeholder="t('operation.common.linkServerPick')"
  />
</template>
