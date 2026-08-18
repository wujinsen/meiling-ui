<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { History, Stethoscope } from 'lucide-vue-next'

defineProps<{
  active: 'diagnosis' | 'history'
}>()

const { t } = useI18n()
</script>

<template>
  <nav class="aiops-subnav" :aria-label="t('operation.aiops.navLabel')">
    <RouterLink
      :to="{ name: 'OperationAiopsDiagnosis' }"
      class="aiops-subnav-item"
      :class="active === 'diagnosis' && 'aiops-subnav-item--active'"
    >
      <Stethoscope class="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{{ t('operation.aiops.title') }}</span>
    </RouterLink>
    <RouterLink
      :to="{ name: 'OperationAiopsRuns' }"
      class="aiops-subnav-item"
      :class="active === 'history' && 'aiops-subnav-item--active'"
    >
      <History class="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{{ t('operation.aiopsRuns.title') }}</span>
    </RouterLink>
  </nav>
</template>
