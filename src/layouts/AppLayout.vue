<script setup lang="ts">

import { onMounted, onUnmounted, watch } from 'vue'

import { useRoute } from 'vue-router'

import AppSidebar from '@/components/layout/AppSidebar.vue'

import AppHeader from '@/components/layout/AppHeader.vue'

import PageTransition from '@/components/layout/PageTransition.vue'

import PerspectiveStage from '@/components/layout/PerspectiveStage.vue'

import CommandPalette from '@/components/ui/CommandPalette.vue'

import AppToast from '@/components/ui/AppToast.vue'

import AnalyticsFilterPanel from '@/components/ui/AnalyticsFilterPanel.vue'

import AppPageTabs from '@/components/layout/AppPageTabs.vue'

import { useCommandPalette } from '@/composables/useCommandPalette'

import { useEscapeClose } from '@/composables/useEscapeClose'

import { useMobileSidebar } from '@/composables/useMobileSidebar'

import { addPageTab } from '@/composables/usePageTabs'



const route = useRoute()

const { toggle: togglePalette } = useCommandPalette()

const { isOpen: sidebarOpen, close: closeSidebar } = useMobileSidebar()

useEscapeClose(sidebarOpen, closeSidebar)



watch(() => route.path, () => closeSidebar())

watch(
  () => route.fullPath,
  () => addPageTab(route),
  { immediate: true },
)



function onKeyDown(e: KeyboardEvent) {

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {

    e.preventDefault()

    togglePalette()

  }

}



onMounted(() => window.addEventListener('keydown', onKeyDown))

onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

</script>



<template>

  <PerspectiveStage>

    <div class="app-shell relative flex min-h-screen w-full items-start">

      <Transition name="sidebar-overlay">

        <div

          v-if="sidebarOpen"

          class="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"

          @click="closeSidebar"

        />

      </Transition>



      <AppSidebar />



      <div class="flex min-h-screen min-w-0 flex-1 flex-col">

        <AppHeader />

        <AppPageTabs />

        <AnalyticsFilterPanel />

        <main class="main-scroll flex-1 overflow-auto p-6">

          <PageTransition />

        </main>

      </div>

    </div>

    <CommandPalette />
    <AppToast />

  </PerspectiveStage>

</template>

