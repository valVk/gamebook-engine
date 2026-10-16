<template>
  <UDrawer v-model:open="open" :ui="{ content: 'max-h-[88dvh]', body: 'overflow-y-auto overscroll-contain' }">
    <!-- Slim bar on small screens: the four values a reader checks most; the whole sheet opens in a drawer -->
    <button type="button" class="status-bar" :aria-label="`Открыть листок путешественника. ${summary}`">
      <span class="stat"><span class="stat-label">{{ label.strength.short ?? label.strength.name }}</span><span class="pencil text-xl">{{ character.strength }}<span class="text-sm">/{{ character.maxStrength }}</span></span></span>
      <span class="stat">
        <span class="stat-label">{{ label.agility.short ?? label.agility.name }}</span><span class="pencil text-xl">{{ character.agility }}</span>
        <span v-if="fightModifier" class="pencil-tag text-sm">{{ fightModifier > 0 ? '+' : '−' }}{{ Math.abs(fightModifier) }}</span>
      </span>
      <span class="stat"><UIcon name="i-lucide-coins" class="size-4 text-ink" aria-hidden="true" /><span class="pencil text-xl">{{ character.gold }}</span></span>
      <span class="stat"><UIcon name="i-lucide-wheat" class="size-4 text-ink" aria-hidden="true" /><span class="pencil text-xl">{{ character.food }}</span></span>
      <UIcon name="i-lucide-chevron-up" class="size-5 ml-auto text-ink" aria-hidden="true" />
    </button>

    <template #body>
      <TravellerSheet
        class="pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
        @use-food="emit('use-food')"
        @exit-game="open = false; emit('exit-game')"
      />
    </template>
  </UDrawer>
</template>

<script setup lang="ts">
import { getBook } from '#shared/engine/library'

const emit = defineEmits<{
  'use-food': []
  'exit-game': []
}>()

const open = ref(false)
const book = getBook()
const label = { strength: book.statLabel('strength'), agility: book.statLabel('agility') }
const { character: characterRef } = useCharacter()
const character = computed(() => characterRef.value)

const sectionEffects = useSectionEffects(() => character.value.currentPage)
const fightModifier = sectionEffects.fightModifier

const summary = computed(() =>
  `${label.strength.name} ${character.value.strength} из ${character.value.maxStrength}, ${label.agility.name} ${character.value.agility}`
  + (fightModifier.value ? `, в этом бою ${character.value.agility + fightModifier.value}` : '')
  + `, золото ${character.value.gold}, еда ${character.value.food}`)
</script>

<style scoped>
@reference "../assets/css/main.css";

.status-bar {
  @apply fixed inset-x-0 bottom-0 z-40 flex items-center gap-5 px-5 pt-2.5 bg-elevated text-left cursor-pointer;
  padding-bottom: max(0.625rem, env(safe-area-inset-bottom, 0px));
  border-top: 1.5px solid var(--color-ink);
}

.stat {
  @apply flex items-baseline gap-1.5;
}

.stat-label {
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.status-bar:focus-visible {
  @apply outline-2 -outline-offset-4 outline-primary;
}
</style>
