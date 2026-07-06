<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, ChevronRight, FolderPlus, Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import KbCategorySelect from '@/components/knowledge/KbCategorySelect.vue'
import { deleteKbCategoryApi, getKbCategoryTreeApi, saveKbCategoryApi } from '@/api/knowledge'
import { confirm } from '@/composables/useConfirm'
import { guardAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbCategoryTree } from '@/types/knowledge'
import { PERM } from '@/constants/permissions'
import { useTreeExpand } from '@/composables/useTreeExpand'
import { flattenKbCategoryTree } from '@/utils/kbCategoryTree'
import { flattenVisibleTree } from '@/utils/tree'
import { toEntityId, toParentId } from '@/utils/id'

const props = defineProps<{
  spaceId: string
}>()

const emit = defineEmits<{
  changed: []
}>()

const { t } = useI18n()
const loading = ref(false)
const saving = ref(false)
const tree = ref<KbCategoryTree[]>([])
const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const form = ref({
  categoryName: '',
  parentId: '0',
  dirSlug: '',
  sort: 0,
})
const DIR_SLUG_RE = /^[A-Za-z0-9_-]{1,64}$/

const { expanded, toggleExpand, expandAllIfEmpty } = useTreeExpand()

const flatCategories = computed(() => flattenKbCategoryTree(tree.value))
const flatRows = computed(() => flattenVisibleTree(tree.value, expanded.value))
const categoryCount = computed(() => flatCategories.value.length)
const modalTitle = computed(() =>
  editingId.value ? t('knowledge.taxManage.editCategory') : t('knowledge.taxManage.addCategory'),
)
const parentOptions = computed(() => {
  if (!editingId.value) return flatCategories.value
  return flatCategories.value.filter((opt) => opt.id !== editingId.value)
})

async function loadTree() {
  if (!props.spaceId) {
    tree.value = []
    return
  }
  loading.value = true
  try {
    const res = await getKbCategoryTreeApi(props.spaceId, true)
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      throw new Error(res.msg || t('knowledge.taxManage.loadFailed'))
    }
    tree.value = res.data
    expandAllIfEmpty(tree.value)
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.taxManage.loadFailed'))
    tree.value = []
  } finally {
    loading.value = false
  }
}

function openCreate(parentId?: string) {
  if (!guardAction(PERM.KB_DOCUMENT_EDIT)) return
  editingId.value = null
  form.value = { categoryName: '', parentId: parentId ?? '', dirSlug: '', sort: 0 }
  modalOpen.value = true
}

function openEdit(row: KbCategoryTree) {
  if (!guardAction(PERM.KB_DOCUMENT_EDIT)) return
  const id = toEntityId(row.id)
  if (!id) return
  editingId.value = id
  form.value = {
    categoryName: row.categoryName,
    parentId: toEntityId(row.parentId) ?? '0',
    dirSlug: row.dirSlug ?? '',
    sort: row.sort ?? 0,
  }
  modalOpen.value = true
}

