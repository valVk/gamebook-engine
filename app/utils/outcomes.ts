import { sentenceCase } from '#shared/engine/book'
import type { Deadline } from '#shared/engine/book'
import { getBook } from '#shared/engine/library'
import type { EndingKind, SectionEffect } from '#shared/engine/rules'
import type { EffectOutcome } from './character'

/**
 * Outcome cards: what a reader gains or loses, dealt as a card (see OutcomeCard.vue).
 * Everything a section does on arrival becomes one card; each resolved action (roll, fight,
 * test, pickup...) becomes its own card.
 */
export type OutcomeTone = 'reward' | 'penalty' | 'neutral'

export interface OutcomeCardModel {
  key: string
  tone: OutcomeTone
  title: string
  /** Emblem in the medallion, unless a single die decided the outcome */
  icon?: string
  die?: number
  /** Dice shown inside the card */
  dice?: number[]
  /** The luck row with one square marked (luck restoration) */
  luckRow?: { luck: readonly boolean[]; mark: number }
  lines: string[]
}

export interface OutcomeEntry {
  index: number
  effect: SectionEffect
  outcome?: EffectOutcome
  resolved: boolean
  automatic: boolean
}

/** How a stat change reads on a card: its name after the number, emblem, titles for a gain and a loss */
interface StatCard {
  name: string
  icon: string
  titles: [gain: string, loss: string]
  /** How much a change of this stat matters when several share one card */
  weight: (gain: boolean) => number
}

/** The stat's name after a number, as the current book calls it: "−2 СИЛЫ", "−2 ВЫНОСЛИВОСТИ" */
const of = (stat: string) => getBook().statLabel(stat).of

const STAT_CARDS: Record<string, () => Omit<StatCard, 'name'>> = {
  strength: () => ({ icon: 'i-lucide-heart', titles: ['Силы возвращаются', 'Рана'], weight: gain => (gain ? 2 : 5) }),
  agility: () => ({ icon: 'i-lucide-zap', titles: [`${sentenceCase(getBook().statLabel('agility').name)} возвращается`, 'Увечье'], weight: () => 6 }),
  gold: () => ({ icon: 'i-lucide-coins', titles: ['Находка', 'Расход'], weight: () => 3 }),
  food: () => ({ icon: 'i-lucide-wheat', titles: ['Припасы', 'Пропала еда'], weight: () => 3 }),
  // A score УДАЧА («Шелтон»: "прибавьте себе 2 УДАЧИ")
  luck: () => ({ icon: 'i-lucide-clover', titles: ['Удача улыбается', 'Удача уходит'], weight: () => 7 })
}

/** Core stats have their cards here (named by the book); a book's attributes bring theirs in the manifest */
const statCard = (stat: string): StatCard => {
  const core = STAT_CARDS[stat]
  if (core) return { name: of(stat), ...core() }
  const attribute = getBook().character.attributes[stat]
  const label = getBook().statLabel(stat)
  return {
    name: label.of,
    icon: attribute?.card?.icon ?? 'i-lucide-sparkles',
    titles: attribute?.card?.titles ?? [`${label.name}: прибавка`, `${label.name}: потеря`],
    weight: () => attribute?.card?.weight ?? 4
  }
}

