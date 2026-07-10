<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { addPlatformApi, deletePlatformApi, getPlatformApi, listPlatformApi, revealPlatformSecretApi, updatePlatformApi } from '@/api/operation'
import EnvironmentSelect from '@/components/operation/EnvironmentSelect.vue'
import OperationPageHeader from '@/components/operation/OperationPageHeader.vue'
import SecretManageModal from '@/components/operation/SecretManageModal.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import { confirm } from '@/composables/useConfirm'
import { assertOperationSecretEdit, guardAction, guardOperationSecretEdit } from '@/composables/useActionPermissions'
import { PERM } from '@/constants/permissions'
import AppPagination from '@/components/ui/AppPagination.vue'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { showToast, formatDateTime } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import { createEmptyPlatform, type OperationPlatform } from '@/types/operation'
import { environmentI18nKey } from '@/utils/operationEnv'
import { Pencil, Plus, RefreshCw, Search, Trash2, KeyRound } from 'lucide-vue-next'

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const list = ref<OperationPlatform[]>([])
const total = ref(0)
const modalOpen = ref(false)
const modalTitle = ref('')
const form = ref<OperationPlatform>(createEmptyPlatform())
const passwordInput = ref('')
const isEdit = computed(() => form.value.id != null)
const secretOpen = ref(false)
const secretSaving = ref(false)
const secretRow = ref<OperationPlatform | null>(null)

const canManagePassword = computed(() => assertOperationSecretEdit(PERM.OP_PLATFORM_EDIT))

const query = reactive({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE, platformName: '', environment: '' as number | '' })

function envLabel(env?: number) {
  return t(environmentI18nKey(env))
}

function search() {
  if (query.pageNum === 1) loadList()
  else query.pageNum = 1
}

function resetQuery() {
  query.platformName = ''
  query.environment = ''
  search()
}

