<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  addMenuApi,
  deleteMenuApi,
  getMenuApi,
  listMenuApi,
  updateMenuApi,
} from '@/api/menu'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import MenuIconPicker from '@/components/system/MenuIconPicker.vue'
import { confirm } from '@/composables/useConfirm'
import { showToast } from '@/composables/useToast'
import { useTreeExpand } from '@/composables/useTreeExpand'
import { loadDynamicRoutes } from '@/composables/usePermission'
import { API_SUCCESS_CODE } from '@/types/api'
import { createEmptyMenu, type MenuQuery, type SysMenu } from '@/types/menu'
import { buildTree, flattenVisibleTree } from '@/utils/tree'
import { getMenuIconLabel, resolveMenuIcon } from '@/utils/menuIcons'
import { ChevronDown, ChevronRight, FoldVertical, Pencil, Plus, RefreshCw, Search, Trash2, UnfoldVertical } from 'lucide-vue-next'

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const menuTree = ref<SysMenu[]>([])
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
const form = ref<SysMenu>(createEmptyMenu())

const query = reactive<MenuQuery>({
  menuName: '',
  status: '',
})

const flatRows = computed(() => flattenVisibleTree(menuTree.value, expanded.value))

const parentOptions = computed(() => {
  const options: { value: string; label: string }[] = [
    { value: '0', label: t('system.menu.root') },
  ]
  const walk = (nodes: SysMenu[], prefix: string) => {
    for (const node of nodes) {
      if (String(node.id) === String(form.value.id)) continue
      options.push({ value: String(node.id), label: `${prefix}${node.menuName}` })
      if (node.children?.length) walk(node.children, `${prefix}— `)
    }
  }
  walk(menuTree.value, '')
  return options
})

function menuTypeLabel(type?: string) {
  if (type === 'M') return t('system.menu.typeDir')
  if (type === 'C') return t('system.menu.typeMenu')
  if (type === 'F') return t('system.menu.typeButton')
  return type || '-'
}

function statusLabel(status?: number) {
  return status === 1 ? t('system.menu.statusOn') : t('system.menu.statusOff')
}

async function loadMenus() {
  loading.value = true
  try {
    const result = await listMenuApi({
      menuName: query.menuName,
      status: query.status === '' ? undefined : query.status,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.menu.loadFailed'))
    }
    menuTree.value = buildTree(result.data) as SysMenu[]
    expandAllIfEmpty(menuTree.value)
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.menu.loadFailed'))
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.menuName = ''
  query.status = ''
  loadMenus()
}

function openCreate(parent?: SysMenu) {
  form.value = createEmptyMenu(parent?.id ?? 0)
  modalTitle.value = t('system.menu.add')
  modalOpen.value = true
}

async function openEdit(row: SysMenu) {
  try {
    const result = await getMenuApi(row.id!)
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.menu.loadFailed'))
    }
    form.value = { ...result.data }
    modalTitle.value = t('system.menu.edit')
    modalOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.menu.loadFailed'))
  }
}

function closeModal() {
  modalOpen.value = false
  form.value = createEmptyMenu()
}

function validateForm() {
  if (!form.value.menuName?.trim()) return t('system.menu.nameRequired')
  if (form.value.orderNum == null || form.value.orderNum < 0) return t('system.menu.orderRequired')
  if (form.value.menuType !== 'F' && !form.value.path?.trim()) return t('system.menu.pathRequired')
  if (form.value.menuType === 'C' && !form.value.component?.trim()) return t('system.menu.componentRequired')
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
    const payload: SysMenu = {
      ...form.value,
      menuName: form.value.menuName.trim(),
      parentId: Number(form.value.parentId) || 0,
      orderNum: Number(form.value.orderNum) || 0,
      status: Number(form.value.status ?? 1),
    }
    const result = form.value.id
      ? await updateMenuApi(payload)
      : await addMenuApi(payload)

    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.menu.saveFailed'))
    }

    showToast('success', form.value.id ? t('system.menu.updateOk') : t('system.menu.createOk'))
    closeModal()
    await loadMenus()
    await loadDynamicRoutes(true)
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.menu.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function removeMenu(row: SysMenu) {
  if (!(await confirm({ message: t('system.menu.deleteConfirm', { name: row.menuName }) }))) return

  try {
    const result = await deleteMenuApi(row.id!)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.menu.deleteFailed'))
    }
    showToast('success', t('system.menu.deleteOk'))
    await loadMenus()
    await loadDynamicRoutes(true)
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.menu.deleteFailed'))
  }
}

