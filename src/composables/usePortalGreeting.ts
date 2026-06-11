import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export function usePortalGreeting() {
  const { t } = useI18n()

  const greeting = computed(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return t('system.portal.greetingMorning')
    if (hour >= 12 && hour < 18) return t('system.portal.greetingAfternoon')
    if (hour >= 18 && hour < 23) return t('system.portal.greetingEvening')
    return t('system.portal.greetingNight')
  })

  return { greeting }
}
