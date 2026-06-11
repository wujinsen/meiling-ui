import { createI18n } from 'vue-i18n'
import zh from './locales/zh'
import en from './locales/en'
import ja from './locales/ja'

export type AppLocale = 'zh' | 'en' | 'ja'

const STORAGE_KEY = 'meiling-locale'

function getDefaultLocale(): AppLocale {
  const saved = localStorage.getItem(STORAGE_KEY) as AppLocale | null
  if (saved && ['zh', 'en', 'ja'].includes(saved)) return saved
  const browser = navigator.language.toLowerCase()
  if (browser.startsWith('zh')) return 'zh'
  if (browser.startsWith('ja')) return 'ja'
  return 'en'
}

const localeMessages = { zh, en, ja }

function applyHtmlLang(locale: AppLocale) {
  const map: Record<AppLocale, string> = { zh: 'zh-CN', en: 'en', ja: 'ja' }
  document.documentElement.lang = map[locale]
}

function applyDocumentTitle(locale: AppLocale) {
  document.title = localeMessages[locale].app.title
}

export const i18n = createI18n({
  legacy: false,
  locale: getDefaultLocale(),
  fallbackLocale: 'en',
  messages: { zh, en, ja },
})

const initialLocale = i18n.global.locale.value as AppLocale
applyHtmlLang(initialLocale)
applyDocumentTitle(initialLocale)

export function setLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  applyHtmlLang(locale)
  applyDocumentTitle(locale)
}

export function useLocale() {
  const locale = i18n.global.locale as { value: AppLocale }
  return {
    locale,
    setLocale,
    options: [
      { value: 'zh' as const, label: '中文', hint: '简体中文' },
      { value: 'en' as const, label: 'English', hint: 'English' },
      { value: 'ja' as const, label: '日本語', hint: 'Japanese' },
    ],
  }
}
