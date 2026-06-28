<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { ref, watch } from 'vue'

const model = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    label?: string
    /** option = 带边框的可点击选项卡样式 */
    variant?: 'default' | 'option'
    size?: 'md' | 'sm'
    /** 仅渲染勾选框，无文案（表格/列表项内嵌） */
    standalone?: boolean
    indeterminate?: boolean
  }>(),
  { variant: 'default', size: 'md', standalone: false, indeterminate: false },
)

const emit = defineEmits<{ change: [value: boolean] }>()

const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.indeterminate,
  (value) => {
    if (inputRef.value) inputRef.value.indeterminate = Boolean(value)
  },
  { immediate: true },
)

function onChange(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  model.value = checked
  emit('change', checked)
}
</script>

<template>
  <label
    class="app-checkbox"
    :class="[
      variant === 'option' ? 'app-checkbox--option' : '',
      size === 'sm' ? 'app-checkbox--sm' : '',
      standalone ? 'app-checkbox--standalone' : '',
      { 'app-checkbox--disabled': disabled, 'app-checkbox--checked': model, 'app-checkbox--indeterminate': indeterminate },
    ]"
  >
    <input
      ref="inputRef"
      v-model="model"
      type="checkbox"
      class="app-checkbox__input"
      :disabled="disabled"
      @change="onChange"
    />
    <span class="app-checkbox__control" aria-hidden="true">
      <Check class="app-checkbox__icon" stroke-width="3" />
    </span>
    <span v-if="!standalone && (label || $slots.default)" class="app-checkbox__label">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>
