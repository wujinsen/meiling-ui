<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import AppToast from '@/components/ui/AppToast.vue'
import AppConfirmDialog from '@/components/ui/AppConfirmDialog.vue'
import { useSystemPortal } from '@/composables/useSystemPortal'
import { getToken, isPortalEnabledStored } from '@/utils/authSession'

const router = useRouter()

async function onWindowFocus() {
  if (!getToken() || !isPortalEnabledStored()) return
  const { syncPortalAccess } = useSystemPortal()
  const sync = await syncPortalAccess(true)
  if (!sync.allowed && router.currentRoute.value.name !== 'system-select') {
    await router.replace('/system-select')
  }
}

onMounted(() => window.addEventListener('focus', onWindowFocus))
onUnmounted(() => window.removeEventListener('focus', onWindowFocus))
</script>

<template>
  <RouterView />
  <AppConfirmDialog />
  <AppToast />
</template>
