<template>
  <UModal
    v-model:open="showDialog"
    :dismissible="false"
    :close="false"
    title="Новый путешественник"
    :description="description"
    :ui="{ content: 'sm:max-w-lg', footer: 'justify-center' }"
  >
    <template #body>
      <div v-if="book.character.table" class="flex items-center justify-center gap-4 py-2" aria-live="polite">
        <UIcon
          v-for="n in 2"
          :key="n"
          :name="`i-lucide-dice-${(lastRoll?.kind === 'table' && lastRoll.dice[n - 1]) || (n === 1 ? 5 : 2)}`"
          class="die size-16"
          :class="{ 'is-rolling': rolling, 'opacity-30': !lastRoll && !rolling }"
          aria-hidden="true"
        />
        <p v-if="lastRoll?.kind === 'table' && !rolling" class="pencil text-2xl ml-2">
          {{ lastRoll.dice[0] }} + {{ lastRoll.dice[1] }} = {{ lastRoll.sum }}
        </p>
      </div>
      <!-- Formula creation: one throw per stat, each written out like on paper -->
      <div v-else class="flex flex-col items-center gap-1 py-2" aria-live="polite">
        <UIcon name="i-lucide-dices" class="die size-14" :class="{ 'is-rolling': rolling, 'opacity-30': !lastRoll && !rolling }" aria-hidden="true" />
        <template v-if="lastRoll?.kind === 'formula' && !rolling">
          <p v-for="r in lastRoll.rolls" :key="r.stat" class="pencil text-xl">
            {{ statName(r.stat) }}: {{ r.dice.join(' + ') }}{{ r.modifier ? ` ${r.modifier > 0 ? '+' : '−'} ${Math.abs(r.modifier)}` : '' }} = {{ r.total }}
          </p>
        </template>
      </div>

      <!-- The top row of the Листок, filled in -->
      <div v-if="currentStats && !rolling" class="mt-4 grid border-y-[1.5px] border-ink" :style="{ gridTemplateColumns: `repeat(${statsDisplay.length}, minmax(0, 1fr))` }">
        <div
          v-for="(stat, i) in statsDisplay"
          :key="stat.label"
          class="flex flex-col items-center gap-1.5 py-3"
          :class="{ 'border-l-[1.5px] border-ink': i > 0 }"
        >
          <span class="cell-label">{{ stat.label }}</span>
          <span class="ring-mark">{{ stat.value }}</span>
        </div>
      </div>

      <p class="mt-4 text-muted">
        {{ book.character.kit }}
      </p>
    </template>

    <template #footer>
      <UButton
        v-if="currentStats"
        color="neutral"
        variant="ghost"
        icon="i-lucide-rotate-ccw"
        label="Бросить еще раз"
        :disabled="rolling"
        @click="rollDice"
      />
      <UButton
        v-if="currentStats"
        size="lg"
        label="Начать путешествие"
        :disabled="rolling"
        @click="startJourney"
      />
      <UButton
        v-else
        size="lg"
        icon="i-lucide-dices"
        label="Бросить кубики"
        :loading="rolling"
        @click="rollDice"
      />
    </template>
  </UModal>

  <!-- УДАЧА: squares crossed out by the dice, or a score rolled like the other stats -->
  <UModal
    v-model:open="showLuckDialog"
    :dismissible="false"
    :close="false"
    :title="luckSquares ? 'Квадраты УДАЧИ' : 'УДАЧА'"
    :description="luckSquares
      ? 'Кубик брошен дважды, выпавшие числа зачеркнуты. Когда книга попросит проверить УДАЧУ, свободное число на кубике принесет успех.'
      : 'Когда книга попросит проверить УДАЧУ, на двух кубиках должно выпасть не больше ее. Каждая проверка отнимает 1 УДАЧИ.'"
    :ui="{ content: 'sm:max-w-md', footer: 'justify-center' }"
  >
    <template #body>
      <div v-if="luckStart && luckSquares" class="flex flex-col items-center gap-3">
        <div class="flex gap-1.5">
          <span
            v-for="n in luckSquares"
            :key="n"
            class="luck-square"
            :class="{ crossed: luckStart.crossed?.includes(n) }"
          >{{ n }}</span>
        </div>
        <p class="pencil text-xl">
          Выпало {{ luckStart.dice.join(' и ') }}<template v-if="luckStart.crossed?.length === 1 && luckStart.dice.length > 1">: одно и то же число, зачеркнут один квадрат</template>
        </p>
      </div>
      <div v-else-if="luckStart" class="flex flex-col items-center gap-2">
        <span class="ring-mark">{{ luckStart.score }}</span>
        <p class="pencil text-xl">
          Выпало {{ luckStart.dice.join(' + ') }}{{ luckModifier ? ` ${luckModifier > 0 ? '+' : '−'} ${Math.abs(luckModifier)}` : '' }} = {{ luckStart.score }}
        </p>
      </div>
    </template>

    <template #footer>
      <UButton size="lg" label="В путь" @click="finishCharacterCreation" />
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { getBook } from '#shared/engine/library'
import type { StatsRoll } from '~/composables/useCharacter'
import { parseFormula } from '#shared/engine/dice'
import type { LuckStart } from '#shared/engine/luck'

