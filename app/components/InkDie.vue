<template>
  <svg viewBox="0 0 100 100" class="ink-die" role="img" :aria-label="`Кубик: ${value}`">
    <path :d="DIE_FACE_PATH" class="ink-die-face" />
    <circle v-for="([cx, cy], i) in DIE_PIPS[value] ?? []" :key="i" :cx="cx" :cy="cy" r="7.5" class="ink-die-pip" />
  </svg>
</template>

<script setup lang="ts">
import { DIE_FACE_PATH, DIE_PIPS } from '~/utils/die'

defineProps<{
  value: number
}>()
</script>
