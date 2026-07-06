<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import { deleteKbTagApi, listKbTagsApi, saveKbTagApi } from '@/api/knowledge'
import { confirm } from '@/composables/useConfirm'
import { guardAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbTag } from '@/types/knowledge'
import { PERM } from '@/constants/permissions'
import { toEntityId } from '@/utils/id'

const props = defineProps<{
  spaceId: string
}>()

const emit = defineEmits<{
  changed: []
}>()

const { t } = useI18n()
const loading = ref(false)
const saving = ref(false)
const tags = ref<KbTag[]>([])
const keyword = ref('')
const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const form = ref({
  tagName: '',
  color: '',
})

const filteredTags = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return tags.value
  return tags.value.filter((tag) => tag.tagName.toLowerCase().includes(kw))
})

const modalTitle = computed(() =>
  editingId.value ? t('knowledge.taxManage.editTag') : t('knowledge.taxManage.addTag'),
)

async function loadTags() {
  if (!props.spaceId) {
    tags.value = []
    return
  }
  loading.value = true
  try {
    const res = await listKbTagsApi(props.spaceId)
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      throw new Error(res.msg || t('knowledge.taxManage.loadFailed'))
    }
    tags.value = res.data
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.taxManage.loadFailed'))
    tags.value = []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  if (!guardAction(PERM.KB_DOCUMENT_EDIT)) return
  editingId.value = null
  form.value = { tagName: '', color: '' }
  modalOpen.value = true
}

function openEdit(row: KbTag) {
  if (!guardAction(PERM.KB_DOCUMENT_EDIT)) return
  const id = toEntityId(row.id)
  if (!id) return
  editingId.value = id
  form.value = { tagName: row.tagName, color: row.color ?? '' }
  modalOpen.value = true
}

function resetSearch() {
  keyword.value = ''
}

async function submit() {
  if (!props.spaceId || !form.value.tagName.trim()) {
    showToast('error', t('knowledge.taxManage.nameRequired'))
    return
  }
  saving.value = true
  try {
    const res = await saveKbTagApi({
      id: editingId.value ?? undefined,
      spaceId: props.spaceId,
      tagName: form.value.tagName.trim(),
      color: form.value.color.trim() || undefined,
    })
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.taxManage.saveFailed'))
    showToast('success', t('knowledge.taxManage.saveOk'))
    modalOpen.value = false
    await loadTags()
    emit('changed')
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.taxManage.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function remove(row: KbTag) {
  if (!guardAction(PERM.KB_DOCUMENT_EDIT)) return
  const id = toEntityId(row.id)
  if (!id) return
  const ok = await confirm({
    title: t('confirm.deleteTitle'),
    message: t('knowledge.taxManage.deleteTagConfirm', { name: row.tagName }),
    confirmText: t('confirm.confirm'),
    cancelText: t('confirm.cancel'),
    danger: true,
  })
  if (!ok) return
  try {
    const res = await deleteKbTagApi(id)
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.taxManage.deleteFailed'))
    showToast('success', t('knowledge.taxManage.deleteOk'))
    await loadTags()
    emit('changed')
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.taxManage.deleteFailed'))
  }
}

function tagStyle(color?: string) {
  if (!color) return undefined
  return { backgroundColor: `${color}22`, color, borderColor: `${color}55` }
}

watch(
  () => props.spaceId,
  () => void loadTags(),
  { immediate: true },
)
</script>

<template>
  <div class="card p-4">
    <div class="flex flex-wrap items-center gap-2">
      <form class="flex min-w-0 flex-1 flex-wrap items-center gap-2" @submit.prevent>
        <div class="relative min-w-[12rem] flex-1">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            v-model="keyword"
            type="search"
            class="field-input w-full pl-9"
            :placeholder="t('knowledge.docManage.tagSearchPlaceholder')"
          />
        </div>
        <button type="button" class="btn-ghost shrink-0" @click="resetSearch">
          <RefreshCw class="h-4 w-4" /> {{ t('knowledge.docManage.reset') }}
        </button>
      </form>
      <button type="button" class="btn-primary shrink-0" @click="openCreate">
        <Plus class="h-4 w-4" /> {{ t('knowledge.taxManage.addTag') }}
      </button>
      <button type="button" class="btn-ghost shrink-0" :disabled="loading" @click="loadTags">
        <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
        <RefreshCw v-else class="h-4 w-4" />
      </button>
    </div>
  </div>

  <div class="card p-5">
    <p class="mb-4 text-xs text-gray-400">
      {{ t('knowledge.taxManage.tagSummary', { count: filteredTags.length, total: tags.length }) }}
    </p>

    <div class="data-table-scroll overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
      <table class="data-table w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr>
            <th>{{ t('knowledge.taxManage.colName') }}</th>
            <th>{{ t('knowledge.taxManage.colColor') }}</th>
            <th class="data-table-sticky-end text-right">{{ t('knowledge.docManage.colActions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="3" class="px-4 py-12 text-center text-gray-400">{{ t('common.loading') }}</td>
          </tr>
          <tr v-else-if="!filteredTags.length">
            <td colspan="3" class="px-4 py-12 text-center text-gray-400">{{ t('knowledge.docManage.tagsEmpty') }}</td>
          </tr>
          <tr v-for="row in filteredTags" v-else :key="String(row.id)">
            <td class="max-w-[240px]">
              <span class="kb-tag-chip max-w-full truncate" :style="tagStyle(row.color)" :title="row.tagName">
                {{ row.tagName }}
              </span>
            </td>
            <td class="text-gray-500">
              <span v-if="row.color" class="inline-flex items-center gap-2">
                <span
                  class="inline-block h-4 w-4 shrink-0 rounded border border-gray-200 dark:border-white/10"
                  :style="{ backgroundColor: row.color }"
                />
                <span class="font-mono text-xs">{{ row.color }}</span>
              </span>
              <span v-else class="text-gray-300">—</span>
            </td>
            <td class="data-table-sticky-end text-right">
              <div class="btn-action-group justify-end">
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
          <div class="form-grid-row">
            <FormField :label="t('knowledge.taxManage.colName')" horizontal required>
              <input v-model="form.tagName" type="text" class="field-input" />
            </FormField>
            <FormField :label="t('knowledge.taxManage.colColor')" horizontal>
              <div class="flex items-center gap-2">
                <input v-model="form.color" type="text" class="field-input min-w-0 flex-1" :placeholder="t('knowledge.taxManage.colorPlaceholder')" />
                <input v-model="form.color" type="color" class="h-10 w-12 shrink-0 cursor-pointer rounded border border-gray-200 bg-transparent p-1 dark:border-white/10" />
              </div>
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
