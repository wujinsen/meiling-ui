<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import KbSpaceDropdown from '@/components/knowledge/KbSpaceDropdown.vue'
import { showToast } from '@/composables/useToast'
import {
  KB_WIKI_PAGE_TYPES,
  buildNewWikiMarkdown,
  buildWikiPathSlug,
  sanitizeWikiSlugSegment,
  stashWikiDraft,
} from '@/utils/kbWikiDraft'

export type WikiCreatePayload = {
  slug: string
  spaceId: string
  title: string
  kbType: string
}

const props = defineProps<{
  open: boolean
  defaultSpaceId?: string
}>()

const emit = defineEmits<{
  close: []
  'wiki-created': [payload: WikiCreatePayload]
}>()

const { t } = useI18n()

const spaceId = ref('')
const title = ref('')
const kbType = ref<(typeof KB_WIKI_PAGE_TYPES)[number]>('article')
const slugSegment = ref('')
const slugTouched = ref(false)

const kbTypeOptions = computed(() =>
  KB_WIKI_PAGE_TYPES.map((value) => ({
    value,
    label: t(`knowledge.docManage.kbType.${value}`),
  })),
)

const pathSlug = computed(() => buildWikiPathSlug(kbType.value, title.value, slugSegment.value))

watch(
  () => props.open,
  (open) => {
    if (!open) return
    title.value = ''
    kbType.value = 'article'
    slugSegment.value = ''
    slugTouched.value = false
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

watch(title, (next) => {
  if (!slugTouched.value) slugSegment.value = sanitizeWikiSlugSegment(next)
})

const canSubmit = computed(
  () => title.value.trim().length > 0 && pathSlug.value.length > 0 && spaceId.value !== '' && spaceId.value !== 'all',
)

function submit() {
  if (!canSubmit.value) return
  const trimmedTitle = title.value.trim()
  const slug = pathSlug.value
  const sid = spaceId.value
  const content = buildNewWikiMarkdown(trimmedTitle, slug, kbType.value)
  stashWikiDraft(sid, slug, content)
  emit('wiki-created', { slug, spaceId: sid, title: trimmedTitle, kbType: kbType.value })
  emit('close')
  showToast('success', t('knowledge.docManage.createOk'))
}
</script>

<template>
  <AppModal :open="open" :title="t('knowledge.docManage.createTitle')" @close="emit('close')">
    <form class="space-y-4" @submit.prevent="submit">
      <label class="flex flex-col gap-1.5 text-sm">
        <span class="text-gray-500 dark:text-gray-400">{{ t('knowledge.docManage.fieldSpace') }} *</span>
        <KbSpaceDropdown v-model="spaceId" editable-only value-field="id" />
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span class="text-gray-500 dark:text-gray-400">{{ t('knowledge.docManage.fieldTitle') }} *</span>
        <input v-model="title" type="text" class="field-input" :placeholder="t('knowledge.docManage.titlePlaceholder')" />
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span class="text-gray-500 dark:text-gray-400">{{ t('knowledge.docManage.fieldKbType') }} *</span>
        <select v-model="kbType" class="field-input">
          <option v-for="opt in kbTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span class="text-gray-500 dark:text-gray-400">{{ t('knowledge.docManage.fieldSlug') }}</span>
        <div class="flex items-center gap-1 font-mono text-xs text-gray-400">
          <span>{{ kbType }}/</span>
          <input
            v-model="slugSegment"
            type="text"
            class="field-input flex-1 font-mono text-sm"
            :placeholder="t('knowledge.docManage.slugPlaceholder')"
            @input="slugTouched = true"
          />
        </div>
        <span class="text-xs text-gray-400">{{ t('knowledge.docManage.slugHint', { slug: pathSlug }) }}</span>
      </label>
      <p class="text-xs text-gray-400">{{ t('knowledge.docManage.createHint') }}</p>
    </form>
    <template #footer>
      <button type="button" class="btn-ghost" @click="emit('close')">{{ t('confirm.cancel') }}</button>
      <button type="button" class="btn-primary" :disabled="!canSubmit" @click="submit">
        {{ t('knowledge.docManage.createAndEdit') }}
      </button>
    </template>
  </AppModal>
</template>
