<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import KbSpaceDropdown from '@/components/knowledge/KbSpaceDropdown.vue'
import { saveKbDocumentApi } from '@/api/knowledge'
import { API_SUCCESS_CODE } from '@/types/api'
import { showToast } from '@/composables/useToast'
import { toEntityId } from '@/utils/id'

const props = defineProps<{
  open: boolean
  defaultSpaceId?: string
}>()

const emit = defineEmits<{
  close: []
  created: [id: string]
}>()

const { t } = useI18n()

const spaceId = ref('')
const title = ref('')
const saving = ref(false)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    title.value = ''
    spaceId.value = props.defaultSpaceId ?? ''
  },
  { immediate: true },
)

watch(
  () => props.defaultSpaceId,
  (id) => {
    if (id && props.open) spaceId.value = id
  },
)

const canSubmit = computed(() => title.value.trim().length > 0 && spaceId.value !== '' && spaceId.value !== 'all')

async function submit() {
  if (!canSubmit.value || saving.value) return
  saving.value = true
  try {
    const res = await saveKbDocumentApi({
      spaceId: spaceId.value,
      title: title.value.trim(),
      content: '',
      docType: 'markdown',
      status: 0,
    })
    if (res.code !== API_SUCCESS_CODE || res.data == null) {
      throw new Error(res.msg || t('knowledge.docManage.createFailed'))
    }
    const id = toEntityId(res.data)
    if (!id) throw new Error(t('knowledge.docManage.createFailed'))
    showToast('success', t('knowledge.docManage.createOk'))
    emit('created', id)
    emit('close')
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.docManage.createFailed'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal :open="open" :title="t('knowledge.docManage.createTitle')" @close="emit('close')">
    <form class="space-y-4" @submit.prevent="submit">
      <label class="flex flex-col gap-1.5 text-sm">
        <span class="text-gray-500 dark:text-gray-400">{{ t('knowledge.docManage.fieldSpace') }} *</span>
        <KbSpaceDropdown v-model="spaceId" editable-only />
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span class="text-gray-500 dark:text-gray-400">{{ t('knowledge.docManage.fieldTitle') }} *</span>
        <input v-model="title" type="text" class="field-input" :placeholder="t('knowledge.docManage.titlePlaceholder')" />
      </label>
      <p class="text-xs text-gray-400">{{ t('knowledge.docManage.createHint') }}</p>
    </form>
    <template #footer>
      <button type="button" class="btn-ghost" @click="emit('close')">{{ t('confirm.cancel') }}</button>
      <button type="button" class="btn-primary" :disabled="!canSubmit || saving" @click="submit">
        {{ saving ? t('common.loading') : t('knowledge.docManage.createAndEdit') }}
      </button>
    </template>
  </AppModal>
</template>
