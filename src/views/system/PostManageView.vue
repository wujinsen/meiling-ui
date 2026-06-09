<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  addPostApi,
  deletePostApi,
  getPostApi,
  listPostApi,
  updatePostApi,
} from '@/api/post'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import { confirm } from '@/composables/useConfirm'
import { showToast } from '@/composables/useToast'
import AppPagination from '@/components/ui/AppPagination.vue'
import { API_SUCCESS_CODE } from '@/types/api'
import { createEmptyPost, type PostQuery, type SysPost } from '@/types/post'
import { Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-vue-next'

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const postList = ref<SysPost[]>([])
const total = ref(0)
const modalOpen = ref(false)
const modalTitle = ref('')
const form = ref<SysPost>(createEmptyPost())
const isEdit = computed(() => form.value.id != null)

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  postCode: '',
  postName: '',
  status: '' as PostQuery['status'],
})

function statusLabel(status?: number) {
  return status === 1 ? t('system.post.statusOn') : t('system.post.statusOff')
}

function formatTime(value?: string | number) {
  if (value == null || value === '') return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

function searchPosts() {
  if (query.pageNum === 1) loadPosts()
  else query.pageNum = 1
}

function resetQuery() {
  query.postCode = ''
  query.postName = ''
  query.status = ''
  searchPosts()
}

async function loadPosts() {
  loading.value = true
  try {
    const result = await listPostApi({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      postCode: query.postCode || undefined,
      postName: query.postName || undefined,
      status: query.status === '' ? undefined : query.status,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.post.loadFailed'))
    }
    postList.value = result.data.list ?? []
    total.value = result.data.total ?? 0
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.post.loadFailed'))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.value = createEmptyPost()
  modalTitle.value = t('system.post.add')
  modalOpen.value = true
}

async function openEdit(row: SysPost) {
  try {
    const result = await getPostApi(row.id!)
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.post.loadFailed'))
    }
    form.value = { ...result.data }
    modalTitle.value = t('system.post.edit')
    modalOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.post.loadFailed'))
  }
}

function closeModal() {
  modalOpen.value = false
  form.value = createEmptyPost()
}

function validateForm() {
  if (!form.value.postName?.trim()) return t('system.post.postNameRequired')
  if (!form.value.postCode?.trim()) return t('system.post.postCodeRequired')
  if (form.value.sort == null || form.value.sort < 0) return t('system.post.sortRequired')
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
    const payload: SysPost = {
      ...form.value,
      postName: form.value.postName!.trim(),
      postCode: form.value.postCode!.trim(),
      sort: Number(form.value.sort ?? 0),
      status: Number(form.value.status ?? 1),
      remark: form.value.remark?.trim() || undefined,
    }

    const result = isEdit.value ? await updatePostApi(payload) : await addPostApi(payload)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.post.saveFailed'))
    }

    showToast('success', isEdit.value ? t('system.post.updateOk') : t('system.post.createOk'))
    closeModal()
    await loadPosts()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.post.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function removePost(row: SysPost) {
  if (!(await confirm({ message: t('system.post.deleteConfirm', { name: row.postName }) }))) return

  try {
    const result = await deletePostApi(row.id!)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.post.deleteFailed'))
    }
    showToast('success', t('system.post.deleteOk'))
    await loadPosts()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.post.deleteFailed'))
  }
}

watch(
  () => query.pageNum,
  () => loadPosts(),
)

onMounted(loadPosts)
</script>

<template>
  <div class="page-stack">
    <div class="card p-5">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <form class="form-search-toolbar contents" @submit.prevent="searchPosts">
          <FormField :label="t('system.post.postCode')" horizontal class="form-field-search">
            <input
              v-model="query.postCode"
              type="text"
              class="field-input"
              :placeholder="t('system.post.postCodePlaceholder')"
            />
          </FormField>
          <FormField :label="t('system.post.postName')" horizontal class="form-field-search">
            <input
              v-model="query.postName"
              type="text"
              class="field-input"
              :placeholder="t('system.post.postNamePlaceholder')"
            />
          </FormField>
          <FormField :label="t('system.post.status')" horizontal class="form-field-search">
            <select v-model="query.status" class="field-input">
              <option value="">{{ t('system.post.statusAll') }}</option>
              <option :value="1">{{ t('system.post.statusOn') }}</option>
              <option :value="0">{{ t('system.post.statusOff') }}</option>
            </select>
          </FormField>
          <button type="submit" class="btn-primary shrink-0">
            <Search class="h-4 w-4" /> {{ t('system.post.search') }}
          </button>
          <button type="button" class="btn-ghost shrink-0" @click="resetQuery">
            <RefreshCw class="h-4 w-4" /> {{ t('system.post.reset') }}
          </button>
        </form>
        <div class="toolbar-actions">
          <button type="button" class="btn-primary shrink-0" @click="openCreate">
            <Plus class="h-4 w-4" /> {{ t('system.post.add') }}
          </button>
        </div>
      </div>

      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[800px] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-400 dark:bg-white/5">
            <tr>
              <th class="px-4 py-3">{{ t('system.post.id') }}</th>
              <th class="px-4 py-3">{{ t('system.post.postName') }}</th>
              <th class="px-4 py-3">{{ t('system.post.postCode') }}</th>
              <th class="px-4 py-3">{{ t('system.post.sort') }}</th>
              <th class="px-4 py-3">{{ t('system.post.status') }}</th>
              <th class="px-4 py-3">{{ t('system.post.createTime') }}</th>
              <th class="px-4 py-3 text-right">{{ t('system.post.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="px-4 py-10 text-center text-gray-400">{{ t('system.post.loading') }}</td>
            </tr>
            <tr v-else-if="!postList.length">
              <td colspan="7" class="px-4 py-10 text-center text-gray-400">{{ t('system.post.empty') }}</td>
            </tr>
            <tr
              v-for="row in postList"
              v-else
              :key="String(row.id)"
              class="border-t border-gray-50 transition hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5"
            >
              <td class="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">{{ row.id }}</td>
              <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ row.postName }}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.postCode }}</td>
              <td class="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">{{ row.sort ?? '-' }}</td>
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
                    {{ t('system.post.edit') }}
                  </button>
                  <button type="button" class="btn-action-danger" @click="removePost(row)">
                    <Trash2 class="h-3.5 w-3.5" />
                    {{ t('system.post.delete') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="total > 0" class="mt-4">
        <AppPagination v-model:page-num="query.pageNum" :page-size="query.pageSize" :total="total" />
      </div>
    </div>

    <AppModal :open="modalOpen" :title="modalTitle" wide @close="closeModal">
      <form class="form-modal" @submit.prevent="submitForm">
        <div class="form-grid-pairs">
          <div class="form-grid-row">
            <FormField :label="t('system.post.postName')" horizontal required>
              <input v-model="form.postName" type="text" class="field-input" />
            </FormField>
            <FormField :label="t('system.post.postCode')" horizontal required>
              <input v-model="form.postCode" type="text" class="field-input" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.post.sort')" horizontal required>
              <input v-model.number="form.sort" type="number" min="0" class="field-input" />
            </FormField>
            <FormField :label="t('system.post.status')" horizontal>
              <div class="form-row-inline">
                <label class="inline-flex items-center gap-2 text-sm">
                  <input v-model.number="form.status" type="radio" :value="1" /> {{ t('system.post.statusOn') }}
                </label>
                <label class="inline-flex items-center gap-2 text-sm">
                  <input v-model.number="form.status" type="radio" :value="0" /> {{ t('system.post.statusOff') }}
                </label>
              </div>
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.post.remark')" horizontal class="form-field-span-2">
              <textarea v-model="form.remark" rows="3" class="field-input resize-y" />
            </FormField>
          </div>
        </div>
      </form>

      <template #footer>
        <button type="button" class="btn-ghost" @click="closeModal">{{ t('system.post.cancel') }}</button>
        <button type="button" class="btn-primary" :disabled="saving" @click="submitForm">
          {{ saving ? t('system.post.saving') : t('system.post.save') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
