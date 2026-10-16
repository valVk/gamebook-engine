<template>
  <section v-if="entries.length || deadline" class="turn" aria-label="Что происходит с героем">
    <!-- A deadline passed («время истекло»): the only way on is the book's section for it -->
    <template v-if="deadline">
      <OutcomeCard :card="deadlineCard(deadline)" />
      <div class="step">
        <div class="actions">
          <UButton size="lg" icon="i-lucide-hourglass" :label="`Параграф ${Number(deadline.section)}`" @click="emit('navigate', deadline.section)" />
        </div>
      </div>
    </template>
    <!-- What was gained or lost is dealt as cards; the rest is a pencil note on the Листок -->
    <OutcomeCard v-for="card in cards" :key="card.model.key" :card="card.model" :fresh="card.fresh" />
    <ul v-if="ledger.length" class="ledger pencil text-xl leading-snug" aria-label="Записи">
      <li v-for="note in ledger" :key="note.index">{{ note.text }}</li>
    </ul>

    <div v-for="entry in deadline ? [] : pending.filter(item => !effects.waiting(item.index))" :key="entry.index" class="step">
      <!-- A fight: one ruled table, one button -->
      <div v-if="entry.effect.kind === 'combat'" class="encounter">
        <div class="flex items-baseline justify-between gap-3">
          <h3 class="encounter-title">
            {{ entry.effect.mode === 'npc' ? 'Схватка охранников' : entry.effect.type === 'mind' ? 'Телепатический поединок' : entry.effect.champion && !entry.outcome?.takenOver ? `Бьется ${enemyName(entry.effect.champion.name).toLocaleLowerCase('ru')}` : 'Бой' }}
          </h3>
          <span v-if="entry.outcome" class="pencil text-2xl">раунд {{ entry.outcome.rounds }}</span>
        </div>
        <p v-if="combatRules(entry.effect).length" class="mt-2 text-[1.0625rem] text-toned">
          {{ combatRules(entry.effect).join(' ') }}
        </p>

        <table class="mt-3 w-full">
          <thead>
            <tr>
              <th scope="col" class="sr-only">Участник</th>
              <th scope="col">Удар</th>
              <th scope="col">{{ strength.name }}</th>
            </tr>
          </thead>
          <tbody>
            <!-- An ally fights for the reader, who rolls for it -->
            <tr v-if="entry.effect.mode !== 'npc' && entry.effect.champion" :class="{ 'is-down': (effects.fightState(entry.index).champion ?? 0) <= 0 }">
              <th scope="row">
                {{ enemyName(entry.effect.champion.name) }}
                <span class="block text-muted font-normal text-[0.9rem]">ваш союзник, {{ agilityName }} {{ entry.effect.champion.skill }}</span>
              </th>
              <td class="pencil">{{ entry.outcome?.takenOver ? '—' : attackOf(entry, 0) }}</td>
              <td class="pencil">{{ effects.fightState(entry.index).champion }}<span class="text-base">/{{ entry.effect.champion.strength }}</span></td>
            </tr>
            <tr v-if="entry.effect.mode !== 'npc' && (!entry.effect.champion || entry.outcome?.takenOver || entry.outcome?.helped)">
              <th scope="row">
                Вы
                <span class="block text-muted font-normal text-[0.9rem]">{{ entry.effect.champion && !entry.outcome?.takenOver ? 'помогаете союзнику' : skillLabel(entry.effect) }}</span>
              </th>
              <td class="pencil">{{ entry.effect.champion && !entry.outcome?.takenOver ? '—' : attackOf(entry, 0) }}</td>
              <td class="pencil">{{ character.strength }}<span class="text-base">/{{ character.maxStrength }}</span></td>
            </tr>
            <tr v-for="(helper, h) in entry.effect.mode === 'npc' ? [] : entry.effect.helpers ?? []" :key="helper.name">
              <th scope="row">{{ enemyName(helper.name) }} <span class="block text-muted font-normal text-[0.9rem]">помогает вам, {{ agilityName }} {{ helper.skill }}</span></th>
              <td class="pencil">—</td>
              <td class="pencil">{{ effects.fightState(entry.index).helpers[h] }}</td>
            </tr>
            <tr
              v-for="(enemy, i) in entry.effect.enemies"
              :key="i"
              :class="{ 'is-down': enemyDown(entry, i) }"
            >
              <th scope="row">
                <button
                  v-if="entry.effect.mode === 'simultaneous' && !enemyDown(entry, i)"
                  type="button"
                  class="target-pick"
                  :aria-pressed="target === i"
                  @click="target = i"
                >
                  <span class="target-dot" aria-hidden="true" />
                  {{ enemyName(enemy.name) }}
                </button>
                <template v-else>{{ enemyName(enemy.name) }}</template>
                <span class="block text-muted font-normal text-[0.9rem]">{{ entry.effect.type === 'mind' ? mindName : agilityName }} {{ enemy.skill }}</span>
              </th>
              <td class="pencil">{{ attackOf(entry, entry.effect.mode === 'npc' ? i : i + 1) }}</td>
              <td class="pencil">{{ enemyStrength(entry, i) }}<span class="text-base">/{{ enemy.strength }}</span></td>
            </tr>
          </tbody>
        </table>

        <p v-if="entry.outcome" class="pencil text-2xl leading-snug mt-4" aria-live="polite">{{ roundSummary(entry) }}</p>
        <p v-if="entry.effect.mode === 'simultaneous'" class="mt-2 text-[1.0625rem] text-toned">
          Бьют оба, а ранить вы можете только того, кого выбрали.
        </p>

        <div class="actions">
          <UButton
            size="xl"
            icon="i-lucide-swords"
            :label="entry.outcome ? 'Следующий раунд' : entry.effect.mode === 'npc' ? 'Бросить кубики за обоих' : 'Начать бой'"
            @click="effects.combatRound(entry.index, target)"
          />
          <UButton
            v-if="effects.canHelp(entry.index)"
            color="neutral"
            variant="outline"
            icon="i-lucide-handshake"
            label="Помочь союзнику"
            @click="effects.help(entry.index)"
          />
          <!-- A one-use weapon (the harpoon): thrown instead of a round -->
          <UButton
            v-for="item in entry.effect.mode === 'npc' ? [] : effects.strikes.value"
            :key="item"
            color="neutral"
            variant="outline"
            icon="i-lucide-crosshair"
            :label="`Метнуть: ${item.toLocaleLowerCase('ru')}`"
            @click="effects.strike(entry.index, item, target)"
          />
          <span v-if="openEscapes(entry).length" class="text-muted text-[0.95rem]">
            Можно и уйти: {{ openEscapes(entry).join(', ') }}
          </span>
        </div>
      </div>

      <!-- A swarm: rounds until enough are driven off -->
      <div v-else-if="entry.effect.kind === 'attrition'" class="encounter">
        <h3 class="encounter-title">{{ entry.effect.enemy }}</h3>
        <p class="mt-2 text-[1.0625rem] text-toned">
          Каждый раунд кубик покажет, скольких вы одолели, а {{ entry.effect.damageDice === 1 ? 'еще один кубик' : `${entry.effect.damageDice} кубика` }} — сколько {{ strength.of }} вы потеряли.
          Нужно одолеть {{ entry.effect.killTarget }}.
        </p>
        <p class="pencil text-4xl mt-4" :aria-label="`Убито ${entry.outcome?.value ?? 0} из ${entry.effect.killTarget}`">
          <span class="tally" aria-hidden="true">{{ tally(entry.outcome?.value ?? 0) }}</span>
          <span class="text-lg"> {{ entry.outcome?.value ?? 0 }} из {{ entry.effect.killTarget }}</span>
        </p>
        <p v-if="entry.outcome" class="pencil text-2xl leading-snug mt-2" aria-live="polite">
          Раунд {{ entry.outcome.rounds }}: убито {{ entry.outcome.dice?.[0] }}, укусы отняли {{ sum((entry.outcome.dice ?? []).slice(1)) }} {{ strength.of }}.
        </p>
        <div class="actions">
          <UButton size="xl" icon="i-lucide-swords" :label="entry.outcome ? 'Следующий раунд' : 'Отбиваться'" @click="effects.attritionRound(entry.index)" />
        </div>
      </div>

      <!-- The merchant: a short price list -->
      <div v-else-if="entry.effect.kind === 'purchase'" class="shop">
        <p v-if="entry.index === firstPurchase" class="instruction mb-1">Можно купить у торговца. Денег у вас {{ character.gold }} зол.</p>
        <div class="flex items-center justify-between gap-3 py-1.5 border-b border-default">
          <span>{{ book.itemName(entry.effect.item) }}</span>
          <span class="flex items-center gap-3">
            <span class="pencil text-lg">{{ entry.effect.price }} зол.</span>
            <UButton size="sm" color="neutral" variant="outline" label="Купить" :disabled="!effects.canPurchase(entry.index)" @click="effects.purchase(entry.index)" />
          </span>
        </div>
      </div>

      <!-- The belt can be given back for its price (059) -->
      <div v-else-if="entry.effect.kind === 'refund'" class="shop flex items-center justify-between gap-3 py-1.5 border-b border-default">
        <span>{{ book.itemName(entry.effect.item) }}: торговец вернет деньги</span>
        <span class="flex items-center gap-3">
          <span class="pencil text-lg">+{{ entry.effect.price }} зол.</span>
          <UButton size="sm" color="neutral" variant="outline" label="Вернуть" @click="effects.refund(entry.index)" />
        </span>
      </div>

      <!-- A puzzle answered with a section number -->
      <form v-else-if="entry.effect.kind === 'riddle'" class="riddle" @submit.prevent="answer(entry)">
        <p class="instruction">{{ entry.effect.prompt }}</p>
        <div class="actions">
          <UInput
            v-model="riddleAnswers[entry.index]"
            inputmode="numeric"
            enterkeyhint="go"
            autocomplete="off"
            placeholder="Номер параграфа"
            class="w-44"
            :ui="{ base: 'pencil text-lg text-center' }"
            aria-label="Номер параграфа"
          />
          <UButton type="submit" color="neutral" variant="outline" label="Открыть параграф" />
        </div>
        <p v-if="riddleMisses[entry.index]" class="pencil text-lg text-center mt-2" aria-live="polite">
          {{ riddleMisses[entry.index] }}: ничего не происходит.
        </p>
      </form>

      <!-- Everything else: what the book asks, and one button to do it -->
      <template v-else>
        <p class="instruction">{{ instruction(entry) }}</p>
        <div class="actions">
          <UButton
            :size="entry.required ? 'lg' : 'md'"
            :color="entry.index === primaryIndex ? 'primary' : 'neutral'"
            :variant="entry.index === primaryIndex ? 'solid' : 'outline'"
            :icon="buttonIcon(entry)"
            :label="buttonLabel(entry)"
            @click="act(entry)"
          />
          <span v-if="entry.effect.kind === 'roll' && entry.effect.escapeLinks?.length" class="text-muted text-[0.95rem]">
            Если сил не хватает: {{ entry.effect.escapeLinks.map(Number).join(', ') }}
          </span>
          <span v-if="entry.effect.kind === 'duel' && duelTie" class="pencil text-lg">Ничья, {{ duelTie }}. Бросайте снова.</span>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { sentenceCase } from '#shared/engine/book'