const signed = (value: number) => (value > 0 ? `+${value}` : `−${Math.abs(value)}`)
const lower = (text: string) => text.toLocaleLowerCase('ru')
const sentence = (text: string) => text.charAt(0).toLocaleUpperCase('ru') + text.slice(1)
const rounds = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'раунд' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'раунда' : 'раундов'}`

export const enemyName = (name: string | null | undefined) =>
  name ? sentence(lower(name).replace(/^«(.)/, (_, c: string) => `«${c.toLocaleUpperCase('ru')}`)) : 'Противник'

/** One line and its weight for an automatic effect; weight picks the card's title and emblem */
interface ArrivalPart {
  line: string
  tone: OutcomeTone
  weight: number
  title: string
  icon: string
}

const arrivalPart = ({ effect, outcome }: OutcomeEntry): ArrivalPart | null => {
  const value = outcome?.value ?? 0
  switch (effect.kind) {
    case 'change': {
      if (value === 0) return null // already at the limit: nothing happened
      const gain = value > 0
      const stat = statCard(effect.stat)
      const line = `${signed(value)} ${stat.name}`
      return { line, tone: gain ? 'reward' : 'penalty', weight: stat.weight(gain), title: stat.titles[gain ? 0 : 1], icon: stat.icon }
    }
    case 'loseAll':
      if (value === 0) return null
      return { line: effect.stat === 'food' ? 'Пропала вся ЕДА' : 'Пропало все золото', tone: 'penalty', weight: 8, title: 'Все пропало', icon: statCard(effect.stat).icon }
    case 'meal': {
      const armor = outcome?.damage ? `; доспехи: −${outcome.damage} ${of('strength')}` : ''
      return outcome?.success
        ? { line: `Съедена порция ЕДЫ${armor}`, tone: armor ? 'penalty' : 'neutral', weight: 1, title: 'Привал', icon: 'i-lucide-wheat' }
        : { line: `Еды нет: ${signed(value)} ${of('strength')}${armor}`, tone: 'penalty', weight: 5, title: 'Голод', icon: 'i-lucide-wheat' }
    }
    case 'luckPenalty':
      return { line: 'Следующая проверка УДАЧИ провалится без броска', tone: 'penalty', weight: 10, title: 'Гнев богов', icon: 'i-lucide-clover' }
    case 'learnSpell':
    {
      const code = getBook().spell(effect.spell)
      const instruction = getBook().codeInstruction(effect.spell)
      const line = instruction ? `${code.name}: ${instruction}` : code.name
      return { line, tone: 'reward', weight: 9, title: code.action ? 'Новый союзник' : 'Новое заклятие', icon: 'i-lucide-wand-sparkles' }
    }
    case 'refill':
      if (!value) return null
      return { line: `${signed(value)} ${statCard(effect.stat).name}`, tone: 'reward', weight: 7, title: statCard(effect.stat).titles[0], icon: statCard(effect.stat).icon }
    case 'forgetSpell':
      if (!value) return null
      return { line: `Больше не поможет: ${getBook().spellName(effect.spell)}`, tone: 'penalty', weight: 8, title: 'Потеря', icon: 'i-lucide-wand-sparkles' }
    case 'gainItem': {
      // A burden rather than a gift (594: the rusty blade)
      const book = getBook()
      const agility = book.item(effect.item)?.agility
      if (agility && agility < 0) return { line: `${book.itemName(effect.item)}: ${signed(agility)} ${of('agility')}, пока нет другого оружия`, tone: 'penalty', weight: 6, title: 'Плохая замена', icon: 'i-lucide-sword' }
      return { line: book.itemName(effect.item), tone: 'reward', weight: 9, title: 'Новый предмет', icon: 'i-lucide-backpack' }
    }
    case 'loseItems':
      if (!value) return null
      if (effect.items.length === 1) return { line: getBook().itemName(effect.items[0]!), tone: 'neutral', weight: 4, title: 'Израсходовано', icon: 'i-lucide-flask-conical' }
      return { line: 'Пропали все покупки', tone: 'penalty', weight: 9, title: 'Потеря', icon: 'i-lucide-backpack' }
    default:
      return null
  }
}

/** False when the effect leaves no card (a purchase, a spell cast, a change already at its limit) */
export const hasCard = (entry: OutcomeEntry, context: { luck: readonly boolean[] }) =>
  entry.automatic ? arrivalPart(entry) !== null : actionCard(entry, context) !== null

/** All automatic effects of a section on one card */
export const arrivalCard = (entries: OutcomeEntry[]): OutcomeCardModel | null => {
  const parts = entries
    .filter(entry => entry.automatic && entry.resolved)
    .map(arrivalPart)
    .filter((part): part is ArrivalPart => part !== null)
  if (!parts.length) return null

  const lead = parts.reduce((best, part) => (part.weight > best.weight ? part : best))
  const tones = new Set(parts.map(part => part.tone).filter(tone => tone !== 'neutral'))
  const tone: OutcomeTone = tones.size === 1 ? [...tones][0]! : tones.size === 0 ? 'neutral' : lead.tone
  return { key: 'arrival', tone, title: lead.title, icon: lead.icon, lines: parts.map(part => part.line) }
}

/** The card for one resolved action, or null when it deserves none (purchases, spells cast) */
export const actionCard = (entry: OutcomeEntry, context: { luck: readonly boolean[] }): OutcomeCardModel | null => {
  const { effect, outcome, index } = entry
  if (!entry.resolved || entry.automatic) return null
  const value = outcome?.value ?? 0
  const key = `action-${index}`

  switch (effect.kind) {
    case 'roll': {
      const dice = outcome?.dice ?? []
      return {
        key,
        tone: 'penalty',
        title: 'Рана',
        ...(dice.length === 1 ? { die: dice[0] } : { icon: 'i-lucide-heart-crack', dice }),
        lines: [dice.length > 1 ? `Выпало ${dice.join(' + ')} = ${value}` : `Выпало ${value}`, `−${value} ${of('strength')}`]
      }
    }
    case 'combat': {
      const lost = outcome?.damage ?? 0
      const many = effect.enemies.length > 1
      if (effect.mode === 'npc') {
        return {
          key,
          tone: outcome?.success ? 'reward' : 'penalty',
          title: outcome?.success ? 'Ваша жертва победила' : 'Ваша жертва погибла',
          icon: 'i-lucide-swords',
          lines: [`${enemyName(effect.enemies[0]?.name)} — бой длился ${rounds(outcome?.rounds ?? 0)}`]
        }
      }
      const ally = effect.champion && !outcome?.takenOver ? enemyName(effect.champion.name) : null
      if (!outcome?.success && ally) {
        return { key, tone: 'penalty', title: 'Союзник пал', icon: 'i-lucide-swords', lines: [`${ally} погибает в бою`, 'Сражаться дальше придется вам'] }
      }
      if (outcome?.success && ally) {
        return { key, tone: 'reward', title: 'Союзник победил', icon: 'i-lucide-swords', lines: [`${ally}: враги повержены за ${rounds(outcome.rounds ?? 0)}`] }
      }
      if (outcome?.success && outcome.rounds === 0) {
        return { key, tone: 'reward', title: 'Враги уже повержены', icon: 'i-lucide-swords', lines: ['Все пали в прежних схватках'] }
      }
      if (!outcome?.success) {
        // Why the fight ended: the round limit, or the reader worn down to `yieldAt`
        const timedOut = effect.roundLimit !== undefined && (outcome?.rounds ?? 0) >= effect.roundLimit
        return {
          key,
          tone: 'penalty',
          title: timedOut ? 'Не успели' : 'Силы на исходе',
          icon: 'i-lucide-swords',
          lines: [
            timedOut ? `За ${rounds(outcome?.rounds ?? 0)} победить не удалось` : `Бой длился ${rounds(outcome?.rounds ?? 0)}`,
            lost ? `Потеряно ${of('strength')}: ${lost}` : 'Вы не ранены'
          ]
        }
      }
      // Names are of either gender («Рыба-единорог», «Пятнистая акула»): the lines avoid agreeing with them
      const name = many ? 'Все враги побеждены' : `${enemyName(effect.enemies[0]?.name)}: победа`
      const wornDown = (effect.targetStrength ?? 0) > 0
        ? `${many ? 'Враги измотаны' : enemyName(effect.enemies[0]?.name)}: ${of('strength')} не больше ${effect.targetStrength}`
        : null
      return {
        key,
        tone: 'reward',
        title: effect.type === 'mind' ? 'Победа в поединке' : 'Победа!',
        icon: effect.type === 'mind' ? 'i-lucide-brain' : 'i-lucide-swords',
        lines: [
          ...(effect.champion && outcome.takenOver ? [`${enemyName(effect.champion.name)} выбывает из боя, его довели вы`] : []),
          wornDown ? `${wornDown} — за ${rounds(outcome.rounds ?? 0)}` : `${name} за ${rounds(outcome.rounds ?? 0)}`,
          lost ? `Потеряно ${of('strength')}: ${lost}` : 'Ни одной раны',
          ...(effect.reward ? [`+${effect.reward} к Силе мысли`] : [])
        ]
      }
    }
    case 'attrition':
      return {
        key,
        tone: 'reward',
        title: `${effect.enemy} отстали`,
        icon: 'i-lucide-swords',
        lines: [`Одолено: ${value} за ${rounds(outcome?.rounds ?? 0)}`, `Потеряно ${of('strength')}: ${outcome?.damage ?? 0}`]
      }
    case 'charismaTest':
      return {
        key,
        tone: outcome?.success ? 'reward' : 'penalty',
        title: outcome?.success ? 'Вы понравились' : 'Не вышло',
        icon: 'i-lucide-smile',
        lines: [`Выпало ${value}`, outcome?.success ? '+1 к ОБАЯНИЮ' : '−1 от ОБАЯНИЯ']
      }
    case 'agilityTest':
      return {
        key,
        tone: outcome?.success ? 'reward' : 'penalty',
        title: outcome?.success ? `${sentenceCase(of('agility'))} хватило` : `Не хватило ${lower(of('agility'))}`,
        icon: 'i-lucide-zap',
        dice: outcome?.dice,
        lines: [`Выпало ${value}`]
      }
    case 'retryRoll':
      return {
        key,
        tone: 'reward',
        title: 'Получилось',
        icon: 'i-lucide-dices',
        dice: outcome?.dice,
        lines: [`С ${outcome?.rounds}-й попытки`, `−${outcome?.damage} ${of(effect.cost.stat)}`]
      }
    case 'rollBranch':
      return {
        key,
        tone: 'neutral',
        title: 'Жребий брошен',
        icon: 'i-lucide-dices',
        dice: outcome?.dice,
        lines: [`Выпало ${value}`, `Ваш путь — ${Number(effect.branches[outcome?.target ?? 0]?.link)}`]
      }
    case 'parityRoll':
      return {
        key,
        tone: 'penalty',
        title: value % 2 === 0 ? 'Четное' : 'Нечетное',
        icon: 'i-lucide-heart-crack',
        dice: outcome?.dice,
        lines: [`Выпало ${value}`, `−${value} ${of('strength')}`]
      }
    case 'duel': {
      const [player, opponent] = outcome?.dice ?? []
      return {
        key,
        tone: outcome?.success ? 'reward' : 'penalty',
        title: outcome?.success ? 'Вы выиграли' : 'Гном выиграл',
        icon: 'i-lucide-dices',
        dice: outcome?.dice,
        lines: [`У вас ${player}, у гнома ${opponent}`]
      }
    }
    case 'luckRestore':
      if (getBook().luckSystem.kind === 'score') {
        return {
          key,
          tone: outcome?.success ? 'reward' : 'neutral',
          title: outcome?.success ? 'Удача возвращается' : 'Удача и так полна',
          icon: 'i-lucide-clover',
          lines: [`УДАЧА ${value}`]
        }
      }
      return {
        key,
        tone: outcome?.success ? 'reward' : 'neutral',
        title: outcome?.success ? 'Удача возвращается' : 'Квадрат и так чист',
        die: value || undefined,
        luckRow: value ? { luck: context.luck, mark: value } : undefined,
        lines: [outcome?.success ? `Квадрат ${value} снова свободен` : `Квадрат ${value} не был зачеркнут`]
      }
    case 'optional':
      return { key, tone: value < 0 ? 'penalty' : 'reward', title: value < 0 ? 'Кража' : 'Находка', icon: statCard(effect.stat).icon, lines: [`${signed(value)} ${statCard(effect.stat).name}`] }
    case 'pickup':
      return { key, tone: 'reward', title: 'Новый предмет', icon: 'i-lucide-backpack', lines: [getBook().itemName(effect.item)] }
    default:
      return null
  }
}

/** A deadline passed: the book sends the reader to its section */
export const deadlineCard = (deadline: Deadline): OutcomeCardModel => ({
  key: 'deadline',
  tone: 'penalty',
  title: deadline.title,
  icon: 'i-lucide-hourglass',
  lines: [`Дальше — параграф ${Number(deadline.section)}.`]
})

/** Death: СИЛА fell to zero */
export const deathCard = (): OutcomeCardModel => ({
  key: 'death',
  tone: 'penalty',
  title: 'Вы погибли',
  icon: 'i-lucide-skull',
  lines: [`${getBook().statLabel('strength').name} иссякла. По правилам книги придется начать путешествие сначала.`]
})

/** A section with no way on, by how it ends (the book's `endings`) */
export const endingCard = (kind: EndingKind): OutcomeCardModel => {
  switch (kind) {
    case 'victory':
      return { key: 'ending', tone: 'reward', title: 'Победа!', icon: 'i-lucide-crown', lines: [getBook().victoryLine ?? 'Миссия выполнена.'] }
    case 'survived':
      return { key: 'ending', tone: 'neutral', title: 'Путешествие окончено', icon: 'i-lucide-footprints', lines: ['Вы живы, но миссия не выполнена.'] }
    case 'captured':
      return { key: 'ending', tone: 'penalty', title: 'Плен', icon: 'i-lucide-lock', lines: ['Путешествие окончено: вы во власти врага.'] }
    case 'death':
      return { key: 'ending', tone: 'penalty', title: 'Вы погибли', icon: 'i-lucide-skull', lines: ['Путешествие окончено.'] }
  }
}
