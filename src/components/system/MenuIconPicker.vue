<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, Circle } from 'lucide-vue-next'
import { useEscapeClose } from '@/composables/useEscapeClose'
import {
  getMenuIconLabel,
  matchMenuIconQuery,
  MENU_ICON_OPTIONS,
  resolveMenuIcon,
} from '@/utils/menuIcons'

const model = defineModel<string>({ default: '' })

const { t } = useI18n()
const open = ref(false)
const keyword = ref('')
const root = ref<HTMLElement>()

useEscapeClose(open, () => {
  open.value = false
  keyword.value = ''
})

const selectedLabel = computed(() => getMenuIconLabel(model.value, t))

const filteredIcons = computed(() => {
  const q = keyword.value.trim()
  if (!q) return MENU_ICON_OPTIONS
  return MENU_ICON_OPTIONS.filter((key) => matchMenuIconQuery(key, q, t))
})

function selectIcon(key: string) {
  model.value = key
  open.value = false
  keyword.value = ''
}

function toggleOpen() {
  open.value = !open.value
  if (!open.value) keyword.value = ''
}

function onDocClick(e: MouseEvent) {
  if (!open.value || !root.value) return
  if (!root.value.contains(e.target as Node)) {
    open.value = false
    keyword.value = ''
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div ref="root" class="menu-icon-picker">
    <button
      type="button"
      class="menu-icon-picker-trigger field-input"
      :aria-expanded="open"
      @click.stop="toggleOpen"
    >
      <span class="menu-icon-picker-value">
        <component :is="resolveMenuIcon(model)" class="h-4 w-4 shrink-0" />
        <span class="truncate">{{ selectedLabel }}</span>
      </span>
      <ChevronDown
        class="h-4 w-4 shrink-0 text-gray-400 transition"
        :class="open && 'rotate-180'"
      />
    </button>

    <div v-if="open" class="menu-icon-picker-panel" @click.stop>
      <input
        v-model="keyword"
        type="text"
        class="field-input"
        :placeholder="t('system.menu.iconSearch')"
      />
      <div class="menu-icon-picker-scroll">
        <div class="menu-icon-picker-grid">
          <button
            type="button"
            class="menu-icon-grid-item"
            :class="{ 'menu-icon-grid-item-active': !model }"
            @click="selectIcon('')"
          >
            <Circle class="menu-icon-grid-icon" />
            <span class="menu-icon-grid-label">{{ t('system.menu.iconNone') }}</span>
          </button>
          <button
            v-for="key in filteredIcons"
            :key="key"
            type="button"
            class="menu-icon-grid-item"
            :class="{ 'menu-icon-grid-item-active': model === key }"
            @click="selectIcon(key)"
          >
            <component :is="resolveMenuIcon(key)" class="menu-icon-grid-icon" />
            <span class="menu-icon-grid-label">{{ getMenuIconLabel(key, t) }}</span>
          </button>
        </div>
        <p v-if="!filteredIcons.length" class="menu-icon-picker-empty">
          {{ t('system.menu.iconEmpty') }}
        </p>
      </div>
    </div>
  </div>
</template>
