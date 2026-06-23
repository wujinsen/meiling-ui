import { ref, watch } from 'vue'

const STORAGE_KEY = 'meiling-app-settings'

export type FontSizePreset = 'sm' | 'md' | 'lg' | 'xl'

const FONT_SIZE_MAP: Record<FontSizePreset, string> = {
  sm: '14px',
  md: '16px',
  lg: '18px',
  xl: '20px',
}

export interface AppSettings {
  fontSize: FontSizePreset
  emailNotifications: boolean
  browserNotifications: boolean
  weeklyDigest: boolean
  dealAlerts: boolean
}

const defaults: AppSettings = {
  fontSize: 'md',
  emailNotifications: true,
  browserNotifications: false,
  weeklyDigest: true,
  dealAlerts: true,
}

function normalizeFontSize(value: unknown): FontSizePreset {
  if (value === 'sm' || value === 'md' || value === 'lg' || value === 'xl') return value
  return defaults.fontSize
}

export function applyFontSize(preset: FontSizePreset) {
  document.documentElement.style.setProperty('--app-root-font-size', FONT_SIZE_MAP[preset])
  document.documentElement.dataset.fontSize = preset
}

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      applyFontSize(defaults.fontSize)
      return { ...defaults }
    }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    const merged: AppSettings = {
      ...defaults,
      ...parsed,
      fontSize: normalizeFontSize(parsed.fontSize),
    }
    applyFontSize(merged.fontSize)
    return merged
  } catch {
    applyFontSize(defaults.fontSize)
    return { ...defaults }
  }
}

const settings = ref<AppSettings>(load())

watch(
  () => settings.value.fontSize,
  (preset) => applyFontSize(preset),
)

watch(
  settings,
  (value) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  },
  { deep: true },
)

export function useAppSettings() {
  function resetNotifications() {
    settings.value = {
      ...settings.value,
      emailNotifications: defaults.emailNotifications,
      browserNotifications: defaults.browserNotifications,
      weeklyDigest: defaults.weeklyDigest,
      dealAlerts: defaults.dealAlerts,
    }
  }

  return {
    settings,
    resetNotifications,
  }
}
