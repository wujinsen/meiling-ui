<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { X } from 'lucide-vue-next'
import { isValidServerTag, MAX_SERVER_TAGS, normalizeServerTag } from '@/utils/operationServerTag'
import { showToast } from '@/composables/useToast'

const model = defineModel<string[]>({ default: () => [] })

const props = withDefaults(
  defineProps<{
    suggestions?: string[]
    showHint?: boolean
    showSuggestions?: boolean
  }>(),
  { showHint: true, showSuggestions: true },
)

const { t } = useI18n()
const draft = ref('')

function addTag(raw: string) {
  const tag = normalizeServerTag(raw)
  if (!tag) return
  if (!isValidServerTag(tag)) {
    showToast('error', t('operation.serverTags.invalid'))
    return
  }
  if (model.value.includes(tag)) return
  if (model.value.length >= MAX_SERVER_TAGS) {
    showToast('error', t('operation.serverTags.tooMany', { n: MAX_SERVER_TAGS }))
    return
  }
  model.value = [...model.value, tag]
}

function removeTag(tag: string) {
  model.value = model.value.filter((item) => item !== tag)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    addTag(draft.value)
    draft.value = ''
  } else if (e.key === 'Backspace' && !draft.value && model.value.length) {
    model.value = model.value.slice(0, -1)
  }
}

function onBlur() {
  if (draft.value.trim()) {
    addTag(draft.value)
    draft.value = ''
  }
}

function pickSuggestion(tag: string) {
  addTag(tag)
}
</script>

<template>
  <div class="operation-alias-input">
    <span v-for="tag in model" :key="tag" class="operation-alias-chip">
      {{ tag }}
      <button type="button" class="operation-alias-chip__remove" :aria-label="t('operation.common.clear')" @click="removeTag(tag)">
        <X class="h-3 w-3" />
      </button>
    </span>
    <input
      v-model="draft"
      type="text"
      class="operation-alias-input__field"
      :placeholder="t('operation.serverTags.placeholder')"
      list="server-tag-suggestions"
      @keydown="onKeydown"
      @blur="onBlur"
    />
    <datalist v-if="props.suggestions?.length" id="server-tag-suggestions">
      <option v-for="tag in props.suggestions" :key="tag" :value="tag" />
    </datalist>
  </div>
  <p v-if="props.showHint" class="mt-1 text-xs text-gray-400">{{ t('operation.serverTags.hint') }}</p>
  <div v-if="props.showSuggestions && props.suggestions?.length" class="mt-2 flex flex-wrap gap-1.5">
    <button
      v-for="tag in props.suggestions"
      :key="`suggest-${tag}`"
      type="button"
      class="operation-alias-chip operation-alias-chip--compact cursor-pointer"
      @click="pickSuggestion(tag)"
    >
      {{ tag }}
    </button>
  </div>
</template>
