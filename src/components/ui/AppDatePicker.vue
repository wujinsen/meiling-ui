<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-vue-next'
import {
  formatDateDisplay,
  formatDateValue,
  getMonthGrid,
  isSameDay,
  parseDateValue,
  startOfMonth,
} from '@/utils/datePicker'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    disabled?: boolean
  }>(),
  {
    modelValue: '',
    placeholder: '',
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t, locale } = useI18n()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const panelStyle = ref({ top: '0px', left: '0px', minWidth: '18rem' })

const viewMonth = ref(startOfMonth(new Date()))
const selectedDate = computed(() => parseDateValue(props.modelValue))
const today = computed(() => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
})

const displayText = computed(() =>
  props.modelValue ? formatDateDisplay(props.modelValue, locale.value) : '',
)

const monthTitle = computed(() => {
  const tag = locale.value === 'zh' ? 'zh-CN' : locale.value === 'ja' ? 'ja-JP' : 'en-US'
  return viewMonth.value.toLocaleDateString(tag, { year: 'numeric', month: 'long' })
})

const weekdayLabels = computed(() =>
  (t('common.datePicker.weekdays') as string).split(',').map((item) => item.trim()),
)

const calendarCells = computed(() =>
  getMonthGrid(viewMonth.value.getFullYear(), viewMonth.value.getMonth()),
)

function updatePanelPosition() {
  const anchor = rootRef.value
  if (!anchor) return
  const rect = anchor.getBoundingClientRect()
  const panelWidth = 288
  const gap = 6
  let left = rect.left
  const maxLeft = window.innerWidth - panelWidth - 12
  if (left > maxLeft) left = Math.max(12, maxLeft)

  let top = rect.bottom + gap
  const panelHeight = panelRef.value?.offsetHeight ?? 340
  if (top + panelHeight > window.innerHeight - 12) {
    top = Math.max(12, rect.top - panelHeight - gap)
  }

  panelStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${Math.max(rect.width, panelWidth)}px`,
  }
}

function syncViewMonth() {
  const base = selectedDate.value ?? today.value
  viewMonth.value = startOfMonth(base)
}

async function openPanel() {
  if (props.disabled) return
  syncViewMonth()
  open.value = true
  await nextTick()
  updatePanelPosition()
}

function closePanel() {
  open.value = false
}

function selectDay(day: number, inMonth: boolean) {
  if (!inMonth) {
    const offset = day > 15 ? -1 : 1
    viewMonth.value = new Date(viewMonth.value.getFullYear(), viewMonth.value.getMonth() + offset, day)
    return
  }
  const next = new Date(viewMonth.value.getFullYear(), viewMonth.value.getMonth(), day)
  emit('update:modelValue', formatDateValue(next))
  closePanel()
}

function pickToday() {
  emit('update:modelValue', formatDateValue(today.value))
  closePanel()
}

function clearValue() {
  emit('update:modelValue', '')
  closePanel()
}

function prevMonth() {
  viewMonth.value = new Date(viewMonth.value.getFullYear(), viewMonth.value.getMonth() - 1, 1)
}

function nextMonth() {
  viewMonth.value = new Date(viewMonth.value.getFullYear(), viewMonth.value.getMonth() + 1, 1)
}

function cellDate(day: number, inMonth: boolean): Date {
  const monthOffset = inMonth ? 0 : day > 15 ? -1 : 1
  return new Date(viewMonth.value.getFullYear(), viewMonth.value.getMonth() + monthOffset, day)
}

function cellClass(day: number, inMonth: boolean) {
  const date = cellDate(day, inMonth)
  const selected = selectedDate.value && isSameDay(date, selectedDate.value)
  const isToday = isSameDay(date, today.value)
  return {
    'date-picker-day--muted': !inMonth,
    'date-picker-day--selected': Boolean(selected && inMonth),
    'date-picker-day--today': isToday && !selected,
  }
}

function onDocumentPointerDown(event: MouseEvent) {
  if (!open.value) return
  const target = event.target as Node
  if (rootRef.value?.contains(target) || panelRef.value?.contains(target)) return
  closePanel()
}

function onDocumentKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') closePanel()
}

watch(open, (value) => {
  if (value) {
    document.addEventListener('mousedown', onDocumentPointerDown)
    document.addEventListener('keydown', onDocumentKeyDown)
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
  } else {
    document.removeEventListener('mousedown', onDocumentPointerDown)
    document.removeEventListener('keydown', onDocumentKeyDown)
    window.removeEventListener('resize', updatePanelPosition)
    window.removeEventListener('scroll', updatePanelPosition, true)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeyDown)
  window.removeEventListener('resize', updatePanelPosition)
  window.removeEventListener('scroll', updatePanelPosition, true)
})
</script>

<template>
  <div ref="rootRef" class="date-picker">
    <div
      class="date-picker-trigger field-input"
      :class="{ 'date-picker-trigger--empty': !displayText, 'date-picker-trigger--open': open, 'date-picker-trigger--disabled': disabled }"
    >
      <button
        type="button"
        class="date-picker-main"
        :disabled="disabled"
        @click="openPanel"
      >
        <Calendar class="date-picker-icon" aria-hidden="true" />
        <span class="date-picker-value">{{ displayText || placeholder || t('common.datePicker.placeholder') }}</span>
      </button>
      <button
        v-if="modelValue && !disabled"
        type="button"
        class="date-picker-clear"
        :title="t('common.datePicker.clear')"
        @click.stop="clearValue"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="date-picker-panel"
        :style="panelStyle"
        role="dialog"
        :aria-label="t('common.datePicker.placeholder')"
      >
        <div class="date-picker-header">
          <button type="button" class="date-picker-nav" @click="prevMonth">
            <ChevronLeft class="h-4 w-4" />
          </button>
          <div class="date-picker-title">{{ monthTitle }}</div>
          <button type="button" class="date-picker-nav" @click="nextMonth">
            <ChevronRight class="h-4 w-4" />
          </button>
        </div>

        <div class="date-picker-weekdays">
          <span v-for="label in weekdayLabels" :key="label" class="date-picker-weekday">{{ label }}</span>
        </div>

        <div class="date-picker-grid">
          <button
            v-for="(cell, index) in calendarCells"
            :key="`${cell.inMonth}-${cell.day}-${index}`"
            type="button"
            class="date-picker-day"
            :class="cellClass(cell.day, cell.inMonth)"
            @click="selectDay(cell.day, cell.inMonth)"
          >
            {{ cell.day }}
          </button>
        </div>

        <div class="date-picker-footer">
          <button type="button" class="date-picker-footer-btn" @click="pickToday">
            {{ t('common.datePicker.today') }}
          </button>
          <button type="button" class="date-picker-footer-btn" @click="clearValue">
            {{ t('common.datePicker.clear') }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
