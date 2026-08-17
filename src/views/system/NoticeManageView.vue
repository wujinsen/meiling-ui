<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getDictsByTypeApi } from '@/api/dict'
import {
  addNoticeApi,
  deleteNoticeApi,
  getNoticeApi,
  listNoticeApi,
  publishNoticeApi,
  revokeNoticeApi,
  updateNoticeApi,
} from '@/api/notice'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import { confirm } from '@/composables/useConfirm'
import { guardAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { PERM } from '@/constants/permissions'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { API_SUCCESS_CODE } from '@/types/api'
import {
  NOTICE_STATUS_DRAFT,
  NOTICE_STATUS_PUBLISHED,
  NOTICE_STATUS_REVOKED,
  createEmptyNotice,
  type NoticeQuery,
  type SysNotice,
} from '@/types/notice'
import { Eye, Megaphone, Pencil, Plus, RefreshCw, Search, Trash2, Undo2 } from 'lucide-vue-next'
import { renderMarkdown } from '@/utils/markdown'

const { t, locale } = useI18n()

const loading = ref(false)
const saving = ref(false)
const noticeList = ref<SysNotice[]>([])
const total = ref(0)
const modalOpen = ref(false)
const previewOpen = ref(false)
const previewHtml = ref('')
const modalTitle = ref('')
const form = ref<SysNotice>(createEmptyNotice())
const typeOptions = ref<Array<{ label: string; value: number }>>([])

const isEdit = computed(() => form.value.id != null)

const query = reactive({
  pageNum: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  noticeTitle: '',
  noticeType: '' as NoticeQuery['noticeType'],
  status: '' as NoticeQuery['status'],
})

const FALLBACK_TYPES = [
  { value: 1, key: 'notice' },
  { value: 2, key: 'announcement' },
  { value: 3, key: 'maintenance' },
] as const

function formatTime(value?: string | number | null) {
  if (value == null || value === '') return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

function toDatetimeLocal(value?: string | number | null) {
  if (value == null || value === '') return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromDatetimeLocal(value: string) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function statusLabel(status?: number) {
  if (status === NOTICE_STATUS_PUBLISHED) return t('system.notice.statusPublished')
  if (status === NOTICE_STATUS_REVOKED) return t('system.notice.statusRevoked')
  return t('system.notice.statusDraft')
}

function statusBadgeClass(status?: number) {
  if (status === NOTICE_STATUS_PUBLISHED) {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
  }
  if (status === NOTICE_STATUS_REVOKED) {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
  }
  return 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400'
}

function typeLabel(type?: number) {
  const found = typeOptions.value.find((item) => item.value === type)
  if (found) return found.label
  const fallback = FALLBACK_TYPES.find((item) => item.value === type)
  return fallback ? t(`system.notice.type.${fallback.key}`) : String(type ?? '-')
}

async function loadTypeOptions() {
  try {
    const result = await getDictsByTypeApi('sys_notice_type')
    if (result.code === API_SUCCESS_CODE && result.data?.length) {
      typeOptions.value = result.data
        .filter((item) => item.status !== 0)
        .map((item) => ({
          label: pickDictLabel(item),
          value: Number(item.dictValue),
        }))
      return
    }
  } catch {
    /* fallback below */
  }
  typeOptions.value = FALLBACK_TYPES.map((item) => ({
    value: item.value,
    label: t(`system.notice.type.${item.key}`),
  }))
}

function pickDictLabel(item: { dictLabel?: string; dictValue?: string; dictType?: string; status?: number }) {
  if (locale.value === 'en') return item.dictLabel || item.dictValue || ''
  if (locale.value === 'ja') return item.dictLabel || item.dictValue || ''
  return item.dictLabel || item.dictValue || ''
}

function searchNotices() {
  if (query.pageNum === 1) loadNotices()
  else query.pageNum = 1
}

function resetQuery() {
  query.noticeTitle = ''
  query.noticeType = ''
  query.status = ''
  searchNotices()
}

async function loadNotices() {
  loading.value = true
  try {
    const result = await listNoticeApi({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      noticeTitle: query.noticeTitle || undefined,
      noticeType: query.noticeType === '' ? undefined : query.noticeType,
      status: query.status === '' ? undefined : query.status,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.notice.loadFailed'))
    }
    noticeList.value = result.data.list ?? []
    total.value = result.data.total ?? 0
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.notice.loadFailed'))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  if (!guardAction(PERM.NOTICE_ADD)) return
  form.value = createEmptyNotice()
  modalTitle.value = t('system.notice.add')
  modalOpen.value = true
}

async function openEdit(row: SysNotice) {
  if (!guardAction(PERM.NOTICE_EDIT)) return
  try {
    const result = await getNoticeApi(row.id!)
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.notice.loadFailed'))
    }
    form.value = { ...result.data }
    modalTitle.value = t('system.notice.edit')
    modalOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.notice.loadFailed'))
  }
}

async function openPreview(row: SysNotice) {
  try {
    const result = await getNoticeApi(row.id!)
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.notice.loadFailed'))
    }
    previewHtml.value = renderMarkdown(result.data.noticeContent)
    previewOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.notice.loadFailed'))
  }
}

function closeModal() {
  modalOpen.value = false
  form.value = createEmptyNotice()
}

const expireLocal = computed({
  get: () => toDatetimeLocal(form.value.expireTime),
  set: (value: string) => {
    form.value.expireTime = fromDatetimeLocal(value)
  },
})

function validateForm() {
  if (!form.value.noticeTitle?.trim()) return t('system.notice.titleRequired')
  if (form.value.noticeType == null) return t('system.notice.typeRequired')
  return null
}

async function submitForm() {
  if (!guardAction(isEdit.value ? PERM.NOTICE_EDIT : PERM.NOTICE_ADD)) return
  const error = validateForm()
  if (error) {
    showToast('error', error)
    return
  }

  saving.value = true
  try {
    const payload: SysNotice = {
      ...form.value,
      noticeTitle: form.value.noticeTitle!.trim(),
      noticeContent: form.value.noticeContent?.trim() || undefined,
      topFlag: Number(form.value.topFlag ?? 0),
      noticeType: Number(form.value.noticeType),
      expireTime: form.value.expireTime || undefined,
    }

    const result = isEdit.value ? await updateNoticeApi(payload) : await addNoticeApi(payload)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.notice.saveFailed'))
    }

    showToast('success', isEdit.value ? t('system.notice.updateOk') : t('system.notice.createOk'))
    closeModal()
    await loadNotices()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.notice.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function publishNotice(row: SysNotice) {
  if (!guardAction(PERM.NOTICE_EDIT)) return
  if (
    !(await confirm({
      title: t('system.notice.publishTitle'),
      message: t('system.notice.publishConfirm', { name: row.noticeTitle }),
      confirmText: t('system.notice.publishOkBtn'),
      danger: false,
    }))
  ) {
    return
  }
  try {
    const result = await publishNoticeApi(row.id!)
    if (result.code !== API_SUCCESS_CODE) throw new Error(result.msg || t('system.notice.publishFailed'))
    showToast('success', t('system.notice.publishOk'))
    await loadNotices()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.notice.publishFailed'))
  }
}

async function revokeNotice(row: SysNotice) {
  if (!guardAction(PERM.NOTICE_EDIT)) return
  if (
    !(await confirm({
      title: t('system.notice.revokeTitle'),
      message: t('system.notice.revokeConfirm', { name: row.noticeTitle }),
      confirmText: t('system.notice.revokeOkBtn'),
      danger: true,
    }))
  ) {
    return
  }
  try {
    const result = await revokeNoticeApi(row.id!)
    if (result.code !== API_SUCCESS_CODE) throw new Error(result.msg || t('system.notice.revokeFailed'))
    showToast('success', t('system.notice.revokeOk'))
    await loadNotices()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.notice.revokeFailed'))
  }
}

async function removeNotice(row: SysNotice) {
  if (!guardAction(PERM.NOTICE_REMOVE)) return
  if (!(await confirm({ message: t('system.notice.deleteConfirm', { name: row.noticeTitle }) }))) return
  try {
    const result = await deleteNoticeApi(row.id!)
    if (result.code !== API_SUCCESS_CODE) throw new Error(result.msg || t('system.notice.deleteFailed'))
    showToast('success', t('system.notice.deleteOk'))
    await loadNotices()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.notice.deleteFailed'))
  }
}

watch(
  () => [query.pageNum, query.pageSize],
  () => loadNotices(),
)

onMounted(async () => {
  await loadTypeOptions()
  await loadNotices()
})
</script>

<template>
  <div class="page-stack">
    <div class="card p-5">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <form class="form-search-toolbar contents" @submit.prevent="searchNotices">
          <FormField :label="t('system.notice.title')" horizontal class="form-field-search">
            <input
              v-model="query.noticeTitle"
              type="text"
              class="field-input"
              :placeholder="t('system.notice.titlePlaceholder')"
            />
          </FormField>
          <FormField :label="t('system.notice.typeLabel')" horizontal class="form-field-search">
            <select v-model="query.noticeType" class="field-input">
              <option value="">{{ t('system.notice.typeAll') }}</option>
              <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </FormField>
          <FormField :label="t('system.notice.status')" horizontal class="form-field-search">
            <select v-model="query.status" class="field-input">
              <option value="">{{ t('system.notice.statusAll') }}</option>
              <option :value="NOTICE_STATUS_DRAFT">{{ t('system.notice.statusDraft') }}</option>
              <option :value="NOTICE_STATUS_PUBLISHED">{{ t('system.notice.statusPublished') }}</option>
              <option :value="NOTICE_STATUS_REVOKED">{{ t('system.notice.statusRevoked') }}</option>
            </select>
          </FormField>
          <button type="submit" class="btn-primary shrink-0">
            <Search class="h-4 w-4" /> {{ t('system.notice.search') }}
          </button>
          <button type="button" class="btn-ghost shrink-0" @click="resetQuery">
            <RefreshCw class="h-4 w-4" /> {{ t('system.notice.reset') }}
          </button>
        </form>
        <div class="toolbar-actions">
          <button type="button" class="btn-primary shrink-0" @click="openCreate">
            <Plus class="h-4 w-4" /> {{ t('system.notice.add') }}
          </button>
        </div>
      </div>

      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[960px] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-400 dark:bg-white/5">
            <tr>
              <th class="px-4 py-3">{{ t('system.notice.title') }}</th>
              <th class="px-4 py-3">{{ t('system.notice.typeLabel') }}</th>
              <th class="px-4 py-3">{{ t('system.notice.status') }}</th>
              <th class="px-4 py-3">{{ t('system.notice.topFlag') }}</th>
              <th class="px-4 py-3">{{ t('system.notice.publishTime') }}</th>
              <th class="px-4 py-3">{{ t('system.notice.expireTime') }}</th>
              <th class="px-4 py-3 text-right">{{ t('system.notice.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="px-4 py-10 text-center text-gray-400">{{ t('system.notice.loading') }}</td>
            </tr>
            <tr v-else-if="!noticeList.length">
              <td colspan="7" class="px-4 py-10 text-center text-gray-400">{{ t('system.notice.empty') }}</td>
            </tr>
            <tr
              v-for="row in noticeList"
              v-else
              :key="String(row.id)"
              class="border-t border-gray-50 transition hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5"
            >
              <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ row.noticeTitle }}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ typeLabel(row.noticeType) }}</td>
              <td class="px-4 py-3">
                <span :class="['badge', statusBadgeClass(row.status)]">{{ statusLabel(row.status) }}</span>
              </td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
                {{ row.topFlag === 1 ? t('system.notice.topYes') : t('system.notice.topNo') }}
              </td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatTime(row.publishTime) }}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatTime(row.expireTime) }}</td>
              <td class="px-4 py-3">
                <div class="btn-action-group justify-end">
                  <button type="button" class="btn-action-edit" @click="openPreview(row)">
                    <Eye class="h-3.5 w-3.5" />
                    {{ t('system.notice.preview') }}
                  </button>
                  <button type="button" class="btn-action-edit" @click="openEdit(row)">
                    <Pencil class="h-3.5 w-3.5" />
                    {{ t('system.notice.edit') }}
                  </button>
                  <button
                    v-if="row.status === NOTICE_STATUS_DRAFT || row.status === NOTICE_STATUS_REVOKED"
                    type="button"
                    class="btn-action-edit"
                    @click="publishNotice(row)"
                  >
                    <Megaphone class="h-3.5 w-3.5" />
                    {{ t('system.notice.publish') }}
                  </button>
                  <button
                    v-if="row.status === NOTICE_STATUS_PUBLISHED"
                    type="button"
                    class="btn-action-edit"
                    @click="revokeNotice(row)"
                  >
                    <Undo2 class="h-3.5 w-3.5" />
                    {{ t('system.notice.revoke') }}
                  </button>
                  <button type="button" class="btn-action-danger" @click="removeNotice(row)">
                    <Trash2 class="h-3.5 w-3.5" />
                    {{ t('system.notice.delete') }}
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
        <div class="form-grid-pairs">
          <div class="form-grid-row">
            <FormField :label="t('system.notice.title')" horizontal required class="form-field-span-2">
              <input v-model="form.noticeTitle" type="text" class="field-input" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.notice.typeLabel')" horizontal required>
              <select v-model.number="form.noticeType" class="field-input">
                <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </FormField>
            <FormField :label="t('system.notice.topFlag')" horizontal>
              <select v-model.number="form.topFlag" class="field-input">
                <option :value="0">{{ t('system.notice.topNo') }}</option>
                <option :value="1">{{ t('system.notice.topYes') }}</option>
              </select>
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.notice.expireTime')" horizontal class="form-field-span-2">
              <input v-model="expireLocal" type="datetime-local" class="field-input" />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('system.notice.expireHint') }}</p>
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.notice.content')" horizontal class="form-field-span-2">
              <textarea v-model="form.noticeContent" rows="10" class="field-input resize-y font-mono text-sm" />
            </FormField>
          </div>
        </div>
      </form>

      <template #footer>
        <button type="button" class="btn-ghost" @click="closeModal">{{ t('system.notice.cancel') }}</button>
        <button type="button" class="btn-primary" :disabled="saving" @click="submitForm">
          {{ saving ? t('system.notice.saving') : t('system.notice.save') }}
        </button>
      </template>
    </AppModal>

    <AppModal :open="previewOpen" :title="t('system.notice.previewTitle')" wide @close="previewOpen = false">
      <div class="kb-markdown max-h-[60vh] overflow-y-auto" v-html="previewHtml" />
      <template #footer>
        <button type="button" class="btn-ghost" @click="previewOpen = false">{{ t('system.notice.close') }}</button>
      </template>
    </AppModal>
  </div>
</template>
