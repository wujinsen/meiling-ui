<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePageData } from '@/composables/usePageData'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import {
  Zap,
  GitBranch,
  Mail,
  Database,
  CreditCard,
  Bot,
  ChevronDown,
  GripVertical,
} from 'lucide-vue-next'

const { t } = useI18n()
const { workflowNodes, workflowTypeClass } = usePageData()

const expandedSections = ref(['trigger', 'target'])

const buildItems = computed(() => [
  { name: t('workflow.items.multiSplit'), icon: GitBranch, color: 'bg-purple-100 text-purple-600' },
  { name: t('workflow.items.condition'), icon: GitBranch, color: 'bg-blue-100 text-blue-600' },
  { name: t('workflow.items.delay'), icon: Zap, color: 'bg-amber-100 text-amber-600' },
])

const agents = computed(() => [
  { name: t('workflow.items.aiSummarize'), icon: Bot, color: 'bg-violet-100 text-violet-600' },
  { name: t('workflow.items.aiClassify'), icon: Bot, color: 'bg-indigo-100 text-indigo-600' },
])

const actions = computed(() => [
  { name: t('workflow.items.sendEmail'), icon: Mail, color: 'bg-sky-100 text-sky-600' },
  { name: t('workflow.items.updateCrm'), icon: Database, color: 'bg-emerald-100 text-emerald-600' },
  { name: t('workflow.items.stripeCharge'), icon: CreditCard, color: 'bg-orange-100 text-orange-600' },
])

function toggleSection(id: string) {
  const idx = expandedSections.value.indexOf(id)
  if (idx >= 0) expandedSections.value.splice(idx, 1)
  else expandedSections.value.push(id)
}
</script>

<template>
  <div class="card flex h-[calc(100vh-7rem)] gap-0 overflow-hidden p-0">
    <div class="w-72 shrink-0 overflow-y-auto border-r border-gray-100 p-4 dark:border-white/5">
      <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">{{ t('workflow.triggers') }}</p>

      <div class="mb-3 rounded-lg border border-gray-100 dark:border-white/10">
        <button
          class="flex w-full items-center justify-between p-3 text-left text-sm font-medium text-gray-900 dark:text-white"
          @click="toggleSection('trigger')"
        >
          {{ t('workflow.runWorkflow') }}
          <ChevronDown :class="['h-4 w-4 transition', expandedSections.includes('trigger') && 'rotate-180']" />
        </button>
        <div v-show="expandedSections.includes('trigger')" class="space-y-3 border-t border-gray-50 px-3 pb-3 pt-2 dark:border-white/5">
          <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="radio" name="schedule" checked class="text-brand-600" />
            {{ t('workflow.everyMonth') }}
          </label>
          <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="radio" name="schedule" class="text-brand-600" />
            {{ t('workflow.onEvent') }}
          </label>
          <select class="field-input">
            <option>{{ t('workflow.firstOfMonth') }}</option>
            <option>{{ t('workflow.fifteenthOfMonth') }}</option>
          </select>
        </div>
      </div>

      <div class="rounded-lg border border-gray-100 dark:border-white/10">
        <button
          class="flex w-full items-center justify-between p-3 text-left text-sm font-medium text-gray-900 dark:text-white"
          @click="toggleSection('target')"
        >
          {{ t('workflow.workflowTarget') }}
          <ChevronDown :class="['h-4 w-4 transition', expandedSections.includes('target') && 'rotate-180']" />
        </button>
        <div v-show="expandedSections.includes('target')" class="space-y-2 border-t border-gray-50 px-3 pb-3 pt-2 dark:border-white/5">
          <AppCheckbox size="sm" :model-value="true">
            {{ t('workflow.allContacts') }}
          </AppCheckbox>
          <AppCheckbox size="sm">
            {{ t('workflow.filterSegment') }}
          </AppCheckbox>
        </div>
      </div>
    </div>

    <div class="relative min-w-0 flex-1 overflow-auto dot-grid bg-gray-50/80 dark:bg-surface-dark/50">
      <div class="absolute left-4 top-4 text-sm text-gray-500 dark:text-gray-400">
        {{ t('workflow.breadcrumb') }}
      </div>
      <div class="absolute right-4 top-4 text-xs text-gray-400">{{ t('workflow.lastSaved') }}</div>

      <svg class="pointer-events-none absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <line x1="200" y1="100" x2="200" y2="200" stroke="#d1d5db" stroke-width="2" class="dark:stroke-gray-600" />
        <line x1="200" y1="260" x2="200" y2="340" stroke="#d1d5db" stroke-width="2" class="dark:stroke-gray-600" />
        <line x1="200" y1="380" x2="200" y2="460" stroke="#d1d5db" stroke-width="2" class="dark:stroke-gray-600" />
        <line x1="240" y1="420" x2="360" y2="420" stroke="#d1d5db" stroke-width="2" class="dark:stroke-gray-600" />
        <text x="250" y="410" class="fill-gray-400 text-xs">{{ t('chart.branch.true') }}</text>
        <text x="170" y="450" class="fill-gray-400 text-xs">{{ t('chart.branch.false') }}</text>
        <text x="300" y="410" class="fill-gray-400 text-xs">{{ t('chart.branch.exit') }}</text>
      </svg>

      <div
        v-for="node in workflowNodes"
        :key="node.id"
        class="absolute w-56 cursor-grab rounded-xl border border-gray-200 bg-white p-4 shadow-card transition hover:shadow-card-hover active:cursor-grabbing dark:border-white/10 dark:bg-surface-dark-elevated"
        :style="{ left: `${node.x}px`, top: `${node.y + 60}px` }"
      >
        <div class="mb-2 flex items-center gap-2">
          <GripVertical class="h-4 w-4 text-gray-300" />
          <span :class="['badge', workflowTypeClass(node.type)]">{{ t(`workflowType.${node.type}`) }}</span>
        </div>
        <p class="text-sm font-medium text-gray-900 dark:text-white">{{ node.title }}</p>
      </div>
    </div>

    <div class="w-64 shrink-0 overflow-y-auto border-l border-gray-100 p-4 dark:border-white/5">
      <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">{{ t('workflow.build') }}</p>
      <div class="space-y-2">
        <div
          v-for="item in buildItems"
          :key="item.name"
          class="flex cursor-grab items-center gap-3 rounded-lg border border-gray-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/50 dark:border-white/10 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/10"
        >
          <div :class="['flex h-8 w-8 items-center justify-center rounded-lg', item.color]">
            <component :is="item.icon" class="h-4 w-4" />
          </div>
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ item.name }}</span>
        </div>
      </div>

      <p class="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-gray-400">{{ t('workflow.agents') }}</p>
      <div class="space-y-2">
        <div
          v-for="item in agents"
          :key="item.name"
          class="flex cursor-grab items-center gap-3 rounded-lg border border-gray-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/50 dark:border-white/10 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/10"
        >
          <div :class="['flex h-8 w-8 items-center justify-center rounded-lg', item.color]">
            <component :is="item.icon" class="h-4 w-4" />
          </div>
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ item.name }}</span>
        </div>
      </div>

      <p class="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-gray-400">{{ t('workflow.actions') }}</p>
      <div class="space-y-2">
        <div
          v-for="item in actions"
          :key="item.name"
          class="flex cursor-grab items-center gap-3 rounded-lg border border-gray-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/50 dark:border-white/10 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/10"
        >
          <div :class="['flex h-8 w-8 items-center justify-center rounded-lg', item.color]">
            <component :is="item.icon" class="h-4 w-4" />
          </div>
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ item.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
