<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BrandMark from '@/components/ui/BrandMark.vue'
import AppSidebarMenu from '@/components/layout/AppSidebarMenu.vue'
import { useMobileSidebar } from '@/composables/useMobileSidebar'
import { usePermission } from '@/composables/usePermission'
import type { MenuVo } from '@/types/api'

const { t } = useI18n()
const { isOpen: mobileOpen } = useMobileSidebar()
const { menus } = usePermission()

function sectionKey(menu: MenuVo) {
  return String(menu.id ?? menu.path ?? menu.name)
}
</script>

<template>
  <aside
    :class="[
      'z-50 flex h-screen w-60 shrink-0 flex-col border-r border-gray-200 bg-gray-50 transition-transform duration-300 ease-out dark:border-white/5 dark:bg-surface-dark-card',
      'fixed inset-y-0 left-0 lg:sticky lg:top-0 lg:self-start',
      mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    ]"
  >
    <div class="flex h-14 items-center border-b border-gray-100 px-4 dark:border-white/5">
      <BrandMark />
    </div>

    <nav class="flex-1 space-y-3 overflow-y-auto p-3">
      <template v-if="menus.length">
        <AppSidebarMenu
          v-for="menu in menus"
          :key="sectionKey(menu)"
          :menu="menu"
        />
      </template>

      <p v-else class="px-3 py-6 text-center text-sm text-gray-400">{{ t('menu.empty') }}</p>
    </nav>

    <div class="border-t border-gray-100 px-3 py-3 dark:border-white/5">
      <div
        class="rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 p-4 dark:from-brand-900/40 dark:to-brand-800/20"
      >
        <p class="text-sm font-semibold text-brand-900 dark:text-brand-200">{{ t('promo.title') }}</p>
        <p class="mt-1 text-xs text-brand-700/80 dark:text-brand-300/70">{{ t('promo.desc') }}</p>
        <button class="btn-primary mt-3 w-full justify-center text-xs">{{ t('promo.upgrade') }}</button>
      </div>
    </div>
  </aside>
</template>
