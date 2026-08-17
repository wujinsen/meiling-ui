<script setup lang="ts">

import { computed } from 'vue'

import { useRoute } from 'vue-router'

import { useI18n } from 'vue-i18n'

import { Search, Plus, Share2, Filter, ChevronDown, Upload, Sparkles, Menu } from 'lucide-vue-next'

import ThemeToggle from '@/components/ui/ThemeToggle.vue'

import PerspectiveToggle from '@/components/ui/PerspectiveToggle.vue'

import LanguageSwitcher from '@/components/ui/LanguageSwitcher.vue'

import AppBreadcrumb from '@/components/layout/AppBreadcrumb.vue'
import AppUserMenu from '@/components/layout/AppUserMenu.vue'
import NoticeFeedPanel from '@/components/layout/NoticeFeedPanel.vue'
import SystemSwitcher from '@/components/layout/SystemSwitcher.vue'

import OperationTaskHeaderBadge from '@/components/operation/OperationTaskHeaderBadge.vue'

import { useCommandPalette } from '@/composables/useCommandPalette'

import { useMobileSidebar } from '@/composables/useMobileSidebar'

import { useAnalyticsFilters } from '@/composables/useAnalyticsFilters'



const route = useRoute()

const { t } = useI18n()

const { open: openPalette } = useCommandPalette()

const { toggle: toggleSidebar } = useMobileSidebar()

const { toggle: toggleFilters } = useAnalyticsFilters()



const isWorkflow = computed(() => route.name === 'workflows')

const isAnalytics = computed(() => route.name === 'BI')

const isPulse = computed(() => route.name === 'pulse')

</script>



<template>

  <header

    class="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 bg-gray-50 px-4 dark:border-white/5 dark:bg-surface-dark-card/80 dark:backdrop-blur sm:px-6"

  >

    <div class="flex items-center gap-2 sm:gap-3">

      <button

        type="button"

        class="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 lg:hidden dark:text-gray-400 dark:hover:bg-white/5"

        :aria-label="t('common.menu')"

        @click="toggleSidebar"

      >

        <Menu class="h-5 w-5" />

      </button>

      <AppBreadcrumb />

      <span

        v-if="isWorkflow"

        class="badge bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"

      >{{ t('common.draft') }}</span>

      <span

        v-if="isPulse"

        class="hidden text-sm text-gray-500 dark:text-gray-400 sm:inline"

      >{{ t('pulse.workspace') }}</span>

    </div>



    <div v-if="!isWorkflow" class="mx-4 hidden max-w-md flex-1 md:flex">

      <button

        type="button"

        class="relative w-full text-left"

        @click="openPalette"

      >

        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

        <span

          class="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-16 text-sm text-gray-400 transition hover:border-brand-300 dark:border-white/10 dark:bg-white/5 dark:hover:border-brand-500/40"

        >

          {{ t('command.placeholder') }}

        </span>

        <kbd class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-400 dark:border-white/10 dark:bg-surface-dark-elevated dark:text-gray-500">

          ⌘K

        </kbd>

      </button>

    </div>



    <div class="flex items-center gap-1 sm:gap-2">

      <button

        type="button"

        class="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 md:hidden dark:text-gray-400 dark:hover:bg-white/5"

        :aria-label="t('common.search')"

        @click="openPalette"

      >

        <Search class="h-5 w-5" />

      </button>

      <SystemSwitcher />

      <OperationTaskHeaderBadge />

      <LanguageSwitcher />

      <PerspectiveToggle />

      <ThemeToggle />



      <template v-if="isWorkflow">

        <button class="btn-ghost hidden sm:inline-flex">{{ t('common.moveToFolder') }}</button>

        <button class="btn-ghost hidden sm:inline-flex"><Share2 class="h-4 w-4" /> {{ t('common.share') }}</button>

        <button class="btn-primary hidden sm:inline-flex">{{ t('common.launchWorkflow') }}</button>

        <button class="btn-primary"><Plus class="h-4 w-4" /> {{ t('common.create') }}</button>

      </template>

      <template v-else>

        <button

          v-if="isAnalytics"

          type="button"

          class="btn-ghost hidden sm:inline-flex"

          @click="toggleFilters"

        >

          <Filter class="h-4 w-4" /> {{ t('common.showFilters') }}

        </button>

        <button v-if="isAnalytics" class="btn-ghost hidden lg:inline-flex">

          {{ t('common.thisMonth') }} <ChevronDown class="h-4 w-4" />

        </button>

        <button v-if="isAnalytics" class="btn-ghost hidden lg:inline-flex">

          <Upload class="h-4 w-4" /> {{ t('common.import') }}

        </button>

        <button v-if="isAnalytics" class="btn-ghost hidden lg:inline-flex">

          <Share2 class="h-4 w-4" /> {{ t('common.share') }}

        </button>

        <button

          v-if="isPulse"

          class="hidden items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-500/25 transition hover:opacity-90 sm:inline-flex"

        >

          <Sparkles class="h-4 w-4" />

          {{ t('pulse.openPulseAi') }}

        </button>

        <NoticeFeedPanel />

        <button class="btn-primary">

          <Plus class="h-4 w-4" /> <span class="hidden sm:inline">{{ t('common.create') }}</span>

        </button>

      </template>

      <AppUserMenu />

    </div>

  </header>

</template>

