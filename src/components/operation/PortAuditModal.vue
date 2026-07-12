<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { getPortAuditApi } from '@/api/operation'
import AppModal from '@/components/ui/AppModal.vue'
import OperationEntityLink from '@/components/operation/OperationEntityLink.vue'
import OperationRelationDrawerHost from '@/components/operation/OperationRelationDrawerHost.vue'
import PortMatchBadge from '@/components/operation/PortMatchBadge.vue'
import EnvironmentBadge from '@/components/operation/EnvironmentBadge.vue'
import { useOperationRelationDrawer } from '@/composables/useOperationRelationDrawer'
import { assertAction, guardAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { PERM } from '@/constants/permissions'
import { API_SUCCESS_CODE } from '@/types/api'
import type { OperationPortAudit } from '@/types/operation'
import { Settings2 } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const router = useRouter()
const {
  relationOpen,
  relationType,
  relationId,
  relationName,
  relationTab,
  openRelation,
  closeRelation,
} = useOperationRelationDrawer()
const loading = ref(false)
const audit = ref<OperationPortAudit | null>(null)
const canManageMatrix = computed(() => assertAction(PERM.OP_PORT_MATRIX_LIST))

async function load() {
  loading.value = true
  audit.value = null
  try {
    const result = await getPortAuditApi()
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.port.auditFailed'))
    audit.value = result.data
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.port.auditFailed'))
    emit('close')
  } finally {
    loading.value = false
  }
}

watch(() => props.open, (open) => {
  if (open) load()
})

function goManageMatrix() {
  if (!guardAction(PERM.OP_PORT_MATRIX_LIST)) return
  emit('close')
  router.push('/operation/port-matrix')
}

function openAuditItemRelations(item: { id?: number | string; recordType?: 'project' | 'component'; name?: string }) {
  if (item.id == null || !item.recordType) return
  openRelation(item.recordType, item.id, {
    name: item.name,
    tab: item.recordType === 'project' ? 'servers' : 'servers',
  })
}
</script>

<template>
  <AppModal :open="open" :title="t('operation.port.auditTitle')" wide @close="emit('close')">
    <div v-if="loading" class="py-10 text-center text-gray-400">{{ t('operation.common.loading') }}</div>
    <div v-else-if="audit" class="space-y-4">
      <div class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        <div class="rounded border border-gray-100 px-3 py-2 dark:border-white/10">
          <div class="text-gray-400">{{ t('operation.port.total') }}</div>
          <div class="text-lg font-semibold">{{ audit.total }}</div>
        </div>
        <div class="rounded border border-emerald-100 px-3 py-2 dark:border-emerald-900/40">
          <div class="text-gray-400">{{ t('operation.port.match') }}</div>
          <div class="text-lg font-semibold text-emerald-600">{{ audit.matched }}</div>
        </div>
        <div class="rounded border border-red-100 px-3 py-2 dark:border-red-900/40">
          <div class="text-gray-400">{{ t('operation.port.mismatch') }}</div>
          <div class="text-lg font-semibold text-red-600">{{ audit.mismatched }}</div>
        </div>
        <div class="rounded border border-gray-100 px-3 py-2 dark:border-white/10">
          <div class="text-gray-400">{{ t('operation.port.unmapped') }}</div>
          <div class="text-lg font-semibold">{{ audit.unmapped }}</div>
        </div>
        <div class="rounded border border-amber-100 px-3 py-2 dark:border-amber-900/40">
          <div class="text-gray-400">{{ t('operation.port.skipped') }}</div>
          <div class="text-lg font-semibold text-amber-600">{{ audit.skipped }}</div>
        </div>
      </div>

      <section>
        <h3 class="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">{{ t('operation.port.matrixRef') }}</h3>
        <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
          <table class="w-full min-w-[480px] text-left text-sm">
            <thead class="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-400 dark:bg-white/5">
              <tr>
                <th class="px-4 py-3">{{ t('operation.port.service') }}</th>
                <th class="px-4 py-3">{{ t('operation.component.port') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in audit.matrix" :key="row.key" class="border-t border-gray-50 dark:border-white/5">
                <td class="px-4 py-3 font-mono text-sm text-gray-600 dark:text-gray-300">{{ row.key }}</td>
                <td class="px-4 py-3 tabular-nums">{{ row.expectedPort }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 class="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">{{ t('operation.port.auditItems') }}</h3>
        <div class="max-h-[360px] overflow-y-auto rounded-lg border border-gray-100 dark:border-white/5">
          <table class="w-full min-w-[720px] text-left text-sm text-gray-700 dark:text-gray-200">
            <thead class="sticky top-0 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-400 dark:bg-white/5">
              <tr>
                <th class="px-4 py-3">{{ t('operation.port.recordType') }}</th>
                <th class="px-4 py-3">{{ t('operation.port.name') }}</th>
                <th class="px-4 py-3">{{ t('operation.port.actual') }}</th>
                <th class="px-4 py-3">{{ t('operation.port.expected') }}</th>
                <th class="px-4 py-3">{{ t('operation.common.environment') }}</th>
                <th class="px-4 py-3">{{ t('operation.port.status') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in audit.items" :key="`${item.recordType}-${item.id}`" class="border-t border-gray-50 dark:border-white/5">
                <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ item.recordType === 'project' ? t('operation.project.title') : t('operation.component.title') }}</td>
                <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  <OperationEntityLink
                    v-if="item.id && item.recordType"
                    :label="item.name || '—'"
                    @open="openAuditItemRelations(item)"
                  />
                  <span v-else>{{ item.name }}</span>
                </td>
                <td class="px-4 py-3 tabular-nums">{{ item.actualPort || '-' }}</td>
                <td class="px-4 py-3 tabular-nums">{{ item.expectedPort || '-' }}</td>
                <td class="px-4 py-3"><EnvironmentBadge :environment="item.environment" size="sm" /></td>
                <td class="px-4 py-3"><PortMatchBadge :status="item.portMatchStatus" :expected-port="item.expectedPort" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
    <template #footer>
      <button
        v-if="canManageMatrix"
        type="button"
        class="btn-secondary mr-auto"
        @click="goManageMatrix"
      >
        <Settings2 class="h-4 w-4" />
        {{ t('operation.portMatrix.manageLink') }}
      </button>
      <button type="button" class="btn-ghost" @click="emit('close')">{{ t('operation.common.cancel') }}</button>
    </template>
  </AppModal>

  <OperationRelationDrawerHost
    :open="relationOpen"
    :entity-type="relationType"
    :entity-id="relationId"
    :entity-name="relationName"
    :initial-tab="relationTab"
    @close="closeRelation"
  />
</template>
