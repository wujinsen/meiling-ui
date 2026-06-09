<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ENVIRONMENT_OPTIONS } from '@/utils/operationEnv'

const model = defineModel<number | '' | undefined>({ default: '' })

defineProps<{
  includeAll?: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <select v-model="model" class="field-input">
    <option v-if="includeAll" value="">{{ t('operation.common.envAll') }}</option>
    <option v-for="env in ENVIRONMENT_OPTIONS" :key="env" :value="env">
      {{ t(`operation.env.${env === 1 ? 'dev' : env === 2 ? 'test' : env === 3 ? 'pre' : 'pro'}`) }}
    </option>
  </select>
</template>

<style scoped>
.field-input {
  @apply rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5;
}
</style>