import { getBook } from '#shared/engine/library'
import type { CombatEnemyStats } from '#shared/engine/rules'
import type { EffectEntry } from '~/composables/useSectionEffects'
import { formatCost } from '~/composables/useSectionEffects'
import { actionCard, arrivalCard, deadlineCard, enemyName, hasCard } from '~/utils/outcomes'
import type { OutcomeCardModel } from '~/utils/outcomes'

type CombatEffect = Extract<EffectEntry['effect'], { kind: 'combat' }>

const props = defineProps<{
  page: string
}>()

const emit = defineEmits<{
  navigate: [page: string]
}>()

const effects = useSectionEffects(() => props.page)
const deadline = effects.deadline
const { character: characterRef, hasCode } = useCharacter()
const character = computed(() => characterRef.value)
const entries = computed(() => effects.entries.value)

// Unknown spells are not offered: the text itself hints at them
const visible = computed(() => entries.value.filter((entry) => {
  if (entry.resolved) return true
  if (entry.effect.kind === 'castSpell') return [entry.effect.spell, ...(entry.effect.with ?? [])].every(hasCode)
  // A solved riddle leaves the section at once; there is nothing to show for it here
  if (entry.effect.kind === 'riddle') return !entry.resolved
  // Only what was bought can be given back
  if (entry.effect.kind === 'refund') return effects.canRefund(entry.index)
  return true
}))

