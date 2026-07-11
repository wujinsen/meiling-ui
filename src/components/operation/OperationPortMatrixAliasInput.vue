<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { X } from 'lucide-vue-next'

const model = defineModel<string[]>({ default: () => [] })

const { t } = useI18n()
const draft = ref('')

function normalizeAlias(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, '-')
}

function addAlias(raw: string) {
  const alias = normalizeAlias(raw)
  if (!alias) return
  if (model.value.includes(alias)) return
  model.value = [...model.value, alias]
}

function removeAlias(alias: string) {
  model.value = model.value.filter((a) => a !== alias)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    addAlias(draft.value)
    draft.value = ''
  } else if (e.key === 'Backspace' && !draft.value && model.value.length) {
    model.value = model.value.slice(0, -1)
  }
}

function onBlur() {
  if (draft.value.trim()) {
    addAlias(draft.value)
    draft.value = ''
  }
}
</script>

<template>
  <div class="operation-alias-input">
    <span v-for="alias in model" :key="alias" class="operation-alias-chip">
      {{ alias }}
      <button type="button" class="operation-alias-chip__remove" :aria-label="t('operation.common.clear')" @click="removeAlias(alias)">
        <X class="h-3 w-3" />
      </button>
    </span>
    <input
      v-model="draft"
      type="text"
      class="operation-alias-input__field"
      :placeholder="t('operation.portMatrix.aliasPlaceholder')"
      @keydown="onKeydown"
      @blur="onBlur"
    />
  </div>
  <p class="mt-1 text-xs text-gray-400">{{ t('operation.portMatrix.aliasHint') }}</p>
</template>
