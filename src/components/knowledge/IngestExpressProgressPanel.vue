<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Loader2 } from 'lucide-vue-next'
import AnimatedProgress from '@/components/ui/AnimatedProgress.vue'

const EXPRESS_STEPS = ['create', 'plan', 'generate', 'lint', 'commit', 'sync'] as const

export type IngestExpressProgressStep = (typeof EXPRESS_STEPS)[number]

const props = defineProps<{
  active: boolean
  stage: IngestExpressProgressStep | null
  percent: number
  templateMode?: boolean
}>()

const { t } = useI18n()

const hint = computed(() => {
  if (!props.stage) return ''
  if (props.stage === 'generate' && props.templateMode) {
    return t('knowledge.ingest.expressProgress.generateTemplate')
  }
  return t(`knowledge.ingest.expressProgress.${props.stage}`)
})

function stepIndex(step: IngestExpressProgressStep) {
  return EXPRESS_STEPS.indexOf(step)
}

function stepState(step: IngestExpressProgressStep): 'done' | 'active' | 'pending' {
  if (!props.stage) return 'pending'
  const cur = stepIndex(props.stage)
  const idx = stepIndex(step)
  if (idx < cur) return 'done'
  if (idx === cur) return 'active'
  return 'pending'
}

function stepLabel(step: IngestExpressProgressStep) {
  return t(`knowledge.ingest.expressProgress.${step}Short`)
}
</script>

<template>
  <div
    v-if="active && stage"
    class="kb-ingest-express-progress rounded-xl border border-brand-200/80 bg-brand-50/50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10"
  >
    <div class="mb-2 flex items-center justify-between gap-3">
      <p class="text-sm font-medium text-brand-900 dark:text-brand-100">{{ hint }}</p>
      <span class="shrink-0 text-xs tabular-nums text-brand-700/80 dark:text-brand-200/80">
        {{ Math.round(percent) }}%
      </span>
    </div>
    <AnimatedProgress
      :percent="percent"
      striped
      track-class="h-2"
      bar-class="bg-gradient-to-r from-brand-500 to-emerald-500"
    />
    <ul class="mt-3 grid gap-1.5 sm:grid-cols-2">
      <li
        v-for="step in EXPRESS_STEPS"
        :key="step"
        class="kb-ingest-express-progress-step flex items-center gap-2 text-xs"
        :class="{
          'kb-ingest-express-progress-step--active': stepState(step) === 'active',
          'kb-ingest-express-progress-step--done': stepState(step) === 'done',
        }"
      >
        <Loader2 v-if="stepState(step) === 'active'" class="h-3.5 w-3.5 shrink-0 animate-spin text-brand-600" />
        <Check v-else-if="stepState(step) === 'done'" class="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        <span v-else class="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-gray-300 dark:border-white/20" />
        <span>{{ stepLabel(step) }}</span>
      </li>
    </ul>
  </div>
</template>