async function submit() {
  if (!props.spaceId || !form.value.categoryName.trim()) {
    showToast('error', t('knowledge.taxManage.nameRequired'))
    return
  }
  if (!editingId.value && !DIR_SLUG_RE.test(form.value.dirSlug.trim())) {
    showToast('error', '目录名(dir_slug)非法：仅英文/数字/连字符/下划线，单段')
    return
  }
  saving.value = true
  try {
    const payload = {
      id: editingId.value ?? undefined,
      spaceId: props.spaceId,
      parentId: toParentId(form.value.parentId === '' ? 0 : form.value.parentId),
      categoryName: form.value.categoryName.trim(),
      dirSlug: editingId.value ? undefined : form.value.dirSlug.trim(),
      sort: form.value.sort,
    }
    const res = await saveKbCategoryApi(payload)
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.taxManage.saveFailed'))
    showToast('success', t('knowledge.taxManage.saveOk'))
    modalOpen.value = false
    await loadTree()
    emit('changed')
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.taxManage.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function remove(row: KbCategoryTree) {
  if (!guardAction(PERM.KB_DOCUMENT_EDIT)) return
  const id = toEntityId(row.id)
  if (!id) return
  const ok = await confirm({
    title: t('confirm.deleteTitle'),
    message: t('knowledge.taxManage.deleteCategoryConfirm', { name: row.categoryName }),
    confirmText: t('confirm.confirm'),
    cancelText: t('confirm.cancel'),
    danger: true,
  })
  if (!ok) return
  try {
    const res = await deleteKbCategoryApi(id)
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.taxManage.deleteFailed'))
    showToast('success', t('knowledge.taxManage.deleteOk'))
    await loadTree()
    emit('changed')
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.taxManage.deleteFailed'))
  }
}

watch(
  () => props.spaceId,
  () => void loadTree(),
  { immediate: true },
)
</script>

<template>
  <div class="card p-4">
    <div class="flex flex-wrap items-center justify-end gap-2">
      <button type="button" class="btn-primary shrink-0" @click="openCreate()">
        <Plus class="h-4 w-4" /> {{ t('knowledge.taxManage.addRootCategory') }}
      </button>
      <button type="button" class="btn-ghost shrink-0" :disabled="loading" @click="loadTree">
        <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
        <RefreshCw v-else class="h-4 w-4" />
      </button>
    </div>
  </div>

  <div class="card p-5">
    <p class="mb-1 text-xs text-gray-400">
      {{ t('knowledge.taxManage.categorySummary', { count: categoryCount }) }}
    </p>
    <p class="mb-4 text-xs text-gray-400">{{ t('knowledge.taxManage.categoryHint') }}</p>

    <div class="data-table-scroll overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
      <table class="data-table w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr>
            <th>{{ t('knowledge.taxManage.colName') }}</th>
            <th>目录</th>
            <th>文档数</th>
            <th>{{ t('knowledge.taxManage.colSort') }}</th>
            <th class="data-table-sticky-end text-right">{{ t('knowledge.docManage.colActions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-12 text-center text-gray-400">{{ t('common.loading') }}</td>
          </tr>
          <tr v-else-if="!flatRows.length">
            <td colspan="5" class="px-4 py-12 text-center text-gray-400">{{ t('knowledge.taxManage.categoryEmpty') }}</td>
          </tr>
          <tr v-for="row in flatRows" v-else :key="String(row.id)">
            <td>
              <div class="flex items-center gap-1" :style="{ paddingLeft: `${row.depth * 16}px` }">
                <button
                  v-if="row.hasChildren"
                  type="button"
                  class="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
                  @click="toggleExpand(String(row.id))"
                >
                  <ChevronDown v-if="expanded.has(String(row.id))" class="h-3.5 w-3.5" />
                  <ChevronRight v-else class="h-3.5 w-3.5" />
                </button>
                <span v-else class="w-5 shrink-0" />
                <span class="font-medium">{{ row.categoryName }}</span>
              </div>
            </td>
            <td class="text-gray-500">
              <code v-if="row.dirSlug" class="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-white/10">{{ row.dirSlug }}/</code>
              <span v-else class="text-gray-300">—</span>
            </td>
            <td class="text-gray-500">{{ row.docCount ?? 0 }}</td>
            <td class="text-gray-500">{{ row.sort ?? 0 }}</td>
            <td class="data-table-sticky-end text-right">
              <div class="btn-action-group justify-end">
                <button type="button" class="btn-action-edit" @click="openCreate(String(row.id))">
                  <FolderPlus class="h-3.5 w-3.5" />{{ t('knowledge.taxManage.addChild') }}
                </button>
                <button type="button" class="btn-action-edit" @click="openEdit(row)">
                  <Pencil class="h-3.5 w-3.5" />{{ t('knowledge.docManage.edit') }}
                </button>
                <button type="button" class="btn-action-danger" @click="remove(row)">
                  <Trash2 class="h-3.5 w-3.5" />{{ t('knowledge.docManage.delete') }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AppModal :open="modalOpen" :title="modalTitle" wide @close="modalOpen = false">
      <form class="form-modal" novalidate @submit.prevent="submit">
        <div class="form-grid-pairs">
          <div v-if="!editingId" class="form-grid-row">
            <FormField :label="t('knowledge.taxManage.colParent')" horizontal class="form-field-span-2">
              <KbCategorySelect
                v-model="form.parentId"
                :options="parentOptions"
                :empty-label="t('knowledge.taxManage.rootCategory')"
              />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('knowledge.taxManage.colName')" horizontal required>
              <input v-model="form.categoryName" type="text" class="field-input" />
            </FormField>
            <FormField :label="t('knowledge.taxManage.colSort')" horizontal>
              <input v-model.number="form.sort" type="number" min="0" class="field-input" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField
              label="目录 (dir_slug)"
              horizontal
              class="form-field-span-2"
              :required="!editingId"
              :hint="editingId ? '目录绑定后不可修改' : '创建分类会在该空间 wiki 下新建此子目录'"
            >
              <input
                v-model="form.dirSlug"
                type="text"
                class="field-input"
                :disabled="!!editingId"
                placeholder="如 guides（仅英文/数字/-/_，创建后不可改）"
              />
            </FormField>
          </div>
        </div>
      </form>
      <template #footer>
        <button type="button" class="btn-ghost" @click="modalOpen = false">{{ t('confirm.cancel') }}</button>
        <button type="button" class="btn-primary" :disabled="saving" @click="submit">
          {{ saving ? t('common.loading') : t('confirm.ok') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
