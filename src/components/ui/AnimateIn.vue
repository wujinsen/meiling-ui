<script setup lang="ts">
import { computed } from 'vue'
import { useReducedMotion } from '@vueuse/motion'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    index?: number
    delay?: number
    y?: number
  }>(),
  { index: 0, delay: 0, y: 24 }
)

const reduced = useReducedMotion()

const style = computed(() => ({
  '--stagger-delay': `${props.delay + props.index * 80}ms`,
  '--stagger-y': `${props.y}px`,
}))
</script>

<template>
  <div
    v-bind="$attrs"
    :class="[reduced ? undefined : 'motion-fade-up', 'min-w-0']"
    :style="style"
  >
    <slot />
  </div>
</template>
