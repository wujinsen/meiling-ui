<script setup lang="ts">
import { useReducedMotion } from '@vueuse/motion'

const reduced = useReducedMotion()
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <component
      v-if="reduced"
      :is="Component"
      :key="route.path"
      class="page-view"
    />
    <Transition v-else name="page" mode="out-in">
      <component :is="Component" :key="route.path" class="page-view" />
    </Transition>
  </RouterView>
</template>
