<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const model = defineModel<string | number | null>()

withDefaults(
  defineProps<{
    type?: string
    size?: 'md' | 'sm'
    inline?: boolean
    multiline?: boolean
    rows?: number
  }>(),
  { type: 'text', size: 'md', inline: false, multiline: false, rows: 3 },
)
</script>

<template>
  <textarea
    v-if="multiline"
    v-model="model"
    class="field-input resize-y"
    :class="[size === 'sm' && 'field-input-sm', inline && 'field-input-inline']"
    :rows="rows"
    v-bind="$attrs"
  />
  <input
    v-else
    v-model="model"
    :type="type"
    class="field-input"
    :class="[size === 'sm' && 'field-input-sm', inline && 'field-input-inline']"
    v-bind="$attrs"
  />
</template>
