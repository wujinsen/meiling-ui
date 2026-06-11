import { createApp } from 'vue'
import { MotionPlugin } from '@vueuse/motion'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { initTheme } from './composables/useTheme'
import { initPerspective } from './composables/usePerspective'
import { initActionPermissions, setupPermissionsAutoRefresh } from '@/composables/useActionPermissions'
import { initAuth } from './composables/useAuth'
import { initPermission } from './composables/usePermission'
import { initSystemPortal } from './composables/useSystemPortal'
import './style.css'

initTheme()
initPerspective()
initAuth()
initSystemPortal()
initActionPermissions()
setupPermissionsAutoRefresh()
initPermission()
createApp(App).use(i18n).use(MotionPlugin).use(router).mount('#app')
