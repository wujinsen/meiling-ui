<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { getServerApi } from '@/api/operation'
import AppModal from '@/components/ui/AppModal.vue'
import EnvironmentBadge from '@/components/operation/EnvironmentBadge.vue'
import HealthStatusBadge from '@/components/operation/HealthStatusBadge.vue'
import ServerRoleBadge from '@/components/operation/ServerRoleBadge.vue'
import ServerTagsBadges from '@/components/operation/ServerTagsBadges.vue'
import { showToast, formatDateTime } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { OperationServer } from '@/types/operation'
import { ExternalLink } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  serverId: number | string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const server = ref<OperationServer | null>(null)

async function loadServer() {
  if (props.serverId == null) return
  loading.value = true
  server.value = null
  try {
    const result = await getServerApi(props.serverId)
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.server.loadFailed'))
    server.value = result.data
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.server.loadFailed'))
    emit('close')
  } finally {
    loading.value = false
  }
}

function goServerManage() {
  if (props.serverId == null) return
  emit('close')
  router.push({ path: '/operation/server/index', query: { serverId: String(props.serverId) } })
}

watch(
  () => [props.open, props.serverId] as const,
  ([open, id]) => {
    if (open && id != null) void loadServer()
    if (!open) server.value = null
  },
  { immediate: true },
)
</script>

<template>
  <AppModal
    :open="open"
    :title="t('operation.server.detailTitle', { name: server?.serverName || String(serverId ?? '') })"
    wide
    @close="emit('close')"
  >
    <div v-if="loading" class="py-10 text-center text-gray-400">{{ t('operation.common.loading') }}</div>
    <div v-else-if="server" class="space-y-4 text-sm">
      <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <dt class="text-xs text-gray-400">{{ t('operation.server.serverName') }}</dt>
          <dd class="mt-0.5 font-medium">{{ server.serverName || '-' }}</dd>
        </div>
        <div>
          <dt class="text-xs text-gray-400">IP</dt>
          <dd class="mt-0.5">{{ server.ip || '-' }}</dd>
        </div>
        <div>
          <dt class="text-xs text-gray-400">{{ t('operation.server.innerIp') }}</dt>
          <dd class="mt-0.5">{{ server.innerIp || '-' }}</dd>
        </div>
        <div>
          <dt class="text-xs text-gray-400">{{ t('operation.server.port') }}</dt>
          <dd class="mt-0.5">{{ server.port || '-' }}</dd>
        </div>
        <div>
          <dt class="text-xs text-gray-400">{{ t('operation.common.environment') }}</dt>
          <dd class="mt-1"><EnvironmentBadge :environment="server.environment" /></dd>
        </div>
        <div>
          <dt class="text-xs text-gray-400">{{ t('operation.serverRole.label') }}</dt>
          <dd class="mt-1"><ServerRoleBadge :server-role="server.serverRole" /></dd>
        </div>
        <div>
          <dt class="text-xs text-gray-400">{{ t('operation.health.status') }}</dt>
          <dd class="mt-1">
            <HealthStatusBadge :status="server.status" :last-check-time="formatDateTime(server.lastCheckTime ?? undefined)" show-time />
          </dd>
        </div>
        <div>
          <dt class="text-xs text-gray-400">{{ t('operation.common.createTime') }}</dt>
          <dd class="mt-0.5">{{ formatDateTime(server.createTime) }}</dd>
        </div>
        <div class="sm:col-span-2">
          <dt class="text-xs text-gray-400">{{ t('operation.serverTags.label') }}</dt>
          <dd class="mt-1"><ServerTagsBadges :tags="server.tags" /></dd>
        </div>
        <div class="sm:col-span-2">
          <dt class="text-xs text-gray-400">{{ t('operation.common.remark') }}</dt>
          <dd class="mt-0.5 whitespace-pre-wrap text-gray-600 dark:text-gray-300">{{ server.remark || '-' }}</dd>
        </div>
      </dl>
    </div>
    <template #footer>
      <button type="button" class="btn-ghost" @click="emit('close')">{{ t('operation.common.cancel') }}</button>
      <button v-if="serverId != null" type="button" class="btn-primary" @click="goServerManage">
        <ExternalLink class="h-4 w-4" /> {{ t('operation.server.openInManage') }}
      </button>
    </template>
  </AppModal>
</template>
