<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getPortAuditApi } from '@/api/operation'
import AppModal from '@/components/ui/AppModal.vue'
import PortMatchBadge from '@/components/operation/PortMatchBadge.vue'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { OperationPortAudit } from '@/types/operation'
import { environmentI18nKey } from '@/utils/operationEnv'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const loading = ref(false)
const audit = ref<OperationPortAudit | null>(null)

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
        <h3 class="mb-2 text-sm font-semibold">{{ t('operation.port.matrixRef') }}</h3>
        <div class="overflow-x-auto rounded border border-gray-100 dark:border-white/10">
          <table class="w-full min-w-[480px] text-left text-xs">
            <thead class="bg-gray-50 dark:bg-white/5">
              <tr>
                <th class="px-3 py-2">{{ t('operation.port.service') }}</th>
                <th class="px-3 py-2">{{ t('operation.component.port') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in audit.matrix" :key="row.key" class="border-t border-gray-50 dark:border-white/5">
                <td class="px-3 py-2 font-medium">{{ row.key }}</td>
                <td class="px-3 py-2">{{ row.expectedPort }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 class="mb-2 text-sm font-semibold">{{ t('operation.port.auditItems') }}</h3>
        <div class="max-h-[360px] overflow-y-auto rounded border border-gray-100 dark:border-white/10">
          <table class="w-full min-w-[720px] text-left text-xs">
            <thead class="sticky top-0 bg-gray-50 dark:bg-white/5">
              <tr>
                <th class="px-3 py-2">{{ t('operation.port.recordType') }}</th>
                <th class="px-3 py-2">{{ t('operation.port.name') }}</th>
                <th class="px-3 py-2">{{ t('operation.port.actual') }}</th>
                <th class="px-3 py-2">{{ t('operation.port.expected') }}</th>
                <th class="px-3 py-2">{{ t('operation.common.environment') }}</th>
                <th class="px-3 py-2">{{ t('operation.port.status') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in audit.items" :key="`${item.recordType}-${item.id}`" class="border-t border-gray-50 dark:border-white/5">
                <td class="px-3 py-2">{{ item.recordType === 'project' ? t('operation.project.title') : t('operation.component.title') }}</td>
                <td class="px-3 py-2 font-medium">{{ item.name }}</td>
                <td class="px-3 py-2">{{ item.actualPort || '-' }}</td>
                <td class="px-3 py-2">{{ item.expectedPort || '-' }}</td>
                <td class="px-3 py-2">{{ t(environmentI18nKey(item.environment)) }}</td>
                <td class="px-3 py-2"><PortMatchBadge :status="item.portMatchStatus" :expected-port="item.expectedPort" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
    <template #footer>
      <button type="button" class="btn-ghost" @click="emit('close')">{{ t('operation.common.cancel') }}</button>
    </template>
  </AppModal>
</template>
