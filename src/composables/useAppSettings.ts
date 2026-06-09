import { ref, watch } from 'vue'

const STORAGE_KEY = 'meiling-app-settings'

export interface AppSettings {
  emailNotifications: boolean
  browserNotifications: boolean
  weeklyDigest: boolean
  dealAlerts: boolean
}

const defaults: AppSettings = {
  emailNotifications: true,
  browserNotifications: false,
  weeklyDigest: true,
  dealAlerts: true,
}

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaults }
    return { ...defaults, ...JSON.parse(raw) }
  } catch {
    return { ...defaults }
  }
}

const settings = ref<AppSettings>(load())

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
