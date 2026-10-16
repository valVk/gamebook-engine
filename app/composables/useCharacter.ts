import { DiceRoll } from '@dice-roller/rpg-dice-roller'
import { computed, readonly, ref } from 'vue'
import { parseFormula } from '#shared/engine/dice'
import { getBook } from '#shared/engine/library'
import type { LuckStart } from '#shared/engine/luck'
import {
  attributeBounds,
  createDefaultCharacter,
  sanitizeStoredCharacter
} from '~/utils/character'
import type { CharacterStats, EffectOutcome, RollType } from '~/utils/character'


/** Each book keeps its own traveller */
export const saveKey = (bookId: string) => `gamebook:${bookId}`

/** Earlier names of the save key, moved to the current one when a book opens */
const OLD_SAVE_PREFIXES = ['desert-lord:']

/** The core stats every book shares; any other stat a rule names is one of the book's attributes */
const CORE_STATS = new Set(['strength', 'agility', 'gold', 'food'] as const)
/** УДАЧА is changed through the book's luck system, not as a plain number */
const LUCK = 'luck'
type CoreStat = typeof CORE_STATS extends Set<infer T> ? T : never
const isCoreStat = (stat: string): stat is CoreStat => CORE_STATS.has(stat as CoreStat)

export interface LuckCheckResult {
  lucky: boolean
  /** Rolled total, or null when the check failed without a roll (section 213 penalty) */
  roll: number | null
  penalty: boolean
  /** Score luck: the dice thrown and УДАЧА after the check */
  dice?: number[]
  score?: number
}

const rollDie = (): number => new DiceRoll('1d6').total
/** One die for the luck system (it may ask for other than six sides) */
const luckDie = (sides = 6): number => (sides === 6 ? rollDie() : new DiceRoll(`1d${sides}`).total)

/** Roll `count` d6 and return the individual dice */
export const rollDice = (count: number): number[] => Array.from({ length: count }, rollDie)

/** One stat rolled by its creation formula ('2d6+12'): the dice, the modifier and the total */
export interface FormulaRoll {
  stat: string
  formula: string
  dice: number[]
  modifier: number
  total: number
}

export const rollFormula = (stat: string, formula: string): FormulaRoll => {
  const { count, sides, modifier } = parseFormula(formula)
  const dice = Array.from({ length: count }, () => new DiceRoll(`1d${sides}`).total)
  return { stat, formula, dice, modifier, total: dice.reduce((a, b) => a + b, 0) + modifier }
}

/** Character creation: one 2d6 throw read from the book's table, or each stat by its own formula */
export type StatsRoll =
  | { kind: 'table'; dice: number[]; sum: number; stats: Record<string, number> }
  | { kind: 'formula'; rolls: FormulaRoll[]; stats: Record<string, number> }

// Client-side singleton. It is only mutated in the browser (initialization and all
// actions run from event handlers or onMounted), so SSR requests never share state.
const character = ref<CharacterStats>(createDefaultCharacter())
const isCharacterCreated = ref(false)
/** The book whose save is loaded; opening another book loads that book's traveller */
let loadedBook: string | null = null

/** A save from before the library: moved to the book's own key the first time the book opens */
const migrateLegacySave = (key: string) => {
  const book = getBook()
  const legacy = [...OLD_SAVE_PREFIXES.map(prefix => `${prefix}${book.id}`), book.legacySaveKey]
  for (const old of legacy) {
    if (!old || localStorage.getItem(key) !== null) return
    const stored = localStorage.getItem(old)
    if (stored === null) continue
    localStorage.setItem(key, stored)
    localStorage.removeItem(old)
  }
}

/** Load the save again on the next use (tests; a save changed outside the app) */
export const reloadCharacter = () => {
  loadedBook = null
}

