<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  addDeptApi,
  deleteDeptApi,
  getDeptApi,
  getDeptTreeListApi,
  listDeptApi,
  updateDeptApi,
} from '@/api/dept'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import { confirm } from '@/composables/useConfirm'
import { showToast } from '@/composables/useToast'
import { useTreeExpand } from '@/composables/useTreeExpand'
import { API_SUCCESS_CODE } from '@/types/api'
import { createEmptyDept, type DeptQuery, type DeptVo, type SysDept } from '@/types/dept'
import { toParentId } from '@/utils/id'
import {
  buildTree,
  collectTreeIds,
  flattenVisibleTree,
  normalizeNestedTree,
  sortTreeByOrderNum,
} from '@/utils/tree'
import { ChevronDown, ChevronRight, FoldVertical, Pencil, Plus, RefreshCw, Search, Trash2, UnfoldVertical } from 'lucide-vue-next'

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const deptTree = ref<SysDept[]>([])
const deptNameMap = ref(new Map<string, string>())
const {
  expanded,
  isFullyCollapsed,
  treeExpandLabel,
  toggleExpand,
  toggleTreeExpand,
  expandAllIfEmpty,
} = useTreeExpand()
const modalOpen = ref(false)
const modalTitle = ref('')
const form = ref<SysDept>(createEmptyDept())

const query = reactive<DeptQuery>({
  deptName: '',
  status: '',
})

const flatRows = computed(() => flattenVisibleTree(deptTree.value, expanded.value))

const parentOptions = computed(() => {
  const options: { value: string; label: string }[] = [
    { value: '0', label: t('system.dept.root') },
  ]
  const walk = (nodes: SysDept[], prefix: string) => {
    for (const node of nodes) {
      if (String(node.id) === String(form.value.id)) continue
      options.push({ value: String(node.id), label: `${prefix}${node.deptName}` })
      if (node.children?.length) walk(node.children, `${prefix}— `)
    }
  }
  walk(deptTree.value, '')
  return options
})

function statusLabel(status?: number) {
  return status === 1 ? t('system.dept.statusOn') : t('system.dept.statusOff')
}

