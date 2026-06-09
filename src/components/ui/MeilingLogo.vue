<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 32 })
</script>

<template>
  <!-- 梅聆：梅瓣 + 聆波，纯图形 -->
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <radialGradient
        id="ml-petal"
        cx="0"
        cy="0"
        r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="translate(16 14.5) scale(7)"
      >
        <stop stop-color="#FFFDF9" stop-opacity="0.98" />
        <stop offset="0.65" stop-color="#FCE8E4" stop-opacity="0.88" />
        <stop offset="1" stop-color="#E8C4BE" stop-opacity="0.55" />
      </radialGradient>
      <radialGradient
        id="ml-heart"
        cx="0"
        cy="0"
        r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="translate(16 14.5) scale(2.6)"
      >
        <stop stop-color="#FFF9E8" />
        <stop offset="0.55" stop-color="#F5D78E" />
        <stop offset="1" stop-color="#D4A574" stop-opacity="0.75" />
      </radialGradient>
    </defs>

    <!-- 梅：五瓣，俯视角梅花 -->
    <g transform="translate(16 14.5)">
      <path
        d="M0 -6.2C-2.8 -2.2 -2.6 2.4 0 4.6C2.6 2.4 2.8 -2.2 0 -6.2Z"
        fill="url(#ml-petal)"
      />
      <path
        d="M0 -6.2C-2.8 -2.2 -2.6 2.4 0 4.6C2.6 2.4 2.8 -2.2 0 -6.2Z"
        fill="url(#ml-petal)"
        transform="rotate(72)"
      />
      <path
        d="M0 -6.2C-2.8 -2.2 -2.6 2.4 0 4.6C2.6 2.4 2.8 -2.2 0 -6.2Z"
        fill="url(#ml-petal)"
        transform="rotate(144)"
      />
      <path
        d="M0 -6.2C-2.8 -2.2 -2.6 2.4 0 4.6C2.6 2.4 2.8 -2.2 0 -6.2Z"
        fill="url(#ml-petal)"
        transform="rotate(216)"
      />
      <path
        d="M0 -6.2C-2.8 -2.2 -2.6 2.4 0 4.6C2.6 2.4 2.8 -2.2 0 -6.2Z"
        fill="url(#ml-petal)"
        transform="rotate(288)"
      />
    </g>

    <!-- 蕊：温柔的心 -->
    <circle cx="16" cy="14.5" r="2.1" fill="url(#ml-heart)" />
    <circle cx="16" cy="14.5" r="0.75" fill="#FFFDF9" opacity="0.95" />

    <!-- 聆：倾听的涟漪 -->
    <path
      d="M9.5 22.8Q16 20.6 22.5 22.8"
      stroke="#FFFDF9"
      stroke-width="1.1"
      stroke-linecap="round"
      opacity="0.55"
    />
    <path
      d="M7.5 25.2Q16 22.2 24.5 25.2"
      stroke="#FFFDF9"
      stroke-width="0.9"
      stroke-linecap="round"
      opacity="0.35"
    />
    <path
      d="M5.8 27.2Q16 24 26.2 27.2"
      stroke="#FFFDF9"
      stroke-width="0.7"
      stroke-linecap="round"
      opacity="0.22"
    />

    <!-- 枝：一点梅意 -->
    <path
      d="M11.5 26.8C10.2 25.8 9.2 24.2 8.8 22.6"
      stroke="#FFFDF9"
      stroke-width="1.2"
      stroke-linecap="round"
      opacity="0.42"
    />
  </svg>
</template>
