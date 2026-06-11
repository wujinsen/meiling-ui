<script setup lang="ts">
import { reactive } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMobileSidebar } from '@/composables/useMobileSidebar'
import { menuFullPath } from '@/router/routeGenerator'
import { resolveMenuIcon } from '@/utils/menuIcons'
import { resolveMenuLabel } from '@/utils/menuLabel'
import type { MenuVo } from '@/types/api'
import { ChevronDown } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    menu: MenuVo
    parentPath?: string
    depth?: number
  }>(),
  {
    parentPath: '',
    depth: 0,
  },
)

const route = useRoute()
const { t, locale } = useI18n()
const { close: closeMobile } = useMobileSidebar()

const sectionOpen = reactive<Record<string, boolean>>({})

const visibleChildren = () =>
  props.menu.children?.filter((child) => child.menuType !== 'F' && !child.hidden) ?? []

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

function linkPath(menu: MenuVo) {
  return menuFullPath(menu, props.parentPath)
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
  <div v-if="visibleChildren().length" :class="depth === 0 ? 'nav-section' : 'nav-section-nested'">
    <button
      type="button"
      :class="[depth === 0 ? 'nav-section-title' : 'nav-section-title-nested']"
      @click="toggleSection(menu)"
    >
      <component
        :is="resolveMenuIcon(menu.icon || menu.meta?.icon)"
        :class="depth === 0 ? 'h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400' : 'h-3.5 w-3.5 shrink-0 opacity-80'"
      />
      <span class="min-w-0 flex-1 truncate text-left">{{ menuLabel(menu) }}</span>
      <ChevronDown class="h-4 w-4 shrink-0 text-gray-400 transition" :class="isSectionOpen(menu) && 'rotate-180'" />
    </button>
    <div v-show="isSectionOpen(menu)" class="nav-section-children">
      <AppSidebarMenu
        v-for="child in visibleChildren()"
        :key="sectionKey(child)"
        :menu="child"
        :parent-path="linkPath(menu)"
        :depth="depth + 1"
      />
    </div>
  </div>

  <RouterLink
    v-else
    :to="linkPath(menu)"
    :class="[
      depth === 0 ? 'nav-item nav-item-top' : 'nav-item nav-item-child',
      isActive(linkPath(menu)) && 'nav-item-active',
    ]"
    :style="depth > 1 ? { paddingLeft: `${12 + (depth - 1) * 12}px` } : undefined"
    @click="onNavClick"
  >
    <component
      :is="resolveMenuIcon(menu.icon || menu.meta?.icon)"
      :class="depth === 0 ? 'h-4 w-4 shrink-0' : 'h-3.5 w-3.5 shrink-0 opacity-80'"
    />
    <span class="truncate">{{ menuLabel(menu) }}</span>
  </RouterLink>
</template>
