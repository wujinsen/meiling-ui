<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { getRoleApi } from '@/api/role'
import RolePermAssignPanel from '@/components/system/RolePermAssignPanel.vue'
import { guardActionWithRefresh } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { PERM } from '@/constants/permissions'
import { API_SUCCESS_CODE } from '@/types/api'
import { ArrowLeft } from 'lucide-vue-next'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const roleName = ref('')

const roleId = computed(() => {
  const q = route.query.roleId
  return q != null && q !== '' ? String(q) : null
})

async function loadRoleName() {
  if (!roleId.value) return
  try {
    const result = await getRoleApi(roleId.value)
    if (result.code === API_SUCCESS_CODE && result.data) {
      roleName.value = result.data.roleName ?? ''
    }
  } catch {
    /* ignore */
  }
}

onMounted(async () => {
  if (!(await guardActionWithRefresh(PERM.ROLE_ASSIGN_PERM))) {
    router.back()
    return
  }
  if (!roleId.value) {
    showToast('error', t('system.role.loadFailed'))
    router.back()
    return
  }
  await loadRoleName()
})

function goBack() {
  router.back()
}
</script>

<template>
  <div class="page-stack">
    <div class="card p-5">
      <button type="button" class="btn-ghost mb-2 px-2 py-1 text-sm" @click="goBack">
        <ArrowLeft class="h-4 w-4" />
        {{ t('system.role.permBack') }}
      </button>
      <h1 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('system.role.assignPerm') }}</h1>
      <p v-if="roleName" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{ t('system.role.permHint', { name: roleName }) }}
      </p>
    </div>

    <div class="card p-4 sm:p-5">
      <RolePermAssignPanel
        v-if="roleId"
        :role-id="roleId"
        mode="page"
        @saved="goBack"
        @cancel="goBack"
      />
    </div>
  </div>
</template>
