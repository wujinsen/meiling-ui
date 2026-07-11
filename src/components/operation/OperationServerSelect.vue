<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, X } from 'lucide-vue-next'
import { getServerApi } from '@/api/operation'
import OperationServerPickModal from '@/components/operation/OperationServerPickModal.vue'
import { API_SUCCESS_CODE } from '@/types/api'
import type { Environment, OperationServer } from '@/types/operation'

const model = defineModel<string | number | '' | undefined>()

const props = withDefaults(
  defineProps<{
    environment?: Environment | number | ''
    disabled?: boolean
    emptyLabel?: string
    pickTitle?: string
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  select: [server: OperationServer | null]
}>()

const { t } = useI18n()

const pickOpen = ref(false)
const selectedServer = ref<OperationServer | null>(null)

const displayLabel = computed(() => {
  if (model.value == null || model.value === '') {
    return props.emptyLabel ?? t('operation.common.linkServerNone')
  }
  if (selectedServer.value) return formatServerLabel(selectedServer.value)
  return `#${model.value}`
})

function formatServerLabel(srv: OperationServer) {
  const ip = srv.innerIp || srv.ip || '-'
  return `${srv.serverName || ip} · ${ip}`
}

async function ensureSelected(id: string | number) {
  try {
    const result = await getServerApi(id)
    if (result.code === API_SUCCESS_CODE && result.data) {
      selectedServer.value = result.data
      emit('select', result.data)
    }
  } catch {
    selectedServer.value = null
  }
}

function onPick(id: string, server: OperationServer | null) {
  model.value = id
  selectedServer.value = server
  emit('select', server)
  pickOpen.value = false
}

function clearSelection(event: Event) {
  event.stopPropagation()
  model.value = ''
  selectedServer.value = null
  emit('select', null)
}

watch(model, (id) => {
  if (id == null || id === '') {
    selectedServer.value = null
    emit('select', null)
    return
  }
  void ensureSelected(id)
})

onMounted(() => {
  if (model.value != null && model.value !== '') void ensureSelected(model.value)
})
</script>

<template>
  <div class="operation-server-filter">
    <button
      type="button"
      class="operation-server-filter__trigger"
      :disabled="disabled"
      @click="pickOpen = true"
    >
      <span class="min-w-0 flex-1 truncate text-left">{{ displayLabel }}</span>
      <ChevronDown class="h-4 w-4 shrink-0 text-gray-400" />
    </button>
    <button
      v-if="model != null && model !== '' && !disabled"
      type="button"
      class="operation-server-filter__clear"
      :aria-label="t('operation.common.reset')"
      @click="clearSelection"
    >
      <X class="h-3.5 w-3.5" />
    </button>

    <OperationServerPickModal
      :open="pickOpen"
      :model-value="model == null || model === '' ? '' : String(model)"
      :title="pickTitle"
      :all-label="emptyLabel"
      :default-environment="environment"
      @pick="onPick"
      @close="pickOpen = false"
    />
  </div>
</template>
