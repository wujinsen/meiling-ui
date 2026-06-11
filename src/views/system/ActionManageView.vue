<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  addActionApi,
  changeActionStatusApi,
  deleteActionApi,
  fetchActionPage,
  getActionApi,
  updateActionApi,
  type ActionVo,
} from '@/api/action'
import { listMenuApi } from '@/api/menu'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import { confirm } from '@/composables/useConfirm'
import { guardAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { PERM } from '@/constants/permissions'
import AppPagination from '@/components/ui/AppPagination.vue'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { API_SUCCESS_CODE } from '@/types/api'
import type { SysMenu } from '@/types/menu'
import { Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-vue-next'

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const actionList = ref<ActionVo[]>([])
const total = ref(0)
const modalOpen = ref(false)
const modalTitle = ref('')
const form = ref<ActionVo>(createEmptyAction())
const pageMenus = ref<SysMenu[]>([])
const isEdit = computed(() => form.value.id != null)

const query = reactive({
  pageNum: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  permCode: '',
  name: '',
  menuId: '' as number | string | '',
  status: '' as number | '',
})

function createEmptyAction(): ActionVo {
  return { permCode: '', name: '', menuId: undefined, orderNum: 0, status: 1 }
}

function statusLabel(status?: number) {
  return status === 1 ? t('system.action.statusOn') : t('system.action.statusOff')
}

function searchActions() {
  if (query.pageNum === 1) loadActions()
  else query.pageNum = 1
}

function resetQuery() {
  query.permCode = ''
  query.name = ''
  query.menuId = ''
  query.status = ''
  searchActions()
}

async function loadPageMenus() {
  try {
    const result = await listMenuApi({ status: 1 })
    if (result.code === API_SUCCESS_CODE && result.data) {
      pageMenus.value = (result.data as SysMenu[]).filter((m) => String(m.menuType).toUpperCase() === 'C')
    }
  } catch {
    pageMenus.value = []
  }
}

async function loadActions() {
  loading.value = true
  try {
    const page = await fetchActionPage(
      {
        pageNum: query.pageNum,
        pageSize: query.pageSize,
        permCode: query.permCode || undefined,
        name: query.name || undefined,
        menuId: query.menuId === '' ? undefined : query.menuId,
        status: query.status === '' ? undefined : query.status,
      },
      pageMenus.value,
    )
    actionList.value = page.list ?? []
    total.value = page.total ?? 0
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.action.loadFailed'))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  if (!guardAction(PERM.MENU_EDIT)) return
  form.value = createEmptyAction()
  modalTitle.value = t('system.action.add')
  modalOpen.value = true
}

async function openEdit(row: ActionVo) {
  if (!guardAction(PERM.MENU_EDIT)) return
  try {
    const result = await getActionApi(row.id!)
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.action.loadFailed'))
    }
    form.value = { ...result.data }
    modalTitle.value = t('system.action.edit')
    modalOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.action.loadFailed'))
  }
}

function closeModal() {
  modalOpen.value = false
  form.value = createEmptyAction()
}

function validateForm() {
  if (!isEdit.value && !form.value.permCode?.trim()) return t('system.action.permCodeRequired')
  if (!form.value.name?.trim()) return t('system.action.nameRequired')
  return null
}

async function submitForm() {
  if (!guardAction(PERM.MENU_EDIT)) return
  const error = validateForm()
  if (error) {
    showToast('error', error)
    return
  }

  saving.value = true
  try {
    const payload: ActionVo = {
      ...form.value,
      permCode: form.value.permCode.trim(),
      name: form.value.name.trim(),
      menuId: form.value.menuId === '' || form.value.menuId == null ? undefined : form.value.menuId,
      orderNum: Number(form.value.orderNum ?? 0),
      status: Number(form.value.status ?? 1),
    }
    const result = isEdit.value ? await updateActionApi(payload) : await addActionApi(payload)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.action.saveFailed'))
    }
    showToast('success', isEdit.value ? t('system.action.updateOk') : t('system.action.createOk'))
    closeModal()
    await loadActions()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.action.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function toggleStatus(row: ActionVo) {
  if (!guardAction(PERM.MENU_EDIT)) return
  const next = row.status === 1 ? 0 : 1
  try {
    const result = await changeActionStatusApi(row.id!, next)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.action.statusFailed'))
    }
    row.status = next
    showToast('success', t('system.action.statusOk'))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.action.statusFailed'))
  }
}

async function removeAction(row: ActionVo) {
  if (!guardAction(PERM.MENU_EDIT)) return
  if (!(await confirm({ message: t('system.action.deleteConfirm', { name: row.name }) }))) return
  try {
    const result = await deleteActionApi(String(row.id))
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.action.deleteFailed'))
    }
    showToast('success', t('system.action.deleteOk'))
    await loadActions()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.action.deleteFailed'))
  }
}

watch(() => [query.pageNum, query.pageSize], loadActions)
onMounted(async () => {
  await loadPageMenus()
  await loadActions()
})
</script>

<template>
  <div class="page-stack">
    <div class="card p-5">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <form class="form-search-toolbar contents" @submit.prevent="searchActions">
          <FormField :label="t('system.action.permCode')" horizontal class="form-field-search">
            <input v-model="query.permCode" type="text" class="field-input" />
          </FormField>
          <FormField :label="t('system.action.name')" horizontal class="form-field-search">
            <input v-model="query.name" type="text" class="field-input" />
          </FormField>
          <FormField :label="t('system.action.menu')" horizontal class="form-field-search">
            <select v-model="query.menuId" class="field-input">
              <option value="">{{ t('system.action.menuAll') }}</option>
              <option v-for="m in pageMenus" :key="String(m.id)" :value="m.id">{{ m.menuName }}</option>
            </select>
          </FormField>
          <button type="submit" class="btn-primary shrink-0">
            <Search class="h-4 w-4" /> {{ t('system.action.search') }}
          </button>
          <button type="button" class="btn-ghost shrink-0" @click="resetQuery">
            <RefreshCw class="h-4 w-4" /> {{ t('system.action.reset') }}
          </button>
        </form>
        <div class="toolbar-actions">
          <button type="button" class="btn-primary shrink-0" @click="openCreate">
            <Plus class="h-4 w-4" /> {{ t('system.action.add') }}
          </button>
        </div>
      </div>

      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[900px] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-400 dark:bg-white/5">
            <tr>
              <th class="px-4 py-3">{{ t('system.action.permCode') }}</th>
              <th class="px-4 py-3">{{ t('system.action.name') }}</th>
              <th class="px-4 py-3">{{ t('system.action.menu') }}</th>
              <th class="px-4 py-3">{{ t('system.action.orderNum') }}</th>
              <th class="px-4 py-3">{{ t('system.action.status') }}</th>
              <th class="px-4 py-3 text-right">{{ t('system.action.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="px-4 py-10 text-center text-gray-400">{{ t('system.action.loading') }}</td>
            </tr>
            <tr v-else-if="!actionList.length">
              <td colspan="6" class="px-4 py-10 text-center text-gray-400">{{ t('system.action.empty') }}</td>
            </tr>
            <tr
              v-for="row in actionList"
              v-else
              :key="String(row.id)"
              class="border-t border-gray-50 dark:border-white/5"
            >
              <td class="px-4 py-3 font-mono text-xs">{{ row.permCode }}</td>
              <td class="px-4 py-3">{{ row.name }}</td>
              <td class="px-4 py-3 text-gray-600">{{ row.menuName || '-' }}</td>
              <td class="px-4 py-3 tabular-nums">{{ row.orderNum ?? 0 }}</td>
              <td class="px-4 py-3">
                <button type="button" class="text-sm text-primary-600 hover:underline" @click="toggleStatus(row)">
                  {{ statusLabel(row.status) }}
                </button>
              </td>
              <td class="px-4 py-3">
                <div class="btn-action-group justify-end">
                  <button type="button" class="btn-action-edit" @click="openEdit(row)">
                    <Pencil class="h-3.5 w-3.5" /> {{ t('system.action.edit') }}
                  </button>
                  <button type="button" class="btn-action-danger" @click="removeAction(row)">
                    <Trash2 class="h-3.5 w-3.5" /> {{ t('system.action.delete') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="total > 0" class="mt-4">
        <AppPagination v-model:page-num="query.pageNum" v-model:page-size="query.pageSize" :total="total" />
      </div>
    </div>

    <AppModal :open="modalOpen" :title="modalTitle" wide @close="closeModal">
      <form class="form-modal" @submit.prevent="submitForm">
        <FormField v-if="!isEdit" :label="t('system.action.permCode')" required>
          <input v-model="form.permCode" type="text" class="field-input" :placeholder="t('system.action.permCodeHint')" />
        </FormField>
        <FormField v-else :label="t('system.action.permCode')">
          <input :value="form.permCode" type="text" class="field-input" disabled />
        </FormField>
        <FormField :label="t('system.action.name')" required>
          <input v-model="form.name" type="text" class="field-input" />
        </FormField>
        <FormField :label="t('system.action.menu')">
          <select v-model="form.menuId" class="field-input">
            <option :value="undefined">{{ t('system.action.menuNone') }}</option>
            <option v-for="m in pageMenus" :key="String(m.id)" :value="m.id">{{ m.menuName }}</option>
          </select>
        </FormField>
        <FormField :label="t('system.action.orderNum')">
          <input v-model.number="form.orderNum" type="number" min="0" class="field-input" />
        </FormField>
        <FormField :label="t('system.action.status')">
          <select v-model.number="form.status" class="field-input">
            <option :value="1">{{ t('system.action.statusOn') }}</option>
            <option :value="0">{{ t('system.action.statusOff') }}</option>
          </select>
        </FormField>
        <div class="form-modal-actions">
          <button type="button" class="btn-ghost" @click="closeModal">{{ t('system.action.cancel') }}</button>
          <button type="submit" class="btn-primary" :disabled="saving">{{ t('system.action.save') }}</button>
        </div>
      </form>
    </AppModal>
  </div>
</template>
