<script setup lang="ts">
const model = defineModel<boolean>({ default: false })

const props = defineProps<{
  disabled?: boolean
  label?: string
  /** 为 true 时仅 emit change，由父组件确认后再更新值 */
  confirmBeforeChange?: boolean
}>()

const emit = defineEmits<{ change: [value: boolean] }>()

function toggle() {
  if (props.disabled) return
  const next = !model.value
  if (props.confirmBeforeChange) {
    emit('change', next)
    return
  }
  model.value = next
  emit('change', next)
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="model"
    :aria-label="label"
    :disabled="disabled"
    :class="[
      'status-switch',
      model ? 'status-switch--on' : 'status-switch--off',
      disabled ? 'status-switch--disabled' : '',
    ]"
    @click="toggle"
  >
    <span class="status-switch__track" aria-hidden="true">
      <span class="status-switch__knob" />
    </span>
  </button>
</template>
