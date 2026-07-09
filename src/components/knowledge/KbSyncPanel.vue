<script setup lang="ts">
import { ref } from 'vue'
import KbSyncOpsPanel from './KbSyncOpsPanel.vue'

const panelRef = ref<InstanceType<typeof KbSyncOpsPanel> | null>(null)

defineExpose({
  refreshAll: () => panelRef.value?.refreshAll(),
  trigger: (opts?: { skipConfirm?: boolean }) => panelRef.value?.trigger(opts),
  get busy() { return panelRef.value?.busy },
  get triggering() { return panelRef.value?.triggering },
  get syncRunning() { return panelRef.value?.syncRunning },
  get canSync() { return panelRef.value?.canSync },
  get canTrigger() { return panelRef.value?.canTrigger },
})
</script>

<template>
  <KbSyncOpsPanel ref="panelRef" />
</template>
