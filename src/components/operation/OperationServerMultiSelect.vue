<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Link2 } from 'lucide-vue-next'
import { getServerApi } from '@/api/operation'
import OperationServerLinksModal from '@/components/operation/OperationServerLinksModal.vue'
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

const disabled = computed(() => props.disabled)

const emit = defineEmits<{
  primaryChange: [server: OperationServer | null]
}>()

const { t } = useI18n()

const linksOpen = ref(false)
const serverCache = ref<Map<string, OperationServer>>(new Map())

function formatServerLabel(srv: OperationServer) {
  const ip = srv.innerIp || srv.ip || '-'
  return `${srv.serverName || ip} · ${ip}`
}

function cacheServer(srv: OperationServer) {
  if (srv.id == null) return
  serverCache.value.set(String(srv.id), srv)
}

function emitPrimary() {
  const primaryId = model.value[0]
  if (!primaryId) {
    emit('primaryChange', null)
    return
  }
  emit('primaryChange', serverCache.value.get(String(primaryId)) ?? null)
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
  emitPrimary()
}

function onLinksConfirm(ids: string[]) {
  model.value = ids
  void ensureCache(ids)
}

watch(model, (ids) => void ensureCache(ids.map(String)), { deep: true })

onMounted(() => {
  if (model.value.length) void ensureCache(model.value.map(String))
  else emitPrimary()
})
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
        <span class="max-w-[200px] truncate">
          {{ serverCache.get(String(id)) ? formatServerLabel(serverCache.get(String(id))!) : id }}
        </span>
        <span v-if="index === 0" class="ml-1 text-[10px] opacity-80">{{ t('operation.project.primaryServer') }}</span>
      </span>
    </div>
    <p v-else class="text-sm text-gray-400">{{ t('operation.serverMulti.empty') }}</p>

    <button type="button" class="btn-ghost mt-2 gap-1.5 text-sm" :disabled="disabled" @click="linksOpen = true">
      <Link2 class="h-4 w-4" />
      {{ t('operation.serverMulti.manage') }}
      <span v-if="model.length" class="text-gray-400">({{ model.length }})</span>
    </button>

    <OperationServerLinksModal
      :open="linksOpen"
      :model-value="model.map(String)"
      :default-environment="props.environment"
      :disabled="disabled"
      @update:model-value="onLinksConfirm"
      @primary-change="emit('primaryChange', $event)"
      @close="linksOpen = false"
    />
  </div>
</template>