interface Props {
  modelValue: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'character-created'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { rollStats, startJourney: startCharacterJourney } = useCharacter()

const showDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const showLuckDialog = ref(false)
const rolling = ref(false)
const lastRoll = ref<StatsRoll | null>(null)
const currentStats = ref<Record<string, number> | null>(null)
const luckStart = ref<LuckStart | null>(null)

const book = getBook()
const luckDefinition = book.luckSystem.definition
/** How many squares the luck row has (0 when УДАЧА is a score) */
const luckSquares = luckDefinition.system === 'squares' ? luckDefinition.squares ?? 6 : 0
const luckModifier = luckDefinition.system === 'score' ? parseFormula(luckDefinition.start).modifier : 0

// The stats creation rolls: the core two, then the book's rolled attributes
const rolledStats = book.rolledStats
const statName = (id: string) => book.statLabel(id).name.toLocaleUpperCase('ru')
const rolledNames = rolledStats.map(statName)
  .reduce((text, name, i, all) => (i === 0 ? name : `${text}${i === all.length - 1 ? ' и ' : ', '}${name}`), '')
const formulas = book.character.roll as Record<string, string> | undefined
const description = formulas
  ? `Бросьте кубики за каждую характеристику: ${rolledStats.map(id => `${statName(id)} ${formulas[id]?.replace('d', 'к')}`).join(', ')}. Бросать можно, пока результат не понравится.`
  : `Бросьте два кубика: по сумме из таблицы правил берутся ${rolledNames}. Бросать можно, пока результат не понравится.`

const statsDisplay = computed(() => (currentStats.value
  ? rolledStats.map(id => ({ label: statName(id), value: currentStats.value![id] ?? 0 }))
  : []))

const rollDice = async () => {
  rolling.value = true
  // A short tumble, long enough to read as a throw
  await new Promise(resolve => setTimeout(resolve, 450))

  const result = rollStats()
  lastRoll.value = result
  currentStats.value = result.stats
  rolling.value = false
}

const startJourney = () => {
  if (!currentStats.value) return
  luckStart.value = startCharacterJourney()
  showDialog.value = false
  showLuckDialog.value = true
}

const finishCharacterCreation = () => {
  showLuckDialog.value = false
  emit('character-created')
}
</script>

<style scoped>
@reference "../assets/css/main.css";

.die {
  color: var(--color-ink);
  transition: opacity 150ms ease;
}

.die.is-rolling {
  animation: tumble 450ms var(--ease-out);
}

@keyframes tumble {
  0% { transform: rotate(0deg) scale(0.96); }
  60% { transform: rotate(200deg) scale(1.02); }
  100% { transform: rotate(360deg) scale(1); }
}
</style>
