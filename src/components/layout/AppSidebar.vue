<script setup lang="ts">
import { reactive } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BrandMark from '@/components/ui/BrandMark.vue'
import { useMobileSidebar } from '@/composables/useMobileSidebar'
import { usePermission } from '@/composables/usePermission'
import { menuFullPath } from '@/router/routeGenerator'
import { resolveMenuIcon } from '@/utils/menuIcons'
import { resolveMenuLabel } from '@/utils/menuLabel'
import type { MenuVo } from '@/types/api'
import { ChevronDown } from 'lucide-vue-next'

const route = useRoute()
const { t, locale } = useI18n()
const { isOpen: mobileOpen, close: closeMobile } = useMobileSidebar()
const { menus } = usePermission()

const sectionOpen = reactive<Record<string, boolean>>({})

function sectionKey(menu: MenuVo) {
  return String(menu.id ?? menu.path ?? menu.name)
}

function isSectionOpen(menu: MenuVo) {
  const key = sectionKey(menu)
  if (sectionOpen[key] === undefined) sectionOpen[key] = true
  return sectionOpen[key]
}

function toggleSection(menu: MenuVo) {
  const key = sectionKey(menu)
  sectionOpen[key] = !isSectionOpen(menu)
}

function linkPath(menu: MenuVo, parentPath = '') {
  return menuFullPath(menu, parentPath)
}

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(`${path}/`)
}

function onNavClick() {
  closeMobile()
}

function menuLabel(menu: MenuVo) {
  return resolveMenuLabel(menu, t, locale.value)
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
        <template v-for="menu in menus" :key="sectionKey(menu)">
          <div v-if="menu.children?.length" class="nav-section">
            <button type="button" class="nav-section-title" @click="toggleSection(menu)">
              <component
                :is="resolveMenuIcon(menu.icon || menu.meta?.icon)"
                class="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400"
              />
              <span class="min-w-0 flex-1 truncate text-left">{{ menuLabel(menu) }}</span>
              <ChevronDown class="h-4 w-4 shrink-0 text-gray-400 transition" :class="isSectionOpen(menu) && 'rotate-180'" />
            </button>
            <div v-show="isSectionOpen(menu)" class="nav-section-children">
              <RouterLink
                v-for="child in menu.children"
                :key="sectionKey(child)"
                :to="linkPath(child, menu.path ? linkPath(menu) : '')"
                :class="[
                  'nav-item nav-item-child',
                  isActive(linkPath(child, menu.path ? linkPath(menu) : '')) && 'nav-item-active',
                ]"
                @click="onNavClick"
              >
                <component :is="resolveMenuIcon(child.icon || child.meta?.icon)" class="h-3.5 w-3.5 shrink-0 opacity-80" />
                <span class="truncate">{{ menuLabel(child) }}</span>
              </RouterLink>
            </div>
          </div>

          <RouterLink
            v-else
            :to="linkPath(menu)"
            :class="['nav-item nav-item-top', isActive(linkPath(menu)) && 'nav-item-active']"
            @click="onNavClick"
          >
            <component :is="resolveMenuIcon(menu.icon || menu.meta?.icon)" class="h-4 w-4 shrink-0" />
            <span class="truncate">{{ menuLabel(menu) }}</span>
          </RouterLink>
        </template>
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