const initializeCharacter = () => {
  if (!import.meta.client) return
  const book = getBook()
  if (loadedBook === book.id) return
  loadedBook = book.id

  character.value = createDefaultCharacter(book)
  isCharacterCreated.value = false

  const key = saveKey(book.id)
  migrateLegacySave(key)
  const stored = localStorage.getItem(key)
  if (!stored) return

  try {
    const parsed = sanitizeStoredCharacter(JSON.parse(stored), book)
    if (parsed) {
      character.value = parsed
      isCharacterCreated.value = parsed.gameStartTime > 0
    }
  } catch {
    localStorage.removeItem(key)
  }
}

export const useCharacter = () => {
  const saveCharacter = () => {
    if (import.meta.client) {
      localStorage.setItem(saveKey(getBook().id), JSON.stringify(character.value))
    }
  }

  // Roll the starting stats: 2d6 looked up in the book's table, or the book's formulas
  const rollStats = (): StatsRoll => {
    const { table, roll } = getBook().character
    let result: StatsRoll
    if (table) {
      const dice = [rollDie(), rollDie()]
      const sum = dice[0]! + dice[1]!
      result = { kind: 'table', dice, sum, stats: { ...table[sum]! } as Record<string, number> }
    } else {
      const rolls = Object.entries(roll ?? {}).map(([stat, formula]) => rollFormula(stat, formula as string))
      result = { kind: 'formula', rolls, stats: Object.fromEntries(rolls.map(r => [r.stat, r.total])) }
    }
    const stats = result.stats as { agility: number; strength: number } & Record<string, number>

    character.value.agility = stats.agility
    character.value.strength = stats.strength
    character.value.maxAgility = stats.agility
    character.value.maxStrength = stats.strength
    for (const id of getBook().attributeIds) {
      const rolled = (stats as Record<string, number | undefined>)[id]
      if (rolled !== undefined) character.value.attributes[id] = rolled
    }
    saveCharacter()

    return result
  }

  // The starting УДАЧА, by the book's luck system (squares crossed out, or a score)
  const initializeLuck = (): LuckStart => getBook().luckSystem.start(character.value, luckDie)

  const setPendingRoll = (pageId: string, type: RollType) => {
    character.value.pendingRolls[pageId] = { type, timestamp: Date.now() }
    saveCharacter()
  }

  const setPendingRollResult = (pageId: string, type: RollType, result: boolean, details: { value?: number; penalty?: boolean; dice?: number[]; score?: number } = {}) => {
    character.value.pendingRolls[pageId] = {
      type,
      result,
      timestamp: Date.now(),
      ...(details.value ? { value: details.value } : {}),
      ...(details.penalty ? { penalty: true } : {}),
      ...(details.dice?.length ? { dice: [...details.dice] } : {}),
      ...(details.score !== undefined ? { score: details.score } : {})
    }
    saveCharacter()
  }

  const getPendingRoll = (pageId: string) => character.value.pendingRolls[pageId]

  const clearPendingRoll = (pageId: string) => {
    character.value.pendingRolls = Object.fromEntries(
      Object.entries(character.value.pendingRolls).filter(([id]) => id !== pageId)
    )
    saveCharacter()
  }

  // A luck check by the book's luck system. A pending curse (section 213 of «Повелитель») makes
  // it fail without a roll.
  const checkLuck = (pageId?: string): LuckCheckResult => {
    const luck = getBook().luckSystem
    const penalty = character.value.nextLuckCheckFails
    character.value.nextLuckCheckFails = false
    const thrown = penalty ? luck.forfeit(character.value) : luck.check(character.value, luckDie, { hasCode })
    const result: LuckCheckResult = {
      lucky: thrown.lucky,
      roll: thrown.dice.length ? thrown.total : null,
      penalty,
      ...(luck.kind === 'score' ? { dice: thrown.dice, score: thrown.score } : {})
    }

    if (pageId) {
      setPendingRollResult(pageId, 'luck', result.lucky, { value: result.roll ?? undefined, penalty: result.penalty, dice: result.dice, score: result.score })
    } else {
      saveCharacter()
    }
    return result
  }

  const applyLuckPenalty = () => {
    character.value.nextLuckCheckFails = true
    saveCharacter()
  }

  // "Восстановите УДАЧУ": a die clears its square, or the score gains one
  const restoreLuck = () => {
    const luck = getBook().luckSystem
    const result = luck.restore(character.value, luckDie)
    saveCharacter()
    return luck.kind === 'squares'
      ? { roll: result.value, wasAlreadyAvailable: !result.changed }
      : { roll: null, wasAlreadyAvailable: !result.changed, score: result.value }
  }

  const getAgility = () => character.value.agility
  const setAgility = (value: number) => {
    character.value.agility = Math.max(0, Math.min(value, character.value.maxAgility))
    saveCharacter()
  }

  const getStrength = () => character.value.strength
  const setStrength = (value: number) => {
    character.value.strength = Math.max(0, Math.min(value, character.value.maxStrength))
    saveCharacter()
  }

  const getAttribute = (attribute: string) => character.value.attributes[attribute] ?? 0
  const setAttribute = (attribute: string, value: number) => {
    const { min, max } = attributeBounds(getBook(), attribute)
    character.value.attributes[attribute] = Math.max(min, Math.min(value, max))
    saveCharacter()
  }

  const getGold = () => character.value.gold
  const setGold = (value: number) => {
    character.value.gold = Math.max(0, value)
    saveCharacter()
  }

  const getFood = () => character.value.food
  const setFood = (value: number) => {
    character.value.food = Math.max(0, value)
    saveCharacter()
  }

  // Roll 2d6 against the book's tested attribute (ОБАЯНИЕ): success raises it by 1, failure lowers it
  // by 1. At its maximum it always succeeds, at its minimum it always fails.
  const testCharisma = (): { success: boolean; roll: number; charisma: number } => {
    const attribute = getBook().testedAttribute ?? ''
    const { min, max } = attributeBounds(getBook(), attribute)
    const roll = rollDie() + rollDie()
    const current = getAttribute(attribute)
    const success = current >= max ? true : current <= min ? false : roll <= current

    setAttribute(attribute, current + (success ? 1 : -1))
    return { success, roll, charisma: current }
  }

  // Eat one portion: restores the book's amount of СИЛА, capped at the initial maximum
  const useFood = (): boolean => {
    if (character.value.food <= 0) return false

    character.value.food--
    character.value.strength = Math.min(
      character.value.strength + getBook().character.foodRestores,
      character.value.maxStrength
    )
    saveCharacter()
    return true
  }

  const startJourney = () => {
    if (character.value.agility === 0) {
      throw new Error('Cannot start journey before rolling stats')
    }

    const luckRolls = initializeLuck()
    character.value.gameStartTime = Date.now()
    character.value.currentPage = getBook().start
    character.value.visitedPages = [getBook().start]
    isCharacterCreated.value = true
    saveCharacter()

    return luckRolls
  }

  // Moving to a new section discards roll results from other sections, so a
  // revisited section asks for a fresh roll. Reloading the same section keeps its result.
  const navigateToPage = (pageId: string) => {
    character.value.currentPage = pageId
    if (!character.value.visitedPages.includes(pageId)) {
      character.value.visitedPages.push(pageId)
    }
    character.value.pendingRolls = Object.fromEntries(
      Object.entries(character.value.pendingRolls).filter(([id]) => id === pageId)
    )
    character.value.resolvedEffects = Object.fromEntries(
      Object.entries(character.value.resolvedEffects).filter(([id]) => id === pageId)
    )
    saveCharacter()
  }

  const getCurrentPage = () => character.value.currentPage
  const getVisitedPages = () => character.value.visitedPages

  const getGameDuration = () => {
    if (character.value.gameStartTime === 0) return 0
    return Date.now() - character.value.gameStartTime
  }

  const endGameSession = () => {
    character.value = createDefaultCharacter()
    isCharacterCreated.value = false
    if (import.meta.client) {
      localStorage.removeItem(saveKey(getBook().id))
    }
  }

  // Alias kept for existing callers
  const resetCharacter = () => {
    endGameSession()
  }

  // Fresh random character for the debug pages. It shares storage with the real game,
  // so it starts from a playable section rather than a pseudo page.
  const resetToDebugState = () => {
    character.value = createDefaultCharacter()
    const rollResult = rollStats()
    const luckRolls = initializeLuck()

    character.value.gameStartTime = Date.now()
    character.value.currentPage = getBook().start
    character.value.visitedPages = []
    isCharacterCreated.value = true
    saveCharacter()

    return { rollResult, luckRolls }
  }

  /** Free squares, or the УДАЧА score */
  const getAvailableLuckPoints = () => getBook().luckSystem.available(character.value)

  /**
   * Change a stat by `amount`, respecting the rules: СИЛА and ЛОВКОСТЬ never exceed their
   * initial values, nothing drops below 0. Returns the change actually applied.
   */
  const applyChange = (stat: string, amount: number, aboveStart = false): number => {
    if (stat === LUCK) {
      const applied = getBook().luckSystem.change(character.value, amount, aboveStart)
      saveCharacter()
      return applied
    }
    if (!isCoreStat(stat)) {
      if (!getBook().attributeIds.includes(stat)) return 0
      const current = getAttribute(stat)
      const { min, max } = attributeBounds(getBook(), stat)
      const next = Math.max(Math.min(min, current), Math.min(current + amount, Math.max(max, current)))
      character.value.attributes[stat] = next
      saveCharacter()
      return next - current
    }
    const current = character.value[stat]
    const max = aboveStart
      ? Number.MAX_SAFE_INTEGER
      : stat === 'strength'
        ? character.value.maxStrength
        : stat === 'agility' ? character.value.maxAgility : Number.MAX_SAFE_INTEGER
    const next = Math.max(0, Math.min(current + amount, Math.max(max, current)))
    character.value[stat] = next
    // A gain above the initial value raises it («даже если для этого придется превысить изначальное»)
    if (stat === 'strength' && next > character.value.maxStrength) character.value.maxStrength = next
    if (stat === 'agility' && next > character.value.maxAgility) character.value.maxAgility = next
    saveCharacter()
    return next - current
  }

  /** Fighters' ВЫНОСЛИВОСТЬ carried between sections of one battle */
  const setFoes = (foes: Record<string, number>) => {
    character.value.foes = foes
    saveCharacter()
  }

  /** Back to the initial value, `plus` above it; returns the change */
  const refill = (stat: 'luck' | 'strength' | 'agility', plus = 0): number => {
    if (stat === LUCK) {
      const applied = getBook().luckSystem.refill(character.value, plus)
      saveCharacter()
      return applied
    }
    const maxKey = stat === 'strength' ? 'maxStrength' : 'maxAgility'
    character.value[maxKey] += plus
    const before = character.value[stat]
    character.value[stat] = character.value[maxKey]
    saveCharacter()
    return character.value[stat] - before
  }

  const loseAll = (stat: 'gold' | 'food'): number => applyChange(stat, -character.value[stat])

  /** Current value of a stat a rule names (0 for a stat this character does not have) */
  const statValue = (stat: string): number => (stat === LUCK
    ? getAvailableLuckPoints()
    : isCoreStat(stat) ? character.value[stat] : getAttribute(stat))

  const getResolvedEffects = (pageId: string): Readonly<Record<number, EffectOutcome>> =>
    character.value.resolvedEffects[pageId] ?? {}

  const resolveEffect = (pageId: string, index: number, outcome: EffectOutcome = {}) => {
    character.value.resolvedEffects[pageId] = {
      ...character.value.resolvedEffects[pageId],
      [index]: outcome
    }
    saveCharacter()
  }

  const learnSpell = (spell: string) => {
    if (!character.value.knownSpells.includes(spell)) {
      character.value.knownSpells.push(spell)
      saveCharacter()
    }
  }

  const forgetSpell = (spell: string) => {
    if (!character.value.knownSpells.includes(spell)) return false
    character.value.knownSpells = character.value.knownSpells.filter(known => known !== spell)
    saveCharacter()
    return true
  }

  const knowsSpell = (spell: string) => character.value.knownSpells.includes(spell)

  /** A code at hand: learnt, or its item carried */
  const hasCode = (spell: string) => {
    const book = getBook()
    const item = book.spell(spell).item
    return item ? character.value.inventory.includes(book.itemName(item)) : knowsSpell(spell)
  }

  /** Codes at hand, as the sheet lists them */
  const codesAtHand = () => Object.keys(getBook().spells).filter(hasCode)

  /** The book's definition of an item in the backpack, by its name */
  const itemOf = (item: string) => {
    const book = getBook()
    return book.item(book.itemId(item) ?? '')
  }

  /** ЛОВКОСТЬ carried with an item (armour, a poor blade): taken on arrival, given back on leaving */
  const shiftAgility = (item: string, sign: 1 | -1) => {
    const delta = itemOf(item)?.agility
    if (!delta) return
    const next = character.value.agility + sign * delta
    character.value.agility = Math.max(0, Math.min(next, character.value.maxAgility))
  }

  const hasItem = (item: string) => character.value.inventory.includes(item)

  const removeItem = (item: string) => {
    const index = character.value.inventory.indexOf(item)
    if (index === -1) return false
    character.value.inventory.splice(index, 1)
    shiftAgility(item, -1)
    saveCharacter()
    return true
  }

  const addItem = (item: string) => {
    character.value.inventory.push(item)
    shiftAgility(item, 1)
    // A real weapon replaces a makeshift one (594: the rusty blade)
    if (itemOf(item)?.weapon) {
      for (const name of getBook().itemNamesWhere(definition => definition.replacedByWeapon === true)) removeItem(name)
    }
    saveCharacter()
  }

  /** СИЛА 0 means death */
  const isDead = computed(() => isCharacterCreated.value && character.value.strength <= 0)

  const setDebugStats = (agility: number, strength: number, attributes: Record<string, number> = {}) => {
    character.value.agility = Math.max(1, Math.min(agility, 12))
    character.value.strength = Math.max(1, Math.min(strength, 24))
    for (const [id, value] of Object.entries(attributes)) setAttribute(id, value)
    character.value.maxAgility = character.value.agility
    character.value.maxStrength = character.value.strength
    saveCharacter()
  }

  initializeCharacter()

  return {
    character: readonly(character),
    isCharacterCreated: readonly(isCharacterCreated),
    rollStats,
    startJourney,
    resetCharacter,
    endGameSession,
    checkLuck,
    applyLuckPenalty,
    restoreLuck,
    testCharisma,
    useFood,
    // Pending rolls
    setPendingRoll,
    setPendingRollResult,
    getPendingRoll,
    clearPendingRoll,
    // Page tracking
    navigateToPage,
    getCurrentPage,
    getVisitedPages,
    getGameDuration,
    // Getters and setters
    getAgility,
    setAgility,
    getStrength,
    setStrength,
    getAttribute,
    setAttribute,
    getGold,
    setGold,
    getFood,
    setFood,
    // Debug functions
    resetToDebugState,
    getAvailableLuckPoints,
    setDebugStats,
    // Section effects
    applyChange,
    loseAll,
    statValue,
    refill,
    setFoes,
    getResolvedEffects,
    resolveEffect,
    learnSpell,
    knowsSpell,
    forgetSpell,
    hasCode,
    codesAtHand,
    addItem,
    hasItem,
    removeItem,
    isDead
  }
}
