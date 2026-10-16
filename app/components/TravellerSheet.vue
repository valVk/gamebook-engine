<template>
  <section class="sheet" aria-labelledby="sheet-title">
    <h2 id="sheet-title" class="sheet-title">Листок путешественника</h2>

    <div class="grid border-y-[1.5px] border-ink" :style="columns(circled.length)">
      <div v-for="(stat, i) in circled" :key="stat.label" class="cell items-center text-center" :class="{ 'border-l-[1.5px] border-ink': i > 0, 'px-1.5': stat.label.length > 9 }">
        <!-- Long names (МАСТЕРСТВО, ВЫНОСЛИВОСТЬ) are set tighter so three fit in a row -->
        <span class="cell-label" :class="{ 'cell-label--long': stat.label.length > 9 }">{{ stat.label }}</span>
        <span class="ring-mark" :aria-label="`${stat.label}: ${stat.value}${stat.max ? ` из ${stat.max}` : ''}${stat.id === 'agility' && fightModifier ? `, в этом бою ${character.agility + fightModifier}` : ''}`">
          <span :key="flashKey(stat.id, stat.value)" :class="{ 'value-changed': changed.has(stat.id) }">{{ stat.value }}</span>
        </span>
        <span v-if="stat.max" class="pencil text-sm leading-none">из {{ stat.max }}</span>
        <!-- In-fight penalty (145: rider in armour, 372: attack from the air...): only for this fight -->
        <span
          v-if="stat.id === 'agility' && fightModifier"
          class="pencil-tag mt-1"
          :title="`В этом бою ${label('agility')} ${character.agility + fightModifier}`"
        >{{ formatModifier(fightModifier) }} в бою</span>
      </div>
    </div>

    <div class="grid border-b-[1.5px] border-ink" :style="columns(cells.length + 2)">
      <div v-for="(stat, i) in cells" :key="stat.id" class="cell" :class="{ 'border-l-[1.5px] border-ink': i > 0 }">
        <span class="cell-label">{{ stat.label }}</span>
        <span class="pencil text-2xl leading-tight">
          <span :key="flashKey(stat.id, stat.value)" :class="{ 'value-changed': changed.has(stat.id) }">{{ stat.shown }}</span>
        </span>
      </div>
      <div class="cell" :class="{ 'border-l-[1.5px] border-ink': cells.length }">
        <span class="cell-label">ДЕНЬГИ</span>
        <span class="pencil text-2xl leading-tight">
          <span :key="flashKey('gold', character.gold)" :class="{ 'value-changed': changed.has('gold') }">{{ character.gold }}</span><span class="text-base ml-1">зол.</span>
        </span>
      </div>
      <div class="cell border-l-[1.5px] border-ink">
        <span class="cell-label">ЕДА</span>
        <span class="pencil text-2xl leading-tight">
          <span :key="flashKey('food', character.food)" :class="{ 'value-changed': changed.has('food') }">{{ character.food }}</span><span class="text-base ml-1">{{ portions(character.food) }}</span>
        </span>
        <UButton
          v-if="character.food > 0 && !inCombat && character.strength < character.maxStrength"
          color="neutral"
          variant="outline"
          size="xs"
          class="self-start -ml-2"
          label="Поесть"
          :title="`Порция ЕДЫ восстанавливает ${book.character.foodRestores} ${book.statLabel('strength').of}`"
          @click="emit('use-food')"
        />
        <span v-else-if="character.food > 0 && inCombat" class="pencil text-sm leading-tight opacity-70">в бою не едят</span>
      </div>
    </div>

    <div v-if="luckSquares" class="cell border-b-[1.5px] border-ink">
      <span class="cell-label">УДАЧА</span>
      <div class="flex gap-1.5 mt-0.5" role="list" aria-label="Квадраты УДАЧИ">
        <span
          v-for="(available, index) in character.luck"
          :key="index"
          role="listitem"
          class="luck-square"
          :class="{ crossed: !available }"
          :aria-label="`${index + 1}: ${available ? 'свободен' : 'зачеркнут'}`"
        >{{ index + 1 }}</span>
      </div>
    </div>

    <div class="grid grid-cols-2 border-b-[1.5px] border-ink min-h-28">
      <div class="cell">
        <span class="cell-label">В ЗАПЛЕЧНОМ МЕШКЕ</span>
        <ul v-if="character.inventory.length" class="pencil text-base leading-snug">
          <li v-for="(item, index) in character.inventory" :key="`${item}-${index}`" class="group flex items-start justify-between gap-1">
            <span>{{ item }}</span>
            <!-- The book sometimes asks to give up an item (004, 005) -->
            <button
              v-if="!isKept(item)"
              type="button"
              class="drop-item"
              :aria-label="`Выбросить: ${item}`"
              @click="removeItem(item)"
            >
              <UIcon name="i-lucide-x" class="size-3.5" />
            </button>
          </li>
        </ul>
        <span v-else class="pencil text-base opacity-60">{{ book.character.emptyBag ?? 'пусто' }}</span>
      </div>
      <div class="cell border-l-[1.5px] border-ink">
        <span class="cell-label">ИНФОРМАЦИЯ</span>
        <ul class="pencil text-base leading-snug">
          <li v-for="code in codes" :key="code">{{ book.spellName(code) }}<template v-if="book.spell(code).add">: {{ book.spell(code).add! > 0 ? `+${book.spell(code).add}` : `−${-book.spell(code).add!}` }} к параграфу</template></li>
          <li v-if="character.nextLuckCheckFails">Боги гневаются: следующая проверка УДАЧИ провалится</li>
          <li v-if="!codes.length && !character.nextLuckCheckFails" class="opacity-60">ничего не записано</li>
        </ul>
      </div>
    </div>

    <!-- Destructive but not the main action: red lettering, a single quiet line on hover -->
    <div class="mt-4 flex justify-center">
      <UButton color="error" variant="ghost" size="sm" label="Закончить путешествие" @click="emit('exit-game')" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { getBook } from '#shared/engine/library'

