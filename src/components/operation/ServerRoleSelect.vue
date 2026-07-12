<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppSelect from '@/components/ui/AppSelect.vue'
import { SERVER_ROLE_OPTIONS } from '@/utils/operationServerRole'

const model = defineModel<string | '' | null | undefined>({ default: '' })

const props = defineProps<{
  includeAll?: boolean
  block?: boolean
}>()

const { t } = useI18n()

const innerValue = computed({
  get: () => model.value ?? '',
  set: (v: string | number | '' | undefined) => {
    model.value = v === '' ? '' : String(v)
  },
})

const options = computed(() => {
  const list = SERVER_ROLE_OPTIONS.map((role) => ({
    value: role,
    label: t(`operation.serverRole.${role}`),
  }))
  if (props.includeAll) {
    return [{ value: '', label: t('operation.serverRole.all') }, ...list]
  }
  return list
})
</script>

<template>
  <AppSelect v-model="innerValue" :options="options" :block="block ?? true" />
</template>
