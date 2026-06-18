<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    roleNames?: string
    maxVisible?: number
  }>(),
  { maxVisible: 2 },
)

const { t } = useI18n()

const roles = computed(() =>
  (props.roleNames ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean),
)

const visibleRoles = computed(() => roles.value.slice(0, props.maxVisible))
const hiddenCount = computed(() => Math.max(0, roles.value.length - props.maxVisible))
const fullTitle = computed(() => roles.value.join('、'))
</script>

<template>
  <span v-if="!roles.length" class="text-gray-400 dark:text-gray-500">
    {{ t('system.user.rolesNone') }}
  </span>
  <div v-else class="user-role-tags" :title="fullTitle">
    <span v-for="role in visibleRoles" :key="role" class="user-role-tag" :title="role">
      {{ role }}
    </span>
    <span v-if="hiddenCount" class="user-role-tag user-role-tag-more">
      +{{ hiddenCount }}
    </span>
  </div>
</template>
