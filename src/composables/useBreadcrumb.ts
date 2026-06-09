import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { usePermission } from '@/composables/usePermission'
import { buildBreadcrumbs, resolveRouteTitle } from '@/utils/breadcrumb'

export function useBreadcrumb() {
  const route = useRoute()
  const { t, locale } = useI18n()
  const { menus } = usePermission()

  const breadcrumbs = computed(() => buildBreadcrumbs(menus.value, route, t, locale.value))
  const title = computed(() => resolveRouteTitle(route, t))

  return { breadcrumbs, title }
}
