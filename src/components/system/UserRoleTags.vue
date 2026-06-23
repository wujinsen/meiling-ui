<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppTooltip from '@/components/ui/AppTooltip.vue'

const props = defineProps<{
  roleNames?: string
}>()

const { t } = useI18n()

const roles = computed(() =>
  (props.roleNames ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean),
)

const label = computed(() => roles.value.join(', '))
</script>

<template>
  <span v-if="!roles.length" class="text-gray-400 dark:text-gray-500">
    {{ t('system.user.rolesNone') }}
  </span>
  <AppTooltip v-else>
    <span class="user-role-tags">{{ label }}</span>
    <template #content>
      <div class="app-tooltip-list">
        <span v-for="role in roles" :key="role" class="app-tooltip-chip">{{ role }}</span>
      </div>
    </template>
  </AppTooltip>
</template>