async function loadList() {
  loading.value = true
  try {
    const result = await listPlatformApi({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      platformName: query.platformName || undefined,
      environment: query.environment === '' ? undefined : (query.environment as 1 | 2 | 3 | 4),
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.platform.loadFailed'))
    list.value = result.data.list ?? []
    total.value = result.data.total ?? 0
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.platform.loadFailed'))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  if (!guardAction(PERM.OP_PLATFORM_ADD)) return
  form.value = createEmptyPlatform()
  passwordInput.value = ''
  modalTitle.value = t('operation.common.add')
  modalOpen.value = true
}

async function openEdit(row: OperationPlatform) {
  if (!guardAction(PERM.OP_PLATFORM_EDIT)) return
  try {
    const result = await getPlatformApi(row.id!)
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.platform.loadFailed'))
    form.value = { ...result.data }
    passwordInput.value = ''
    modalTitle.value = t('operation.common.edit')
    modalOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.platform.loadFailed'))
  }
}

function closeModal() {
  modalOpen.value = false
  form.value = createEmptyPlatform()
  passwordInput.value = ''
}

async function submitForm() {
  if (!guardAction(isEdit.value ? PERM.OP_PLATFORM_EDIT : PERM.OP_PLATFORM_ADD)) return
  if (!form.value.platformName?.trim()) {
    showToast('error', t('operation.platform.nameRequired'))
    return
  }
  saving.value = true
  try {
    const payload: OperationPlatform = {
      ...form.value,
      platformName: form.value.platformName.trim(),
      url: form.value.url?.trim() || undefined,
      account: form.value.account?.trim() || undefined,
      environment: Number(form.value.environment ?? 1) as 1 | 2 | 3 | 4,
      remark: form.value.remark?.trim() || undefined,
    }
    if (!isEdit.value && passwordInput.value.trim()) {
      payload.password = passwordInput.value.trim()
    }
    const result = isEdit.value ? await updatePlatformApi(payload) : await addPlatformApi(payload)
    if (result.code !== API_SUCCESS_CODE) throw new Error(result.msg || t('operation.common.saveFailed'))
    showToast('success', isEdit.value ? t('operation.common.updateOk') : t('operation.common.createOk'))
    closeModal()
    await loadList()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.common.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function removeRow(row: OperationPlatform) {
  if (!guardAction(PERM.OP_PLATFORM_REMOVE)) return
  if (!(await confirm({ message: t('operation.platform.deleteConfirm', { name: row.platformName }) }))) return
  try {
    const result = await deletePlatformApi(row.id!)
    if (result.code !== API_SUCCESS_CODE) throw new Error(result.msg || t('operation.common.deleteFailed'))
    showToast('success', t('operation.common.deleteOk'))
    await loadList()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.common.deleteFailed'))
  }
}

function openPasswordManage(row: OperationPlatform) {
  if (!canManagePassword.value) return
  secretRow.value = row
  secretOpen.value = true
}

function closePasswordManage() {
  secretOpen.value = false
  secretRow.value = null
}

async function savePassword(password: string) {
  if (!secretRow.value?.id) return
  if (!(await guardOperationSecretEdit(PERM.OP_PLATFORM_EDIT))) return
  secretSaving.value = true
  try {
    const result = await updatePlatformApi({ ...secretRow.value, password })
    if (result.code !== API_SUCCESS_CODE) throw new Error(result.msg || t('operation.common.saveFailed'))
    showToast('success', t('operation.common.passwordSaveOk'))
    closePasswordManage()
    await loadList()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.common.saveFailed'))
  } finally {
    secretSaving.value = false
  }
}

watch(() => [query.pageNum, query.pageSize], loadList)
onMounted(loadList)
</script>

<template>
  <div class="page-stack">
    <OperationPageHeader :title="t('operation.platform.title')" :subtitle="t('operation.platform.subtitle')">
      <template #toolbar>
        <form class="operation-search-form" @submit.prevent="search">
          <label class="operation-filter-field">
            <span>{{ t('operation.platform.platformName') }}</span>
            <input v-model="query.platformName" type="text" class="field-input" />
          </label>
          <div class="operation-filter-field">
            <span>{{ t('operation.common.environment') }}</span>
            <EnvironmentSelect v-model="query.environment" include-all />
          </div>
          <button type="submit" class="btn-primary shrink-0"><Search class="h-4 w-4" /> {{ t('operation.common.search') }}</button>
          <button type="button" class="btn-ghost shrink-0" @click="resetQuery"><RefreshCw class="h-4 w-4" /> {{ t('operation.common.reset') }}</button>
        </form>
        <div class="toolbar-actions">
          <button type="button" class="btn-primary shrink-0" @click="openCreate"><Plus class="h-4 w-4" /> {{ t('operation.common.add') }}</button>
        </div>
      </template>
    </OperationPageHeader>

    <div class="card p-5">
      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[900px] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase text-gray-400 dark:bg-white/5">
            <tr>
              <th class="px-4 py-3">{{ t('operation.platform.platformName') }}</th>
              <th class="px-4 py-3">URL</th>
              <th class="px-4 py-3">{{ t('operation.platform.account') }}</th>
              <th class="px-4 py-3">{{ t('operation.common.environment') }}</th>
              <th class="px-4 py-3">{{ t('operation.common.remark') }}</th>
              <th class="px-4 py-3">{{ t('operation.common.createTime') }}</th>
              <th class="px-4 py-3 text-right">{{ t('operation.common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="7" class="px-4 py-10 text-center text-gray-400">{{ t('operation.common.loading') }}</td></tr>
            <tr v-else-if="!list.length"><td colspan="7" class="px-4 py-10 text-center text-gray-400">{{ t('operation.common.empty') }}</td></tr>
            <tr v-for="row in list" v-else :key="String(row.id)" class="border-t border-gray-50 dark:border-white/5 hover:bg-gray-50/80 dark:hover:bg-white/5">
              <td class="px-4 py-3 font-medium">{{ row.platformName }}</td>
              <td class="px-4 py-3"><a v-if="row.url" :href="row.url" target="_blank" class="text-brand-600 hover:underline">{{ row.url }}</a><span v-else>-</span></td>
              <td class="px-4 py-3">{{ row.account || '-' }}</td>
              <td class="px-4 py-3"><span class="badge bg-gray-100 dark:bg-white/10">{{ envLabel(row.environment) }}</span></td>
              <td class="max-w-[160px] truncate px-4 py-3">{{ row.remark || '-' }}</td>
              <td class="px-4 py-3">{{ formatDateTime(row.createTime) }}</td>
              <td class="px-4 py-3">
                <div class="btn-action-group flex-wrap justify-end">
                  <button
                    v-if="canManagePassword"
                    type="button"
                    class="btn-action-edit"
                    @click="openPasswordManage(row)"
                  >
                    <KeyRound class="h-3.5 w-3.5" />{{ t('operation.common.passwordManage') }}
                  </button>
                  <button type="button" class="btn-action-edit" @click="openEdit(row)"><Pencil class="h-3.5 w-3.5" />{{ t('operation.common.edit') }}</button>
                  <button type="button" class="btn-action-danger" @click="removeRow(row)"><Trash2 class="h-3.5 w-3.5" />{{ t('operation.common.delete') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="total > 0" class="mt-4"><AppPagination v-model:page-num="query.pageNum" v-model:page-size="query.pageSize" :total="total" /></div>
    </div>
    <AppModal :open="modalOpen" :title="modalTitle" wide @close="closeModal">
      <form class="form-modal" novalidate @submit.prevent="submitForm">
        <div class="form-grid-pairs">
          <div class="form-grid-row">
            <FormField :label="t('operation.platform.platformName')" horizontal required class="form-field-span-2">
              <input v-model="form.platformName" class="field-input" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField label="URL" horizontal class="form-field-span-2">
              <input v-model="form.url" class="field-input" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('operation.platform.account')" horizontal class="form-field-span-2">
              <input v-model="form.account" class="field-input" />
            </FormField>
          </div>
          <div v-if="!isEdit" class="form-grid-row">
            <FormField :label="t('operation.platform.password')" horizontal class="form-field-span-2">
              <input
                v-model="passwordInput"
                type="password"
                class="field-input"
                :placeholder="t('operation.common.passwordPlaceholderEmpty')"
                autocomplete="new-password"
              />
              <p class="mt-1.5 text-xs text-gray-400">{{ t('operation.common.passwordCreateHint') }}</p>
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('operation.common.environment')" horizontal class="form-field-span-2">
              <EnvironmentSelect v-model="form.environment" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('operation.common.remark')" horizontal class="form-field-span-2">
              <textarea v-model="form.remark" rows="3" class="field-input resize-y" />
            </FormField>
          </div>
        </div>
      </form>
      <template #footer>
        <button type="button" class="btn-ghost" @click="closeModal">{{ t('operation.common.cancel') }}</button>
        <button type="button" class="btn-primary" :disabled="saving" @click="submitForm">{{ saving ? t('operation.common.saving') : t('operation.common.save') }}</button>
      </template>
    </AppModal>

    <SecretManageModal
      :open="secretOpen"
      :saving="secretSaving"
      :password-configured="secretRow?.passwordConfigured"
      :password-mask="secretRow?.passwordMask"
      :record-id="secretRow?.id"
      :entity-name="secretRow?.platformName"
      :reveal-api="revealPlatformSecretApi"
      @save="savePassword"
      @close="closePasswordManage"
    />
  </div>
</template>
