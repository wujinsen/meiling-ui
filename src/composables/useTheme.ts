import { computed, ref } from 'vue'

const STORAGE_KEY = 'meiling-theme'

const isDark = ref(false)

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function applyTheme(dark: boolean) {
  isDark.value = dark
  document.documentElement.classList.toggle('dark', dark)
  localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
}

function applyThemeWithCssFallback(next: boolean) {
  document.documentElement.classList.add('theme-switching')
  applyTheme(next)
  window.setTimeout(() => {
    document.documentElement.classList.remove('theme-switching')
  }, 420)
}

async function applyThemeWithViewTransition(next: boolean, event: MouseEvent) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> }
  }

  if (!doc.startViewTransition) {
    applyThemeWithCssFallback(next)
    return
  }

  const x = event.clientX
  const y = event.clientY
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  )

  const transition = doc.startViewTransition(() => applyTheme(next))

  try {
    await transition.ready
    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${radius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 450,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)',
      }
    )
  } catch {
    applyTheme(next)
  }
}

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'dark' || saved === 'light') {
    applyTheme(saved === 'dark')
    return
  }
  applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches)
}

export function useTheme() {
  const toggleTheme = (event?: MouseEvent) => {
    const next = !isDark.value

    if (prefersReducedMotion()) {
      applyTheme(next)
      return
    }

    if (event) {
      void applyThemeWithViewTransition(next, event)
      return
    }

    applyThemeWithCssFallback(next)
  }

  return {
    isDark: computed(() => isDark.value),
    toggleTheme,
    setTheme: applyTheme,
  }
}
