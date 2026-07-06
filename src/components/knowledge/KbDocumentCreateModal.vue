<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import KbSpaceDropdown from '@/components/knowledge/KbSpaceDropdown.vue'
import { showToast } from '@/composables/useToast'
import { useKbMetaKbTypes } from '@/composables/useKbMetaKbTypes'
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
const { options: metaKbTypes, ensureLoaded: ensureMetaKbTypes } = useKbMetaKbTypes()

const spaceId = ref('')
const spaceError = ref('')
const title = ref('')
const kbType = ref<string>('article')
const slugSegment = ref('')
const slugTouched = ref(false)

const kbTypeOptions = computed(() => {
  if (metaKbTypes.value.length) {
    return metaKbTypes.value.map((opt) => ({ value: opt.value, label: opt.label }))
  }
  return KB_WIKI_PAGE_TYPES.map((value) => ({
    value,
    label: t(`knowledge.docManage.kbType.${value}`),
  }))
})

async function loadMetaKbTypes() {
  const loaded = await ensureMetaKbTypes()
  if (loaded.length && !loaded.some((o) => o.value === kbType.value)) {
    kbType.value = loaded[0]?.value ?? 'article'
  }
}

const pathSlug = computed(() => buildWikiPathSlug(kbType.value, title.value, slugSegment.value))

watch(
  () => props.open,
  (open) => {
    if (!open) return
    title.value = ''
    kbType.value = 'article'
    slugSegment.value = ''
    slugTouched.value = false
    spaceError.value = ''
    spaceId.value = props.defaultSpaceId ?? ''
    void loadMetaKbTypes()
  },
  { immediate: true },
)

watch(
  () => props.defaultSpaceId,
  (id) => {
    if (id && props.open) spaceId.value = id
  },
)

watch(spaceId, () => {
  spaceError.value = ''
})

watch(title, (next) => {
  if (!slugTouched.value) slugSegment.value = sanitizeWikiSlugSegment(next)
})

const canSubmit = computed(
  () => title.value.trim().length > 0 && pathSlug.value.length > 0,
)

function submit() {
  spaceError.value = ''
  if (!spaceId.value || spaceId.value === 'all') {
    spaceError.value = t('knowledge.docManage.createNeedSingleSpace')
    return
  }
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
  <AppModal :open="open" :title="t('knowledge.docManage.createTitle')" wide @close="emit('close')">
    <form class="form-modal" novalidate @submit.prevent="submit">
      <div class="form-grid-pairs">
        <div class="form-grid-row">
          <FormField :label="t('knowledge.docManage.fieldSpace')" horizontal required class="form-field-span-2">
            <KbSpaceDropdown v-model="spaceId" editable-only value-field="id" />
            <p class="form-hint">{{ t('knowledge.docManage.createSpaceHint') }}</p>
            <p v-if="spaceError" class="text-xs text-amber-600 dark:text-amber-400">{{ spaceError }}</p>
          </FormField>
        </div>
        <div class="form-grid-row">
          <FormField :label="t('knowledge.docManage.fieldTitle')" horizontal required>
            <input v-model="title" type="text" class="field-input" :placeholder="t('knowledge.docManage.titlePlaceholder')" />
          </FormField>
          <FormField :label="t('knowledge.docManage.fieldKbType')" horizontal required>
            <select v-model="kbType" class="field-input">
              <option v-for="opt in kbTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </FormField>
        </div>
        <div class="form-grid-row">
          <FormField
            :label="t('knowledge.docManage.fieldSlug')"
            horizontal
            class="form-field-span-2"
            :hint="t('knowledge.docManage.slugHint', { slug: pathSlug })"
          >
            <div class="flex min-w-0 items-center gap-1.5">
              <span class="shrink-0 font-mono text-xs text-gray-400">{{ kbType }}/</span>
              <input
                v-model="slugSegment"
                type="text"
                class="field-input min-w-0 flex-1 font-mono text-sm"
                :placeholder="t('knowledge.docManage.slugPlaceholder')"
                @input="slugTouched = true"
              />
            </div>
          </FormField>
        </div>
        <p class="form-grid-footnote">{{ t('knowledge.docManage.createHint') }}</p>
      </div>
    </form>
    <template #footer>
      <button type="button" class="btn-ghost" @click="emit('close')">{{ t('confirm.cancel') }}</button>
      <button type="button" class="btn-primary" :disabled="!canSubmit" @click="submit">
        {{ t('knowledge.docManage.createAndEdit') }}
      </button>
    </template>
  </AppModal>
</template>
