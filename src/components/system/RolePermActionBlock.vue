<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import type { ActionPanel } from '@/composables/useRolePermAssign'

defineProps<{
  panel: ActionPanel
  checkedCodes: Set<string>
}>()

const emit = defineEmits<{
  toggle: [code: string, checked: boolean]
  selectAll: []
  clearAll: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="role-perm-action-head">
    <p class="role-perm-action-title">{{ panel.menuName }}</p>
    <div class="role-perm-action-head-actions">
      <button type="button" class="role-perm-quick-btn role-perm-quick-btn--primary" @click="emit('selectAll')">
        {{ t('system.role.actionPermSelectAll') }}
      </button>
      <button type="button" class="role-perm-quick-btn role-perm-quick-btn--ghost" @click="emit('clearAll')">
        {{ t('system.role.actionPermClearAll') }}
      </button>
    </div>
  </div>
  <div class="role-perm-action-grid role-perm-action-grid--tiled">
    <AppCheckbox
      v-for="action in panel.actions"
      :key="action.permCode"
      variant="option"
      class="role-perm-action-item"
      :title="action.permCode"
      :model-value="checkedCodes.has(action.permCode)"
      @update:model-value="(v) => emit('toggle', action.permCode, v)"
    >
      <span class="role-perm-action-label">{{ action.name }}</span>
      <span class="role-perm-action-code">{{ action.permCode }}</span>
    </AppCheckbox>
  </div>
</template>
