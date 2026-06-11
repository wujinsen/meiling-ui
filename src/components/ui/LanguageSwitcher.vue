<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Check, ChevronDown, Languages } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { setLocale, useLocale, type AppLocale } from '@/i18n'

const { locale, t } = useI18n()
const { options } = useLocale()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const currentOption = computed(() => options.find((opt) => opt.value === locale.value) ?? options[0])

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function pick(value: AppLocale) {
  if (value !== locale.value) setLocale(value)
  close()
}

function onDocClick(e: MouseEvent) {
  if (!open.value || !rootRef.value) return
  if (!rootRef.value.contains(e.target as Node)) close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      class="lang-switcher-trigger"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click.stop="toggle"
    >
      <span class="lang-switcher-icon">
        <Languages class="h-4 w-4" />
      </span>
      <span class="lang-switcher-label">{{ currentOption.label }}</span>
      <ChevronDown class="lang-switcher-chevron" :class="open && 'rotate-180'" />
    </button>

    <Transition name="lang-menu">
      <div
        v-if="open"
        class="lang-switcher-menu"
        role="listbox"
        :aria-activedescendant="`locale-${locale}`"
        @click.stop
      >
        <p class="lang-switcher-menu-title">{{ t('settings.appearance.language') }}</p>
        <ul class="lang-switcher-options">
          <li v-for="opt in options" :key="opt.value">
            <button
              :id="`locale-${opt.value}`"
              type="button"
              role="option"
              :aria-selected="locale === opt.value"
              :class="['lang-switcher-option', locale === opt.value && 'lang-switcher-option-active']"
              @click="pick(opt.value)"
            >
              <span class="lang-switcher-option-main">
                <span class="lang-switcher-option-label">{{ opt.label }}</span>
                <span class="lang-switcher-option-hint">{{ opt.hint }}</span>
              </span>
              <Check v-if="locale === opt.value" class="lang-switcher-check h-4 w-4 shrink-0" />
            </button>
          </li>
        </ul>
      </div>
    </Transition>
  </div>
</template>
