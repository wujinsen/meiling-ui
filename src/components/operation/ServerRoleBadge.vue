<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { serverRoleBadgeClass, serverRoleI18nKey } from '@/utils/operationServerRole'

const props = withDefaults(
  defineProps<{
    serverRole?: string | null
    size?: 'sm' | 'md'
  }>(),
  { size: 'md' },
)

const { t } = useI18n()

const label = computed(() => t(serverRoleI18nKey(props.serverRole)))
const badgeClass = computed(() => serverRoleBadgeClass(props.serverRole))
const sizeClass = computed(() =>
  props.size === 'sm' ? 'server-role-badge text-[10px] px-1.5 py-0.5' : 'server-role-badge text-xs px-2 py-0.5',
)
</script>

<template>
  <span class="badge inline-flex shrink-0 items-center font-medium" :class="[badgeClass, sizeClass]">
    {{ label }}
  </span>
</template>
