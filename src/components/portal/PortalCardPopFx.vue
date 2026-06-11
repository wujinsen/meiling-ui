<script setup lang="ts">
import { Moon, Star, Sun } from 'lucide-vue-next'
import { onUnmounted, ref } from 'vue'

type PopKind = 'sun' | 'star' | 'moon'

type PopParticle = {
  id: number
  kind: PopKind
  x: number
  y: number
  dx: number
  dy: number
  scale: number
  rotate: number
  color: string
  glow: string
  size: number
}

const KINDS: PopKind[] = ['sun', 'star', 'moon']

const KIND_STYLE: Record<PopKind, { color: string; glow: string; size: number }> = {
  sun: { color: 'hsl(42 96% 58%)', glow: 'hsl(42 95% 55% / 0.85)', size: 18 },
  star: { color: 'hsl(38 92% 62%)', glow: 'hsl(38 90% 60% / 0.8)', size: 15 },
  moon: { color: 'hsl(228 78% 74%)', glow: 'hsl(228 75% 72% / 0.75)', size: 16 },
}

const iconMap = { sun: Sun, star: Star, moon: Moon }

const particles = ref<PopParticle[]>([])
let nextId = 1
const timers = new Set<ReturnType<typeof setTimeout>>()

function pickKind(): PopKind {
  return KINDS[Math.floor(Math.random() * KINDS.length)]
}

function spawnFromElement(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const count = 6 + Math.floor(Math.random() * 3)
  const batch: PopParticle[] = []

  for (let i = 0; i < count; i++) {
    const kind = pickKind()
    const style = KIND_STYLE[kind]
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.85
    const dist = 28 + Math.random() * 34
    batch.push({
      id: nextId++,
      kind,
      x: cx + (Math.random() - 0.5) * rect.width * 0.35,
      y: cy + (Math.random() - 0.5) * rect.height * 0.25,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 10,
      scale: 0.65 + Math.random() * 0.55,
      rotate: Math.random() * 160 - 80,
      color: style.color,
      glow: style.glow,
      size: style.size + Math.floor(Math.random() * 4),
    })
  }

  particles.value = [...particles.value, ...batch]
  const timer = setTimeout(() => {
    const remove = new Set(batch.map((p) => p.id))
    particles.value = particles.value.filter((p) => !remove.has(p.id))
    timers.delete(timer)
  }, 820)
  timers.add(timer)
}

/** @deprecated 兼容旧调用 */
function spawnAt(clientX: number, clientY: number) {
  const fake = document.createElement('div')
  fake.getBoundingClientRect = () =>
    ({
      left: clientX - 40,
      top: clientY - 24,
      width: 80,
      height: 48,
      right: clientX + 40,
      bottom: clientY + 24,
    }) as DOMRect
  spawnFromElement(fake)
}

defineExpose({ spawnFromElement, spawnAt })

onUnmounted(() => {
  for (const timer of timers) clearTimeout(timer)
  timers.clear()
})
</script>

<template>
  <Teleport to="body">
    <div class="portal-card-pop-fx" aria-hidden="true">
      <span
        v-for="p in particles"
        :key="p.id"
        class="portal-card-pop-particle"
        :class="`portal-card-pop-particle-${p.kind}`"
        :style="{
          left: `${p.x}px`,
          top: `${p.y}px`,
          width: `${p.size}px`,
          height: `${p.size}px`,
          marginLeft: `${-p.size / 2}px`,
          marginTop: `${-p.size / 2}px`,
          '--dx': `${p.dx}px`,
          '--dy': `${p.dy}px`,
          '--scale': p.scale,
          '--rotate': `${p.rotate}deg`,
          color: p.color,
          filter: `drop-shadow(0 0 5px ${p.glow})`,
        }"
      >
        <component :is="iconMap[p.kind]" class="h-full w-full" :class="p.kind === 'star' ? 'fill-current' : ''" />
      </span>
    </div>
  </Teleport>
</template>

<style scoped>
.portal-card-pop-fx {
  @apply pointer-events-none fixed inset-0 z-[120] overflow-hidden;
}

.portal-card-pop-particle {
  @apply absolute;
  animation: portal-card-pop-burst 0.78s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.portal-card-pop-particle-sun {
  animation-duration: 0.82s;
}

.portal-card-pop-particle-moon {
  animation-duration: 0.86s;
}

@keyframes portal-card-pop-burst {
  0% {
    opacity: 0;
    transform: translate(0, 8px) scale(0.15) rotate(0deg);
  }
  12% {
    opacity: 1;
    transform: translate(calc(var(--dx) * 0.12), calc(var(--dy) * 0.08)) scale(calc(var(--scale) * 1.15))
      rotate(calc(var(--rotate) * 0.15));
  }
  55% {
    opacity: 1;
    transform: translate(calc(var(--dx) * 0.72), calc(var(--dy) * 0.72)) scale(var(--scale))
      rotate(calc(var(--rotate) * 0.65));
  }
  100% {
    opacity: 0;
    transform: translate(var(--dx), var(--dy)) scale(calc(var(--scale) * 0.25)) rotate(var(--rotate));
  }
}
</style>
