<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  serverCount?: number | null
  projectCount?: number | null
  componentCount?: number | null
}>()

const emit = defineEmits<{
  openServers: []
  openProjects: []
  openComponents: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <button
      v-if="props.serverCount != null"
      type="button"
      class="operation-relation-chip"
      :class="!props.serverCount && 'operation-relation-chip--empty'"
      :disabled="!props.serverCount"
      @click="props.serverCount && emit('openServers')"
    >
      {{ t('operation.relations.chipServers', { n: props.serverCount ?? 0 }) }}
    </button>
    <button
      v-if="props.projectCount != null"
      type="button"
      class="operation-relation-chip"
      :class="!props.projectCount && 'operation-relation-chip--empty'"
      :disabled="!props.projectCount"
      @click="props.projectCount && emit('openProjects')"
    >
      {{ t('operation.relations.chipProjects', { n: props.projectCount ?? 0 }) }}
    </button>
    <button
      v-if="props.componentCount != null"
      type="button"
      class="operation-relation-chip"
      :class="!props.componentCount && 'operation-relation-chip--empty'"
      :disabled="!props.componentCount"
      @click="props.componentCount && emit('openComponents')"
    >
      {{ t('operation.relations.chipComponents', { n: props.componentCount ?? 0 }) }}
    </button>
  </div>
</template>
