<script setup lang="ts">

import { ref, onMounted, nextTick, watch } from 'vue'

import { useReducedMotion } from '@vueuse/motion'



const props = defineProps<{

  percent: number

  colorClass?: string

  trackClass?: string

  barClass?: string

  striped?: boolean

  targetLabel?: string

}>()



const width = ref(0)

const reduced = useReducedMotion()



onMounted(() => {
  if (reduced.value) {
    width.value = props.percent
    return
  }
  nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        width.value = props.percent
      })
    })
  })
})

watch(
  () => props.percent,
  (value) => {
    width.value = value
  },
)

</script>



<template>

  <div class="relative">

    <div

      :class="[

        trackClass || 'h-1.5',

        'overflow-hidden rounded-full',

        striped ? 'progress-track-striped bg-gray-100 dark:bg-white/10' : 'bg-gray-100 dark:bg-white/10',

      ]"

    >

      <div

        :class="['h-full rounded-full transition-all duration-[1200ms] ease-out', barClass || colorClass || 'bg-brand-500']"

        :style="{ width: `${width}%` }"

      />

    </div>

    <span

      v-if="targetLabel"

      class="absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full pl-2 text-xs font-medium text-gray-400 dark:text-gray-500"

    >

      {{ targetLabel }}

    </span>

  </div>

</template>