const emit = defineEmits<{
  'use-food': []
  'exit-game': []
}>()

const { character: characterRef, removeItem, codesAtHand } = useCharacter()

// The rusty blade (594) leaves only when a real sword is found
const book = getBook()
const isKept = (item: string) => book.item(book.itemId(item) ?? '')?.kept === true
const character = computed(() => characterRef.value)

const luckSquares = book.luckSystem.kind === 'squares'
const label = (id: string) => (book.statLabel(id).sheet ?? book.statLabel(id).name).toLocaleUpperCase('ru')

/** Spells, allies and item powers at hand, with the number each adds to a section */
const codes = computed(() => codesAtHand())

const columns = (count: number) => ({ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` })

/** A clock attribute reads 3:40 */
const display = (id: string, value: number) => (book.character.attributes[id]?.format === 'clock'
  ? `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
  : value)

/** The book's attributes placed on the sheet: circled in the top row, or plain cells */
const attributes = (place: 'circle' | 'cell') => book.attributeIds
  .filter(id => book.character.attributes[id]?.sheet === place)
  // A clock that starts mid-book appears once its section is reached
  .filter((id) => {
    const { visibleAfter: after, visibleUntil: until } = book.character.attributes[id] ?? {}
    const visited = character.value.visitedPages
    return (!after || visited.includes(after)) && (!until || !visited.includes(until))
  })
  .map(id => ({ id, label: label(id), value: character.value.attributes[id] ?? 0, shown: display(id, character.value.attributes[id] ?? 0), max: null }))

const circled = computed(() => [
  { id: 'agility', label: label('agility'), value: character.value.agility, max: character.value.agility < character.value.maxAgility ? character.value.maxAgility : null },
  { id: 'strength', label: label('strength'), value: character.value.strength, max: character.value.maxStrength },
  // A score УДАЧА is written beside them, like the other stats; squares get their own row
  ...(luckSquares
    ? []
    : [{ id: 'luck', label: label('luck'), value: character.value.luckScore, max: character.value.luckScore < character.value.maxLuckScore ? character.value.maxLuckScore : null }]),
  ...attributes('circle')
])

const cells = computed(() => attributes('cell'))

const portions = (n: number) => {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'порция'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'порции'
  return 'порций'
}

// "Можно есть ... в любой момент ... Но только не во время боя!" (preface)
const sectionEffects = useSectionEffects(() => character.value.currentPage)
// A sword fight on this section that changes ЛОВКОСТЬ while it lasts
const fightModifier = sectionEffects.fightModifier

const formatModifier = (value: number) => (value > 0 ? `+${value}` : `−${Math.abs(value)}`)

const inCombat = computed(() => sectionEffects.entries.value.some(entry =>
  (entry.effect.kind === 'combat' || entry.effect.kind === 'attrition') && !!entry.outcome && !entry.resolved))

// Values that just changed flash once, so the reader sees what the last action did
const changed = reactive(new Set<string>())
const flashKey = (name: string, value: number) => `${name}-${value}`
watch(
  () => ({ agility: character.value.agility, strength: character.value.strength, luck: character.value.luckScore, gold: character.value.gold, food: character.value.food, ...character.value.attributes }) as Record<string, number>,
  (next, previous) => {
    changed.clear()
    for (const key of Object.keys(next)) {
      if (previous && next[key] !== previous[key]) changed.add(key)
    }
  }
)
</script>

<style scoped>
@reference "../assets/css/main.css";

.sheet {
  @apply text-ink;
}

.sheet-title {
  font-family: var(--font-ornament);
  font-size: 1rem;
  font-weight: 400;
  letter-spacing: 0.01em;
  line-height: 1.3;
  text-align: center;
  margin-bottom: 0.75rem;
}

.cell {
  @apply flex flex-col gap-1 px-3 py-2.5 min-w-0;
}

.cell-label--long {
  font-size: 0.6875rem;
  letter-spacing: 0;
  hyphens: manual;
}


.drop-item:focus-visible {
  @apply outline-2 outline-offset-2 outline-primary rounded-xs;
}

@media (hover: hover) and (pointer: fine) {
  .drop-item {
    opacity: 0;
  }

  .group:hover .drop-item,
  .drop-item:focus-visible {
    opacity: 1;
  }
}

.drop-item {
  @apply mt-1 shrink-0 text-graphite cursor-pointer;
  transition: opacity 150ms ease;
}
</style>
