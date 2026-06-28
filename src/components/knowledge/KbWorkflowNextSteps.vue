<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowRight } from 'lucide-vue-next'
import type { KbWorkflowHintVo } from '@/types/knowledge'

defineProps<{
  steps: KbWorkflowHintVo[]
  title?: string
}>()

const router = useRouter()
const { t } = useI18n()

function hintRoute(hint: KbWorkflowHintVo) {
  let path = hint.routePath.replace(/^\//, '')
  if (path.endsWith('/index')) path = path.replace(/\/index$/, '')
  return { path: `/${path}`, query: hint.routeQuery }
}

function navigate(hint: KbWorkflowHintVo) {
  void router.push(hintRoute(hint))
}
</script>

<template>
  <section
    v-if="steps.length"
    class="rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3 dark:border-brand-500/30 dark:bg-brand-500/10"
  >
    <p class="text-sm font-semibold text-brand-900 dark:text-brand-200">
      {{ title ?? t('knowledge.ingest.nextSteps.title') }}
    </p>
    <div class="mt-2 flex flex-wrap gap-2">
      <button
        v-for="step in steps"
        :key="step.key"
        type="button"
        class="btn-ghost inline-flex items-center gap-1.5 border border-brand-200 bg-white text-sm dark:border-brand-500/30 dark:bg-gray-900/40"
        :title="step.description"
        @click="navigate(step)"
      >
        {{ step.label }}
        <ArrowRight class="h-3.5 w-3.5 opacity-70" />
      </button>
    </div>
  </section>
</template>