onMounted(loadMenus)
</script>

<template>
  <div class="page-stack">
    <div class="card p-5">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <form class="form-search-toolbar contents" @submit.prevent="loadMenus">
          <FormField :label="t('system.menu.name')" horizontal class="form-field-search">
            <input
              v-model="query.menuName"
              type="text"
              class="field-input"
              :placeholder="t('system.menu.namePlaceholder')"
            />
          </FormField>
          <FormField :label="t('system.menu.status')" horizontal class="form-field-search">
            <select v-model="query.status" class="field-input">
              <option value="">{{ t('system.menu.statusAll') }}</option>
              <option :value="1">{{ t('system.menu.statusOn') }}</option>
              <option :value="0">{{ t('system.menu.statusOff') }}</option>
            </select>
          </FormField>
          <button type="submit" class="btn-primary shrink-0">
            <Search class="h-4 w-4" /> {{ t('system.menu.search') }}
          </button>
          <button type="button" class="btn-ghost shrink-0" @click="resetQuery">
            <RefreshCw class="h-4 w-4" /> {{ t('system.menu.reset') }}
          </button>
        </form>
        <div class="toolbar-actions">
          <button type="button" class="btn-primary shrink-0" @click="openCreate()">
            <Plus class="h-4 w-4" /> {{ t('system.menu.add') }}
          </button>
          <button type="button" class="btn-tree-toggle shrink-0" @click="toggleTreeExpand(menuTree)">
            <UnfoldVertical v-if="isFullyCollapsed" class="h-4 w-4 text-gray-400" />
            <FoldVertical v-else class="h-4 w-4 text-gray-400" />
            {{ treeExpandLabel }}
          </button>
        </div>
      </div>

      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[960px] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-400 dark:bg-white/5">
            <tr>
              <th class="px-4 py-3">{{ t('system.menu.name') }}</th>
              <th class="px-4 py-3">{{ t('system.menu.icon') }}</th>
              <th class="px-4 py-3">{{ t('system.menu.sort') }}</th>
              <th class="px-4 py-3">{{ t('system.menu.perms') }}</th>
              <th class="px-4 py-3">{{ t('system.menu.component') }}</th>
              <th class="px-4 py-3">{{ t('system.menu.type') }}</th>
              <th class="px-4 py-3">{{ t('system.menu.status') }}</th>
              <th class="px-4 py-3 text-right">{{ t('system.menu.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="px-4 py-10 text-center text-gray-400">{{ t('system.menu.loading') }}</td>
            </tr>
            <tr v-else-if="!flatRows.length">
              <td colspan="8" class="px-4 py-10 text-center text-gray-400">{{ t('system.menu.empty') }}</td>
            </tr>
            <tr
              v-for="row in flatRows"
              v-else
              :key="String(row.id)"
              class="border-t border-gray-50 transition hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-1" :style="{ paddingLeft: `${row.depth * 20}px` }">
                  <button
                    v-if="row.hasChildren"
                    type="button"
                    class="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
                    @click="toggleExpand(String(row.id))"
                  >
                    <ChevronDown v-if="expanded.has(String(row.id))" class="h-4 w-4" />
                    <ChevronRight v-else class="h-4 w-4" />
                  </button>
                  <span v-else class="w-5" />
                  <span class="font-medium text-gray-900 dark:text-white">{{ row.menuName }}</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <component :is="resolveMenuIcon(row.icon)" class="h-4 w-4 shrink-0 text-gray-500" />
                  <span class="truncate">{{ getMenuIconLabel(row.icon, t) }}</span>
                </div>
              </td>
              <td class="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">{{ row.orderNum ?? '-' }}</td>
              <td class="max-w-[160px] truncate px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.perms || '-' }}</td>
              <td class="max-w-[180px] truncate px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.component || '-' }}</td>
              <td class="px-4 py-3">
                <span class="badge bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">{{ menuTypeLabel(row.menuType) }}</span>
              </td>
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
              <td class="px-4 py-3">
                <div class="btn-action-group">
                  <button type="button" class="btn-action-edit" @click="openEdit(row)">
                    <Pencil class="h-3.5 w-3.5" />
                    {{ t('system.menu.edit') }}
                  </button>
                  <button type="button" class="btn-action-add-child" @click="openCreate(row)">
                    <Plus class="h-3.5 w-3.5" />
                    {{ t('system.menu.addChild') }}
                  </button>
                  <button type="button" class="btn-action-danger" @click="removeMenu(row)">
                    <Trash2 class="h-3.5 w-3.5" />
                    {{ t('system.menu.delete') }}
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
            <FormField :label="t('system.menu.parent')" horizontal class="form-field-span-2">
              <select v-model="form.parentId" class="field-input">
                <option v-for="opt in parentOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.menu.type')" horizontal class="form-field-span-2">
              <div class="form-row-inline">
                <label class="inline-flex items-center gap-2 text-sm">
                  <input v-model="form.menuType" type="radio" value="M" /> {{ t('system.menu.typeDir') }}
                </label>
                <label class="inline-flex items-center gap-2 text-sm">
                  <input v-model="form.menuType" type="radio" value="C" /> {{ t('system.menu.typeMenu') }}
                </label>
                <label class="inline-flex items-center gap-2 text-sm">
                  <input v-model="form.menuType" type="radio" value="F" /> {{ t('system.menu.typeButton') }}
                </label>
              </div>
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.menu.name')" horizontal required>
              <input v-model="form.menuName" type="text" class="field-input" />
            </FormField>
            <FormField :label="t('system.menu.sort')" horizontal required>
              <input v-model.number="form.orderNum" type="number" min="0" class="field-input" />
            </FormField>
          </div>
          <div v-if="form.menuType !== 'F'" class="form-grid-row">
            <FormField :label="t('system.menu.icon')" horizontal>
              <MenuIconPicker v-model="form.icon" />
            </FormField>
            <FormField :label="t('system.menu.path')" horizontal required>
              <input v-model="form.path" type="text" class="field-input" />
            </FormField>
          </div>
          <div v-if="form.menuType === 'C'" class="form-grid-row">
            <FormField :label="t('system.menu.component')" horizontal required class="form-field-span-2">
              <input v-model="form.component" type="text" class="field-input" placeholder="system/menu/index" />
            </FormField>
          </div>
          <div v-if="form.menuType !== 'M'" class="form-grid-row">
            <FormField :label="t('system.menu.perms')" horizontal class="form-field-span-2">
              <input v-model="form.perms" type="text" class="field-input" placeholder="system:menu:list" />
            </FormField>
          </div>
          <div v-if="form.menuType !== 'F'" class="form-grid-row">
            <FormField :label="t('system.menu.status')" horizontal class="form-field-span-2">
              <div class="form-row-inline">
                <label class="inline-flex items-center gap-2 text-sm">
                  <input v-model.number="form.status" type="radio" :value="1" /> {{ t('system.menu.statusOn') }}
                </label>
                <label class="inline-flex items-center gap-2 text-sm">
                  <input v-model.number="form.status" type="radio" :value="0" /> {{ t('system.menu.statusOff') }}
                </label>
              </div>
            </FormField>
          </div>
        </div>
      </form>

      <template #footer>
        <button type="button" class="btn-ghost" @click="closeModal">{{ t('system.menu.cancel') }}</button>
        <button type="button" class="btn-primary" :disabled="saving" @click="submitForm">
          {{ saving ? t('system.menu.saving') : t('system.menu.save') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
