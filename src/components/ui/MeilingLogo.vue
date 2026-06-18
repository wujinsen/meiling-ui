<script setup lang="ts">
import { computed } from 'vue'
import logoIconUrl from '@/assets/logo-icon.webp'
import logoFullUrl from '@/assets/logo-full.webp'

const props = withDefaults(
  defineProps<{
    size?: number
    variant?: 'icon' | 'full'
  }>(),
  { size: 40, variant: 'icon' },
)

const src = computed(() => (props.variant === 'full' ? logoFullUrl : logoIconUrl))
</script>

<template>
  <img
    :src="src"
    alt=""
    draggable="false"
    :width="variant === 'full' ? undefined : size"
    :height="variant === 'full' ? undefined : size"
    :class="variant === 'full' ? 'brand-logo-full' : 'brand-logo-icon'"
  />
</template>
