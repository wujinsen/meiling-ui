<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, X } from 'lucide-vue-next'
import { useEscapeClose } from '@/composables/useEscapeClose'
import type { KbTag } from '@/types/knowledge'
import { toEntityId } from '@/utils/id'

const model = defineModel<string[]>({ default: () => [] })

const props = withDefaults(
  defineProps<{
    tags: KbTag[]
    loading?: boolean
    disabled?: boolean
  }>(),
  {},
)

const { t } = useI18n()
const open = ref(false)
const filter = ref('')
const rootRef = ref<HTMLElement | null>(null)

useEscapeClose(open, () => {
  open.value = false
  filter.value = ''
})

const tagMap = computed(() => {
  const map = new Map<string, KbTag>()
  for (const tag of props.tags) {
    const id = toEntityId(tag.id)
    if (id) map.set(id, tag)
  }
  return map
})

const filteredTags = computed(() => {
  const kw = filter.value.trim().toLowerCase()
  if (!kw) return props.tags
  return props.tags.filter((tag) => tag.tagName.toLowerCase().includes(kw))
})

const triggerLabel = computed(() => {
  if (!model.value.length) return t('knowledge.docManage.tagSelectPlaceholder')
  return t('knowledge.docManage.tagsSelected', { count: model.value.length })
})

function tagId(tag: KbTag) {
  return toEntityId(tag.id) ?? String(tag.id)
}

function isSelected(id: string) {
  return model.value.includes(id)
}

function toggleTag(id: string) {
  if (props.disabled) return
  if (isSelected(id)) {
    model.value = model.value.filter((x) => x !== id)
  } else {
    model.value = [...model.value, id]
  }
}

function removeTag(id: string) {
  if (props.disabled) return
  model.value = model.value.filter((x) => x !== id)
}

function toggleOpen() {
  if (props.disabled || props.loading) return
  open.value = !open.value
  if (!open.value) filter.value = ''
}

function onDocumentClick(event: MouseEvent) {
  if (!open.value || !rootRef.value) return
  if (!rootRef.value.contains(event.target as Node)) {
    open.value = false
    filter.value = ''
  }
}

function tagStyle(color?: string) {
  if (!color) return undefined
  return { backgroundColor: `${color}22`, color, borderColor: `${color}55` }
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <div ref="rootRef" class="kb-tag-picker">
    <button
      type="button"
      class="field-input kb-tag-picker-trigger"
      :class="open && 'kb-tag-picker-trigger-open'"
      :disabled="disabled || loading"
      :aria-expanded="open"
      @click.stop="toggleOpen"
    >
      <span class="truncate text-sm" :class="!model.length && 'text-gray-400'">{{ triggerLabel }}</span>
      <ChevronDown class="h-4 w-4 shrink-0 text-gray-400 transition" :class="open && 'rotate-180'" />
    </button>

    <div v-if="model.length" class="mt-2 flex flex-wrap gap-1.5">
      <span
        v-for="id in model"
        :key="id"
        class="kb-tag-chip"
        :style="tagStyle(tagMap.get(id)?.color)"
      >
        {{ tagMap.get(id)?.tagName ?? id }}
        <button
          v-if="!disabled"
          type="button"
          class="kb-tag-chip-remove"
          :aria-label="t('knowledge.docManage.tagRemove')"
          @click.stop="removeTag(id)"
        >
          <X class="h-3 w-3" />
        </button>
      </span>
    </div>

    <div v-if="open" class="kb-tag-picker-panel" @click.stop>
      <input
        v-model="filter"
        type="search"
        class="field-input mb-2"
        :placeholder="t('knowledge.docManage.tagSearchPlaceholder')"
      />
      <div v-if="loading" class="py-4 text-center text-xs text-gray-400">{{ t('common.loading') }}</div>
      <div v-else-if="!tags.length" class="py-4 text-center text-xs text-gray-400">{{ t('knowledge.docManage.tagsEmpty') }}</div>
      <ul v-else class="kb-tag-picker-list">
        <li v-if="!filteredTags.length" class="py-4 text-center text-xs text-gray-400">{{ t('system.common.empty') }}</li>
        <li v-for="tag in filteredTags" :key="tagId(tag)">
          <label class="kb-tag-picker-item">
            <input
              type="checkbox"
              class="rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-white/20"
              :checked="isSelected(tagId(tag))"
              @change="toggleTag(tagId(tag))"
            />
            <span class="truncate" :style="tag.color ? { color: tag.color } : undefined">{{ tag.tagName }}</span>
          </label>
        </li>
      </ul>
    </div>
  </div>
</template>