const pending = computed(() => visible.value.filter(entry => !entry.resolved))
const primaryIndex = computed(() => (pending.value.find(entry => entry.required) ?? pending.value[0])?.index)
const firstPurchase = computed(() => pending.value.find(entry => entry.effect.kind === 'purchase')?.index)


const signed = (value: number) => (value > 0 ? `+${value}` : `−${Math.abs(value)}`)
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
const diceText = (n: number) => (n === 1 ? 'кубик' : n < 5 ? `кубик ${n} раза` : `кубик ${n} раз`)

const book = getBook()
const statName = (stat: string) => book.statLabel(stat).name
/** The attribute a charisma test checks (ОБАЯНИЕ) and the one telepathic fights use (Сила мысли) */
const tested = book.testedAttribute ?? ''
const testedName = statName(tested).toLocaleUpperCase('ru')
const mindSkill = book.character.mindSkill
/** The core stats as this book names them (СИЛА / ВЫНОСЛИВОСТЬ, ЛОВКОСТЬ / МАСТЕРСТВО) */
const strength = book.statLabel('strength')
const agility = book.statLabel('agility')
const agilityName = sentenceCase(agility.name)
const mindName = mindSkill ? statName(mindSkill) : agilityName
/** УДАЧА is a number in this book rather than squares (shared/engine/luck.ts) */
const scoreLuck = book.luckSystem.kind === 'score'
const lower = (text: string) => text.toLocaleLowerCase('ru')
const lowerItem = (item: string) => book.itemName(item).toLocaleLowerCase('ru')

