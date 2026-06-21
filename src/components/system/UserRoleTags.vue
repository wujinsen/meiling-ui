<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

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
</script>

<template>
  <span v-if="!roles.length" class="text-gray-400 dark:text-gray-500">
    {{ t('system.user.rolesNone') }}
  </span>
  <div v-else class="user-role-tags">
    <span v-for="role in roles" :key="role" class="user-role-tag" :title="role">
      {{ role }}
    </span>
  </div>
</template>
