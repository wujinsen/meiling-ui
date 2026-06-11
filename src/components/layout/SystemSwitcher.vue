<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import PortalSystemPicker from '@/components/portal/PortalSystemPicker.vue'
import { useSystemPortal } from '@/composables/useSystemPortal'
import { showToast } from '@/composables/useToast'
import { ChevronDown, ChevronRight, LayoutGrid, Loader2 } from 'lucide-vue-next'

const router = useRouter()
const { t } = useI18n()
const { systemList, currentSystem, showSwitcher, switchToSystem, refreshSystemList } = useSystemPortal()

const open = ref(false)
const switching = ref(false)
const switchingId = ref<number | string | null>(null)
const keyword = ref('')
const rootRef = ref<HTMLElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)

const useCompactTrigger = computed(() => systemList.value.length > 8)

async function toggle() {
  open.value = !open.value
  if (open.value) {
    keyword.value = ''
    try {
      await refreshSystemList()
    } catch {
      /* keep cached list */
    }
    await nextTick()
    searchRef.value?.focus()
  }
}

function close() {
  open.value = false
  keyword.value = ''
}

function onDocClick(e: MouseEvent) {
  if (!open.value || !rootRef.value) return
  if (!rootRef.value.contains(e.target as Node)) close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

async function onSwitch(systemId: number | string) {
  if (currentSystem.value?.id === systemId) {
    close()
    return
  }
  switching.value = true
  switchingId.value = systemId
  try {
    const target = await switchToSystem(systemId)
    close()
    if (typeof target === 'string' && target.startsWith('http')) return
    await router.replace(typeof target === 'string' ? target : '/')
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.portal.switchFailed'))
  } finally {
    switching.value = false
    switchingId.value = null
  }
}

async function goPortal() {
  close()
  await router.push('/system-select')
}

watch(open, (value) => {
  if (value) document.addEventListener('keydown', onKeydown)
  else document.removeEventListener('keydown', onKeydown)
})

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div v-if="showSwitcher" ref="rootRef" class="relative">
    <button
      type="button"
      class="inline-flex max-w-[11rem] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10 sm:max-w-[12rem] sm:px-2.5"
      :disabled="switching"
      :aria-expanded="open"
      :title="currentSystem?.systemName || t('system.portal.pick')"
      @click.stop="toggle"
    >
      <LayoutGrid class="h-4 w-4 shrink-0 text-brand-500" />
      <span v-if="!useCompactTrigger" class="truncate">{{ currentSystem?.systemName || t('system.portal.pick') }}</span>
      <span v-else class="hidden truncate sm:inline">{{ currentSystem?.systemName || t('system.portal.pick') }}</span>
      <Loader2 v-if="switching" class="h-3.5 w-3.5 shrink-0 animate-spin" />
      <ChevronDown v-else class="h-3.5 w-3.5 shrink-0 opacity-60 transition" :class="open && 'rotate-180'" />
    </button>

    <div
      v-if="open"
      class="absolute right-0 z-50 mt-1 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-surface-dark-card"
      @click.stop
    >
      <div v-if="systemList.length > 4" class="border-b border-gray-100 p-2 dark:border-white/10">
        <div class="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 dark:border-white/10 dark:bg-white/5">
          <input
            ref="searchRef"
            v-model="keyword"
            type="search"
            class="field-input min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus:ring-0"
            :placeholder="t('system.portal.searchPlaceholder')"
          />
        </div>
      </div>

      <div class="max-h-[min(24rem,60vh)] overflow-y-auto py-1">
        <PortalSystemPicker
          v-model:search-query="keyword"
          :systems="systemList"
          variant="menu"
          :current-id="currentSystem?.id"
          :loading-id="switchingId"
          :show-search="false"
          @select="onSwitch"
        />
      </div>

      <div class="border-t border-gray-100 p-2 dark:border-white/10">
        <button
          type="button"
          class="system-switcher-portal-link group"
          @click="goPortal"
        >
          <span class="system-switcher-portal-icon" aria-hidden="true">
            <LayoutGrid class="h-4 w-4" />
          </span>
          <span class="min-w-0 flex-1 text-left">
            <span class="block truncate text-sm font-medium text-gray-800 dark:text-gray-100">
              {{ t('system.portal.allSystemsTitle') }}
            </span>
            <span class="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
              {{ t('system.portal.allSystemsHint', { count: systemList.length }) }}
            </span>
          </span>
          <ChevronRight
            class="h-4 w-4 shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-brand-500 dark:text-gray-500"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.system-switcher-portal-link {
  @apply flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2.5 text-left transition;
  @apply hover:border-brand-100 hover:bg-gradient-to-r hover:from-brand-50/90 hover:to-violet-50/60;
  @apply dark:hover:border-brand-500/20 dark:hover:from-brand-500/10 dark:hover:to-violet-500/5;
}

.system-switcher-portal-icon {
  @apply flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 text-white shadow-sm;
  @apply transition group-hover:shadow-md group-hover:shadow-brand-500/20;
}
</style>