function formatTime(value?: string | number) {
  if (value == null || value === '') return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

function parentDeptLabel(parentId?: number | string) {
  if (parentId == null || String(parentId) === '0') return t('system.dept.root')
  return deptNameMap.value.get(String(parentId)) ?? '-'
}

function buildDeptNameMap(flat: DeptVo[]) {
  deptNameMap.value = new Map(
    flat.map((item) => [String(item.id), String(item.deptName ?? '')]),
  )
}

function mergeTreeWithFlat(flat: DeptVo[], nested: SysDept[]): SysDept[] {
  const treeIds = new Set(collectTreeIds(nested))
  const missing = flat.filter((item) => item.id != null && !treeIds.has(String(item.id)))
  if (!missing.length) return nested
  return [...nested, ...(buildTree(missing) as SysDept[])]
}

async function resolveDeptTree(flat: DeptVo[], hasFilter: boolean): Promise<SysDept[]> {
  buildDeptNameMap(flat)

  if (hasFilter || !flat.length) {
    return sortTreeByOrderNum(buildTree(flat) as SysDept[])
  }

  try {
    const treeResult = await getDeptTreeListApi()
    if (treeResult.code === API_SUCCESS_CODE && treeResult.data?.length) {
      const nested = normalizeNestedTree(treeResult.data) as SysDept[]
      return sortTreeByOrderNum(mergeTreeWithFlat(flat, nested))
    }
  } catch {
    /* fall back to client-side tree */
  }

  return sortTreeByOrderNum(buildTree(flat) as SysDept[])
}

async function loadDepts() {
  loading.value = true
  try {
    const hasFilter = Boolean(query.deptName?.trim() || query.status !== '')
    const result = await listDeptApi({
      deptName: query.deptName,
      status: query.status === '' ? undefined : query.status,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.dept.loadFailed'))
    }
    deptTree.value = await resolveDeptTree(result.data, hasFilter)
    expandAllIfEmpty(deptTree.value)
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.dept.loadFailed'))
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.deptName = ''
  query.status = ''
  loadDepts()
}

function openCreate(parent?: SysDept) {
  form.value = createEmptyDept(parent?.id ?? 0)
  modalTitle.value = t('system.dept.add')
  modalOpen.value = true
}

async function openEdit(row: SysDept) {
  try {
    const result = await getDeptApi(row.id!)
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.dept.loadFailed'))
    }
    form.value = { ...result.data }
    modalTitle.value = t('system.dept.edit')
    modalOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.dept.loadFailed'))
  }
}

function closeModal() {
  modalOpen.value = false
  form.value = createEmptyDept()
}

function validateForm() {
  if (!form.value.deptName?.trim()) return t('system.dept.nameRequired')
  if (form.value.orderNum == null || form.value.orderNum < 0) return t('system.dept.sortRequired')
  return null
}

async function submitForm() {
  const error = validateForm()
  if (error) {
    showToast('error', error)
    return
  }

  saving.value = true
  try {
    const payload: SysDept = {
      ...form.value,
      deptName: form.value.deptName.trim(),
      parentId: toParentId(form.value.parentId),
      orderNum: Number(form.value.orderNum) || 0,
      status: Number(form.value.status ?? 1),
    }
    const result = form.value.id
      ? await updateDeptApi(payload)
      : await addDeptApi(payload)

    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.dept.saveFailed'))
    }

    showToast('success', form.value.id ? t('system.dept.updateOk') : t('system.dept.createOk'))
    closeModal()
    await loadDepts()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.dept.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function removeDept(row: SysDept) {
  if (!(await confirm({ message: t('system.dept.deleteConfirm', { name: row.deptName }) }))) return

  try {
    const result = await deleteDeptApi(row.id!)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.dept.deleteFailed'))
    }
    showToast('success', t('system.dept.deleteOk'))
    await loadDepts()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.dept.deleteFailed'))
  }
}

onMounted(loadDepts)
</script>

<template>
  <div class="page-stack">
    <div class="card p-5">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <form class="form-search-toolbar contents" @submit.prevent="loadDepts">
          <FormField :label="t('system.dept.name')" horizontal class="form-field-search">
            <input
              v-model="query.deptName"
              type="text"
              class="field-input"
              :placeholder="t('system.dept.namePlaceholder')"
            />
          </FormField>
          <FormField :label="t('system.dept.status')" horizontal class="form-field-search">
            <select v-model="query.status" class="field-input">
              <option value="">{{ t('system.dept.statusAll') }}</option>
              <option :value="1">{{ t('system.dept.statusOn') }}</option>
              <option :value="0">{{ t('system.dept.statusOff') }}</option>
            </select>
          </FormField>
          <button type="submit" class="btn-primary shrink-0">
            <Search class="h-4 w-4" /> {{ t('system.dept.search') }}
          </button>
          <button type="button" class="btn-ghost shrink-0" @click="resetQuery">
            <RefreshCw class="h-4 w-4" /> {{ t('system.dept.reset') }}
          </button>
        </form>
        <div class="toolbar-actions">
          <button type="button" class="btn-primary shrink-0" @click="openCreate()">
            <Plus class="h-4 w-4" /> {{ t('system.dept.add') }}
          </button>
          <button type="button" class="btn-tree-toggle shrink-0" @click="toggleTreeExpand(deptTree)">
            <UnfoldVertical v-if="isFullyCollapsed" class="h-4 w-4 text-gray-400" />
            <FoldVertical v-else class="h-4 w-4 text-gray-400" />
            {{ treeExpandLabel }}
          </button>
        </div>
      </div>

      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-400 dark:bg-white/5">
            <tr>
              <th class="px-4 py-3">{{ t('system.dept.name') }}</th>
              <th class="px-4 py-3">{{ t('system.dept.parent') }}</th>
              <th class="px-4 py-3">{{ t('system.dept.sort') }}</th>
              <th class="px-4 py-3">{{ t('system.dept.status') }}</th>
              <th class="px-4 py-3">{{ t('system.dept.createTime') }}</th>
              <th class="px-4 py-3 text-right">{{ t('system.dept.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="px-4 py-10 text-center text-gray-400">{{ t('system.dept.loading') }}</td>
            </tr>
            <tr v-else-if="!flatRows.length">
              <td colspan="6" class="px-4 py-10 text-center text-gray-400">{{ t('system.dept.empty') }}</td>
            </tr>
            <tr
              v-for="row in flatRows"
              v-else
              :key="String(row.id)"
              class="border-t border-gray-50 transition hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-1" :style="{ paddingLeft: `${row.depth * 24}px` }">
                  <button
                    v-if="row.hasChildren"
                    type="button"
                    class="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
                    @click="toggleExpand(String(row.id))"
                  >
                    <ChevronDown v-if="expanded.has(String(row.id))" class="h-4 w-4" />
                    <ChevronRight v-else class="h-4 w-4" />
                  </button>
                  <span v-else class="w-5 shrink-0" />
                  <span
                    v-if="row.depth > 0"
                    class="mr-1 shrink-0 text-xs text-gray-300 dark:text-gray-600"
                    aria-hidden="true"
                  >
                    └
                  </span>
                  <span class="font-medium text-gray-900 dark:text-white">{{ row.deptName }}</span>
                </div>
              </td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ parentDeptLabel(row.parentId) }}</td>
              <td class="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">{{ row.orderNum ?? '-' }}</td>
              <td class="px-4 py-3">
                <span
                  :class="[
                    'badge',
                    row.status === 1
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400',
                  ]"
                >
                  {{ statusLabel(row.status) }}
                </span>
              </td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatTime(row.createTime) }}</td>
              <td class="px-4 py-3">
                <div class="btn-action-group">
                  <button type="button" class="btn-action-edit" @click="openEdit(row)">
                    <Pencil class="h-3.5 w-3.5" />
                    {{ t('system.dept.edit') }}
                  </button>
                  <button type="button" class="btn-action-add-child" @click="openCreate(row)">
                    <Plus class="h-3.5 w-3.5" />
                    {{ t('system.dept.addChild') }}
                  </button>
                  <button type="button" class="btn-action-danger" @click="removeDept(row)">
                    <Trash2 class="h-3.5 w-3.5" />
                    {{ t('system.dept.delete') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AppModal :open="modalOpen" :title="modalTitle" wide @close="closeModal">
      <form class="form-modal" @submit.prevent="submitForm">
        <div class="form-grid-pairs">
          <div class="form-grid-row">
            <FormField :label="t('system.dept.parent')" horizontal class="form-field-span-2">
              <select v-model="form.parentId" class="field-input">
                <option v-for="opt in parentOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.dept.name')" horizontal required>
              <input v-model="form.deptName" type="text" class="field-input" />
            </FormField>
            <FormField :label="t('system.dept.sort')" horizontal required>
              <input v-model.number="form.orderNum" type="number" min="0" class="field-input" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.dept.status')" horizontal class="form-field-span-2">
              <div class="form-row-inline">
                <label class="inline-flex items-center gap-2 text-sm">
                  <input v-model.number="form.status" type="radio" :value="1" /> {{ t('system.dept.statusOn') }}
                </label>
                <label class="inline-flex items-center gap-2 text-sm">
                  <input v-model.number="form.status" type="radio" :value="0" /> {{ t('system.dept.statusOff') }}
                </label>
              </div>
            </FormField>
          </div>
        </div>
      </form>

      <template #footer>
        <button type="button" class="btn-ghost" @click="closeModal">{{ t('system.dept.cancel') }}</button>
        <button type="button" class="btn-primary" :disabled="saving" @click="submitForm">
          {{ saving ? t('system.dept.saving') : t('system.dept.save') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
