<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  show?: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <span
    v-if="show"
    class="operation-orphan-badge"
    :title="t('operation.common.orphanHint')"
  >
    {{ t('operation.common.orphan') }}
  </span>
</template>
