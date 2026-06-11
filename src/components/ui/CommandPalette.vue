<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Search, Settings, Sun, Moon, Box, UserRound } from 'lucide-vue-next'
import { useCommandPalette } from '@/composables/useCommandPalette'
import { useEscapeClose } from '@/composables/useEscapeClose'
import { useTheme } from '@/composables/useTheme'
import { usePerspective } from '@/composables/usePerspective'
import { getPermissionMenus } from '@/composables/usePermission'
import { filterSidebarMenus } from '@/router/routeGenerator'
import { buildCommandItemsFromMenus, filterCommandItems, type CommandPaletteItem } from '@/utils/commandMenuItems'

const router = useRouter()
const { t, locale } = useI18n()
const { isOpen, close } = useCommandPalette()
const { isDark, toggleTheme } = useTheme()
const { isPerspective, togglePerspective } = usePerspective()

useEscapeClose(isOpen, close)

const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const activeIndex = ref(0)

const menuItems = computed(() =>
  buildCommandItemsFromMenus(filterSidebarMenus(getPermissionMenus()), t, locale.value, router),
)

const staticNavItems = computed<CommandPaletteItem[]>(() => [
  {
    id: 'profile',
    label: t('profile.title'),
    icon: UserRound,
    group: t('command.nav'),
    keywords: `profile ${t('profile.title')}`,
    action: () => router.push('/profile'),
  },
  {
    id: 'settings',
    label: t('nav.settings'),
    icon: Settings,
    group: t('command.nav'),
    keywords: `settings ${t('nav.settings')}`,
    action: () => router.push('/settings'),
  },
])

const actionItems = computed<CommandPaletteItem[]>(() => [
  {
    id: 'theme',
    label: isDark.value ? t('theme.toLight') : t('theme.toDark'),
    icon: isDark.value ? Sun : Moon,
    group: t('command.actions'),
    keywords: 'theme dark light',
    action: () => toggleTheme(),
  },
  {
    id: 'perspective',
    label: isPerspective.value ? t('perspective.toFlat') : t('perspective.to3d'),
    icon: Box,
    group: t('command.actions'),
    keywords: 'perspective 3d flat',
    action: () => togglePerspective(),
  },
])

const items = computed(() => {
  const nav = menuItems.value.length ? menuItems.value : staticNavItems.value.filter((item) => item.id !== 'profile')
  const seen = new Set<string>()
  const merged: CommandPaletteItem[] = []

  for (const item of [...nav, ...staticNavItems.value, ...actionItems.value]) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    merged.push(item)
  }

  return merged
})

const filtered = computed(() => filterCommandItems(items.value, query.value))

watch(isOpen, async (open) => {
  if (open) {
    query.value = ''
    activeIndex.value = 0
    await nextTick()
    inputRef.value?.focus()
  }
})

watch(filtered, () => {
  activeIndex.value = 0
})

function run(item: CommandPaletteItem) {
  item.action()
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % Math.max(filtered.value.length, 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + filtered.value.length) % Math.max(filtered.value.length, 1)
  } else if (e.key === 'Enter' && filtered.value[activeIndex.value]) {
    e.preventDefault()
    run(filtered.value[activeIndex.value])
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="palette">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
        @click.self="close"
      >
        <div
          class="command-palette w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-surface-dark-card"
          role="dialog"
          aria-modal="true"
          @keydown="onKeydown"
        >
          <div class="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/5">
            <Search class="h-4 w-4 shrink-0 text-gray-400" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              :placeholder="t('command.placeholder')"
              class="flex-1 bg-transparent text-sm outline-none dark:text-white"
            />
            <kbd class="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-400 dark:border-white/10">ESC</kbd>
          </div>
          <ul class="max-h-80 overflow-y-auto p-2">
            <li v-for="(item, i) in filtered" :key="item.id">
              <button
                type="button"
                :class="[
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition',
                  i === activeIndex
                    ? 'bg-gray-900 text-white dark:bg-white/10'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5',
                ]"
                @click="run(item)"
                @mouseenter="activeIndex = i"
              >
                <component :is="item.icon" class="h-4 w-4 shrink-0 opacity-70" />
                <span class="flex-1">{{ item.label }}</span>
                <span class="text-xs opacity-50">{{ item.group }}</span>
              </button>
            </li>
            <li v-if="!filtered.length" class="px-3 py-6 text-center text-sm text-gray-400">
              {{ t('command.empty') }}
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
