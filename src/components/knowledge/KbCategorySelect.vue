<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { KbCategoryFlatOption } from '@/types/knowledge'

const model = defineModel<string>({ default: '' })

const props = withDefaults(
  defineProps<{
    options: KbCategoryFlatOption[]
    loading?: boolean
    disabled?: boolean
    allowEmpty?: boolean
    emptyLabel?: string
  }>(),
  { allowEmpty: true },
)

const { t } = useI18n()

const isDisabled = computed(() => props.disabled || props.loading)
const noneLabel = computed(() => props.emptyLabel ?? t('knowledge.docManage.categoryNone'))
</script>

<template>
  <select
    v-model="model"
    class="field-input"
    :disabled="isDisabled"
  >
    <option v-if="allowEmpty" value="">{{ noneLabel }}</option>
    <option v-if="loading && !options.length" value="" disabled>{{ t('common.loading') }}</option>
    <option v-else-if="!options.length" value="" disabled>{{ t('knowledge.docManage.categoryEmpty') }}</option>
    <option v-for="opt in options" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
  </select>
</template>
