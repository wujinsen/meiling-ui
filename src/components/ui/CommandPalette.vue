<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Search, LayoutDashboard, BarChart3, Sparkles, Workflow, FileBarChart, Users, Settings, Sun, Moon, Box } from 'lucide-vue-next'
import { useCommandPalette } from '@/composables/useCommandPalette'
import { useEscapeClose } from '@/composables/useEscapeClose'
import { useTheme } from '@/composables/useTheme'
import { usePerspective } from '@/composables/usePerspective'

const router = useRouter()
const { t } = useI18n()
const { isOpen, close } = useCommandPalette()
const { isDark, toggleTheme } = useTheme()
const { isPerspective, togglePerspective } = usePerspective()

useEscapeClose(isOpen, close)

const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const activeIndex = ref(0)

const items = computed(() => [
  { id: 'dash', label: t('nav.dashboard'), icon: LayoutDashboard, group: t('command.nav'), action: () => router.push('/') },
  { id: 'analytics', label: t('nav.analytics'), icon: BarChart3, group: t('candlelightDragon.title'), action: () => router.push('/candlelight/bi') },
  { id: 'cockpit', label: t('cockpit.title'), icon: LayoutDashboard, group: t('candlelightDragon.title'), action: () => router.push('/candlelight/cockpit') },
  { id: 'persona', label: t('persona.title'), icon: Users, group: t('candlelightDragon.title'), action: () => router.push('/candlelight/userportrait') },
  { id: 'reports', label: t('nav.reports'), icon: FileBarChart, group: t('sections.insightControl'), action: () => router.push('/insight/reports') },
  { id: 'pulse', label: t('nav.pulse'), icon: Sparkles, group: t('sections.insightControl'), action: () => router.push('/insight/pulse') },
  { id: 'workflow', label: t('nav.workflows'), icon: Workflow, group: t('sections.insightControl'), action: () => router.push('/insight/workflows') },
  { id: 'settings', label: t('nav.settings'), icon: Settings, group: t('command.nav'), action: () => router.push('/settings') },
  { id: 'theme', label: isDark.value ? t('theme.toLight') : t('theme.toDark'), icon: isDark.value ? Sun : Moon, group: t('command.actions'), action: () => toggleTheme() },
  { id: 'perspective', label: isPerspective.value ? t('perspective.toFlat') : t('perspective.to3d'), icon: Box, group: t('command.actions'), action: () => togglePerspective() },
])

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter((item) => item.label.toLowerCase().includes(q))
})

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

function run(item: (typeof items.value)[number]) {
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
            <li
              v-for="(item, i) in filtered"
              :key="item.id"
            >
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
