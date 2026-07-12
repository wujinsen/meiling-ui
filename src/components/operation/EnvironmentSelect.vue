<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppSelect from '@/components/ui/AppSelect.vue'
import { ENVIRONMENT_OPTIONS } from '@/utils/operationEnv'

const model = defineModel<number | '' | undefined>({ default: '' })

const props = defineProps<{
  includeAll?: boolean
  block?: boolean
}>()

const { t } = useI18n()

const options = computed(() => {
  const envLabels: Record<number, string> = {
    1: t('operation.env.dev'),
    2: t('operation.env.test'),
    3: t('operation.env.pre'),
    4: t('operation.env.pro'),
  }
  const list = ENVIRONMENT_OPTIONS.map((env) => ({
    value: env,
    label: envLabels[env] ?? String(env),
  }))
  if (props.includeAll) {
    return [{ value: '', label: t('operation.common.envAll') }, ...list]
  }
  return list
})
</script>

<template>
  <AppSelect v-model="model" :options="options" :block="block ?? true" />
</template>
