<template>
  <!-- A card dealt onto the page when something is gained or lost (see .outcome-card in main.css) -->
  <div class="outcome-card" :class="[`is-${card.tone}`, { 'is-fresh': fresh }]" role="status">
    <div class="outcome-medallion" aria-hidden="true">
      <InkDie v-if="card.die" :value="card.die" class="outcome-die" />
      <UIcon v-else :name="card.icon ?? 'i-lucide-sparkles'" class="outcome-emblem" />
    </div>

    <div v-if="card.dice?.length" class="outcome-dice" aria-hidden="true">
      <InkDie v-for="(value, i) in card.dice" :key="i" :value="value" />
    </div>

    <div v-if="card.luckRow" class="luck-row" aria-hidden="true">
      <span
        v-for="(available, i) in card.luckRow.luck"
        :key="i"
        class="luck-square"
        :class="{ 'crossed': !available, 'is-rolled': card.luckRow.mark === i + 1 }"
      >
        {{ i + 1 }}
        <svg v-if="card.luckRow.mark === i + 1" viewBox="0 0 40 40" class="pencil-mark pencil-mark--circle" :class="`is-${card.tone}`">
          <path d="M20 2 C 34 2, 39 12, 38 21 C 37 32, 27 38, 18 37 C 8 36, 2 28, 3 18 C 4 9, 12 3, 24 4" pathLength="1" />
        </svg>
      </span>
    </div>

    <p class="outcome-title">{{ card.title }}</p>
    <p v-for="(line, i) in card.lines" :key="i" class="outcome-line">{{ line }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
import type { OutcomeCardModel } from '~/utils/outcomes'

defineProps<{
  card: OutcomeCardModel
  fresh?: boolean
}>()
</script>