// Ledger: one pencil line per resolved effect
const describe = ({ effect, outcome }: EffectEntry): string => {
  const value = outcome?.value ?? 0
  switch (effect.kind) {
    case 'change':
      return value === 0 ? `${statName(effect.stat)} уже на пределе` : `${statName(effect.stat)} ${signed(value)}`
    case 'loseAll':
      return effect.stat === 'food' ? 'Вся ЕДА пропала' : 'Все золото пропало'
    case 'meal':
      return outcome?.success ? 'Съедена порция ЕДЫ' : `Еды нет: ${strength.name} ${signed(value)}`
    case 'luckPenalty':
      return 'Следующая проверка УДАЧИ провалится'
    case 'learnSpell':
      return `Запомнено: ${book.spellName(effect.spell)}`
    case 'refill':
      return value ? `${statName(effect.stat)} ${signed(value)}: снова как в начале${effect.plus ? ` и еще ${signed(effect.plus)}` : ''}` : `${statName(effect.stat)} и так полна`
    case 'rollBranch':
      return `Выпало ${value}: путь — ${Number(effect.branches[outcome?.target ?? 0]?.link)}`
    case 'retryRoll':
      return `Получилось с ${outcome?.rounds}-й попытки: ${statName(effect.cost.stat)} −${outcome?.damage}`
    case 'forgetSpell':
      return value ? `Больше не поможет: ${book.spellName(effect.spell)}` : `${book.spellName(effect.spell)}: и так не было`
    case 'riddle':
      return `Разгадано: ${value}`
    case 'gainItem':
      return `В мешке: ${lowerItem(effect.item)}`
    case 'loseItems':
      return value ? 'Покупки пропали' : 'Красть было нечего'
    case 'roll':
      return `Выпало ${value}: ${strength.name} ${signed(-value)}`
    case 'charismaTest':
      return `Выпало ${value}: ${outcome?.success ? `вы понравились, ${testedName} +1` : `не вышло, ${testedName} −1`}`
    case 'agilityTest':
      return `Выпало ${value}: ${lower(agility.of)} ${outcome?.success ? 'хватило' : 'не хватило'}`
    case 'parityRoll':
      return `Выпало ${value}, ${value % 2 === 0 ? 'четное' : 'нечетное'}: ${strength.name} ${signed(-value)}`
    case 'duel':
      return `Вы ${outcome?.dice?.[0]}, противник ${outcome?.dice?.[1]}: ${outcome?.success ? 'выиграли' : 'проиграли'}`
    case 'attrition':
      return `${effect.enemy} отстали: одолено ${value}, потеряно ${outcome?.damage} ${strength.of}`
    case 'combat':
      if (effect.mode === 'npc') {
        return `${outcome?.success ? 'Победил' : 'Проиграл'} ${enemyName(effect.enemies[0]?.name).toLocaleLowerCase('ru')}`
      }
      return `${outcome?.success ? 'Победа' : 'Бой проигран'} за ${outcome?.rounds} р., ${strength.name} ${signed(-(outcome?.damage ?? 0))}`
        + (outcome?.success && effect.reward ? `, ${mindName} +${effect.reward}` : '')
    case 'luckRestore':
      if (scoreLuck) return outcome?.success ? `УДАЧА восстановлена: ${value}` : `УДАЧА и так полна: ${value}`
      return outcome?.success ? `Выпало ${value}: квадрат УДАЧИ очищен` : `Выпало ${value}: квадрат и так был чист`
    case 'optional':
      return `${statName(effect.stat)} ${signed(value)}`
    case 'purchase':
      return `Куплено: ${lowerItem(effect.item)}, ${effect.price} зол.`
    case 'refund':
      return `Возвращено торговцу: ${lowerItem(effect.item)}, +${effect.price} зол.`
    case 'pickup':
      return `Взято: ${lowerItem(effect.item)}`
    case 'castSpell':
      return book.spell(effect.spell).action ? `Использовано: ${book.spellName(effect.spell)}` : `Произнесено: ${book.spellName(effect.spell)}`
  }
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase('ru') + text.slice(1)

const resolved = computed(() => visible.value.filter(entry => entry.resolved))
const luckContext = computed(() => ({ luck: character.value.luck }))

const cards = computed(() => {
  const list: { model: OutcomeCardModel; fresh: boolean }[] = []
  const arrival = arrivalCard(resolved.value)
  if (arrival) {
    list.push({ model: arrival, fresh: resolved.value.some(entry => entry.automatic && effects.isFresh(entry.index)) })
  }
  for (const entry of resolved.value) {
    const model = actionCard(entry, luckContext.value)
    if (model) list.push({ model, fresh: effects.isFresh(entry.index) })
  }
  return list
})

const ledger = computed(() => resolved.value
  .filter(entry => !hasCard(entry, luckContext.value))
  .map(entry => ({ index: entry.index, text: capitalize(describe(entry)) })))

const instruction = ({ effect, outcome }: EffectEntry): string => {
  switch (effect.kind) {
    case 'roll': return `Бросьте ${diceText(effect.dice)} и вычтите выпавшее из ${strength.of}.`
    case 'charismaTest': return `Проверьте ${testedName}: на двух кубиках должно выпасть не больше ${character.value.attributes[tested] ?? 0}.`
    case 'agilityTest': return `На двух кубиках должно выпасть не больше вашей ${agility.of}, ${character.value.agility}.`
    case 'parityRoll': return `Бросьте два кубика: сумму вычтите из ${strength.of}, а чет или нечет решит, куда идти.`
    case 'retryRoll': return outcome
      ? `Попыток: ${outcome.rounds}, последний бросок ${outcome.dice?.join(':')}. Каждый бросок стоит ${effect.cost.amount} ${book.statLabel(effect.cost.stat).of}.`
      : `Бросайте ${diceText(effect.dice)}, пока не выпадет ${effect.hits.join(' или ')}; каждый бросок стоит ${effect.cost.amount} ${book.statLabel(effect.cost.stat).of}. Остановиться можно в любой момент.`
    case 'rollBranch': return `Бросьте ${diceText(effect.dice)}: ${effect.branches.map((branch, i, all) => `${i === 0 ? (branch.upTo === 1 ? '1' : `до ${branch.upTo}`) : (all[i - 1]!.upTo + 1 === branch.upTo ? branch.upTo : `${all[i - 1]!.upTo + 1}–${branch.upTo}`)} — ${Number(branch.link)}`).join(', ')}.`
    case 'duel': return 'Бросьте кубик за себя и за гнома: у кого больше, тот и выиграл.'
    case 'luckRestore': return scoreLuck ? 'Можно прибавить 1 к УДАЧЕ.' : 'Можно бросить кубик и очистить квадрат УДАЧИ с выпавшим числом.'
    case 'optional': return effect.label
    case 'pickup': return `Можно взять с собой: ${lowerItem(effect.item)}.`
    case 'castSpell': {
      const names = [effect.spell, ...(effect.with ?? [])].map(id => book.spellName(id)).join(' и ')
      const code = book.spell(effect.spell)
      if (code.item) return `Можно воспользоваться: ${names}.`
      return code.action ? `Можно позвать на помощь: ${names}.` : `Вы знаете ${names}.`
    }
    default: return ''
  }
}

const buttonLabel = ({ effect }: EffectEntry): string => {
  switch (effect.kind) {
    case 'roll': return effect.dice === 1 ? 'Бросить кубик' : 'Бросить кубики'
    case 'charismaTest': return `Проверить ${testedName}`
    case 'luckRestore': return scoreLuck ? 'Прибавить УДАЧУ' : 'Бросить кубик'
    case 'optional': return 'Вычеркнуть'
    case 'pickup': return 'Взять'
    case 'castSpell': {
      const code = book.spell(effect.spell)
      return code.action ?? (code.item ? `Воспользоваться: ${code.name.toLocaleLowerCase('ru')}` : 'Произнести заклятие')
    }
    default: return 'Бросить кубики'
  }
}

const buttonIcon = ({ effect }: EffectEntry) => {
  if (effect.kind === 'pickup') return 'i-lucide-hand'
  if (effect.kind === 'castSpell') return 'i-lucide-wand-sparkles'
  if (effect.kind === 'optional') return undefined
  return 'i-lucide-dices'
}

const duelTie = ref('')

const riddleAnswers = reactive<Record<number, string>>({})
const riddleMisses = reactive<Record<number, string>>({})
const answer = (entry: EffectEntry) => {
  const given = (riddleAnswers[entry.index] ?? '').trim()
  if (!given) return
  const target = effects.answerRiddle(entry.index, given)
  if (target) emit('navigate', target)
  else riddleMisses[entry.index] = given
}

const act = (entry: EffectEntry) => {
  switch (entry.effect.kind) {
    case 'roll': effects.roll(entry.index); break
    case 'charismaTest': effects.testCharisma(entry.index); break
    case 'agilityTest': effects.testAgility(entry.index); break
    case 'parityRoll': effects.parityRoll(entry.index); break
    case 'rollBranch': effects.rollBranch(entry.index); break
    case 'retryRoll': effects.retryRoll(entry.index); break
    case 'duel': {
      const result = effects.duel(entry.index)
      duelTie.value = result?.tie ? `${result.player} : ${result.opponent}` : ''
      break
    }
    case 'luckRestore': effects.restoreLuck(entry.index); break
    case 'optional': effects.applyOptional(entry.index); break
    case 'pickup': effects.pickup(entry.index); break
    case 'castSpell': {
      const target = effects.castSpell(entry.index)
      if (target) emit('navigate', target)
      break
    }
  }
}

// Combat

const target = ref(0)

const skillLabel = (effect: CombatEffect) => {
  const base = effect.type === 'mind' && mindSkill ? character.value.attributes[mindSkill] ?? 0 : character.value.agility
  return `${effect.type === 'mind' ? mindName : agilityName} ${base + (effect.skillModifier ?? 0)}`
}

const combatRules = (effect: CombatEffect) => {
  const rules: string[] = []
  if (effect.enemyDamage) rules.push(`Каждая рана отнимает у вас ${effect.enemyDamage} ${strength.of}.`)
  if (effect.skillModifier) rules.push(`В этом бою ${agility.name} у вас на ${Math.abs(effect.skillModifier)} меньше.`)
  if (effect.targetStrength) rules.push(`Бой окончен, когда ${strength.name} противника упадет до ${effect.targetStrength}.`)
  if (effect.roundLimit) rules.push(`Нужно победить за ${effect.roundLimit} раунд${effect.roundLimit < 5 ? 'а' : 'ов'}.`)
  if (effect.mode === 'npc') rules.push(`Вы бросаете кубики за обоих, а болеете за первого.`)
  if (effect.reward) rules.push('Победа прибавит 1 к Силе мысли.')
  return rules
}

/** Ways out of a fight open right now (a flight, or a branch the fights have opened), with their cost */
const openEscapes = (entry: EffectEntry) => (entry.effect.kind === 'combat' ? entry.effect.escapeLinks ?? [] : [])
  .map(link => ({ link, state: effects.linkState(link) }))
  .filter(({ state }) => state.status === 'open')
  .map(({ link, state }) => `${Number(link)}${state.status === 'open' && state.cost ? ` (${formatCost(state.cost)})` : ''}`)

const enemyStrength = (entry: EffectEntry, i: number) => effects.fightState(entry.index).enemies[i] ?? 0

const enemyDown = (entry: EffectEntry, i: number) =>
  entry.effect.kind === 'combat' && (enemyStrength(entry, i) ?? 0) <= (entry.effect.targetStrength ?? 0)

const attackOf = (entry: EffectEntry, slot: number) => {
  const attack = entry.outcome?.attacks?.[slot]
  return attack === undefined || attack < 0 ? '—' : attack
}

/** One sentence per round: who wounded whom */
const roundSummary = (entry: EffectEntry) => {
  const { effect, outcome } = entry
  if (effect.kind !== 'combat' || !outcome?.attacks) return ''
  const name = (enemy: CombatEnemyStats | undefined) => enemyName(enemy?.name)

  if (effect.mode === 'npc') {
    const [a, b] = outcome.attacks as [number, number]
    if (a === b) return 'Удары отбиты.'
    const [winner, loser] = a > b ? [effect.enemies[0], effect.enemies[1]] : [effect.enemies[1], effect.enemies[0]]
    return `${name(winner)} наносит удар. ${name(loser)} теряет 2 ${strength.of}.`
  }

  const [player, ...enemyAttacks] = outcome.attacks as [number, ...number[]]
  const parts: string[] = []
  enemyAttacks.forEach((attack, i) => {
    if (attack < 0) return
    const enemy = name(effect.enemies[i])
    const ally = effect.champion && outcome.allyRound ? enemyName(effect.champion.name) : null
    if (attack > player && ally) parts.push(`${enemy} ранит союзника: ${ally} −2 ${strength.of}.`)
    else if (attack > player) parts.push(`Вас ранит ${enemy.toLocaleLowerCase('ru')}: −${effect.enemyDamage ?? 2} ${strength.of}.`)
    else if (attack < player && i === outcome.target) parts.push(`${enemy} теряет ${effects.woundDamage(effect.type)} ${strength.of}.`)
    else if (attack === player) parts.push(`${enemy} отбивает удар.`)
  })
  return parts.join(' ') || 'Никто не ранен.'
}

/** Pencil tally marks, in groups of five */
const tally = (n: number) => `${'卌 '.repeat(Math.floor(n / 5))}${'|'.repeat(n % 5)}`.trim()
</script>

<style scoped>
@reference "../assets/css/main.css";

.turn {
  @apply mt-8;
  /* Own stacking context, so the sheet's lifted-corner shadows sit between it and the page */
  isolation: isolate;
}

/* A short centered rule: a section break, as a book sets it */
.turn::before {
  content: '';
  display: block;
  width: 4rem;
  margin: 0 auto 1.75rem;
  border-top: 1.5px solid var(--color-ink);
}

.turn > :is(.outcome-card, .ledger) + .step,
.step + .step {
  @apply mt-6;
}

/* The merchant's price list reads as one ruled list, not separate steps */
.step:has(> .shop) + .step:has(> .shop) {
  @apply mt-0;
}

.ledger {
  @apply mt-4 text-center;
}

.outcome-card + .outcome-card {
  @apply mt-14;
}

/* An instruction and its action form one centered unit */
.instruction {
  @apply text-[1.125rem] leading-relaxed text-center text-balance;
}

/* Actions sit on the centre axis, so the button is always in the same place from section to section */
.actions {
  @apply mt-4 flex flex-col items-center gap-2 text-center;
}

.encounter .actions {
  @apply mt-5;
}

/*
 * The fight is a separate sheet of paper lying on the book page: nearly the same paper tone,
 * a tight contact shadow at the edge, a soft ambient one beneath, and slightly lifted
 * lower corners. No ink border: the shadow is what separates it from the page.
 */
.encounter {
  @apply relative px-5 py-6 sm:px-7 my-2;
  /* A hair lighter than the page (#efe8d6): the same paper, just not yellowed by the binding */
  background-color: #f2ecdc;
  box-shadow:
    0 0 0 1px rgb(34 28 22 / 0.06),
    0 1px 2px rgb(34 28 22 / 0.14),
    0 4px 10px -2px rgb(34 28 22 / 0.12),
    0 18px 32px -18px rgb(34 28 22 / 0.4);
}

/* Lifted lower corners: two angled shadows peeking out from under the sheet */
.encounter::before,
.encounter::after {
  content: '';
  position: absolute;
  z-index: -1;
  bottom: 10px;
  width: 45%;
  height: 20%;
  box-shadow: 0 12px 14px rgb(34 28 22 / 0.28);
}

.encounter::before {
  left: 10px;
  transform: rotate(-2.5deg);
}

.encounter::after {
  right: 10px;
  transform: rotate(2.5deg);
}

.encounter-title {
  font-family: var(--font-ornament);
  font-size: 1.6rem;
  font-weight: 400;
  line-height: 1.1;
}

.encounter table {
  border-collapse: collapse;
}

.encounter th,
.encounter td {
  @apply py-3 align-baseline;
  border-bottom: 1px solid var(--ui-border);
}

.encounter tbody tr:last-child :is(th, td) {
  border-bottom: 1.5px solid var(--color-ink);
}

.encounter thead th {
  @apply text-right pb-1.5;
  font-family: var(--font-display);
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  border-bottom: 1.5px solid var(--color-ink);
}

.encounter tbody th {
  @apply text-left pr-3 font-display text-[1.375rem] font-semibold leading-tight;
}

.encounter tbody th :is(.block) {
  @apply font-sans text-base font-normal mt-0.5;
}

.encounter td {
  @apply text-right text-[2rem] leading-none w-24 tabular-nums;
}

.encounter td .text-base {
  @apply text-lg;
}

.encounter tr.is-down :is(th, td) {
  @apply line-through decoration-graphite/70 opacity-60;
}

.target-pick {
  @apply inline-flex items-center gap-2 font-semibold cursor-pointer text-left;
}

.target-dot {
  @apply inline-block size-3 rounded-full shrink-0;
  border: 1.5px solid var(--color-ink);
  transition: background-color 150ms ease;
}

.target-pick[aria-pressed="true"] .target-dot {
  background: var(--ui-primary);
  border-color: var(--ui-primary);
}

.target-pick:focus-visible {
  @apply outline-2 outline-offset-2 outline-primary rounded-xs;
}

.tally {
  letter-spacing: 0.1em;
}
</style>
