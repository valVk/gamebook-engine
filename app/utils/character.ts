import { tryGetBook } from '#shared/engine/library'
import type { Book } from '#shared/engine/book'
import { createLuck } from '#shared/engine/luck'
import type { LuckState } from '#shared/engine/luck'

export type RollType = 'luck' | 'charisma' | 'combat'

/** How a section effect was resolved (see shared/engine/rules.ts) */
export interface EffectOutcome {
  /** Rolled total for dice effects, or the actual stat change applied */
  value?: number
  /** Result of a test, or whether a repeated action is finished */
  success?: boolean
  /** Individual dice of the last roll, for display */
  dice?: number[]
  /** Repeated actions (attrition): rounds played and total СИЛА lost */
  rounds?: number
  damage?: number
  /** Repeated actions (attrition, combat): finished */
  done?: boolean
  /** Combat: current СИЛА of each enemy */
  enemies?: number[]
  /** Combat, last round: attack totals, [player, ...enemies] (-1 when that side did not attack); npc mode: [first, second] */
  attacks?: number[]
  /** Combat, last round: the enemy the player struck at */
  target?: number
  /** Combat: the champion's ВЫНОСЛИВОСТЬ; whether the reader took its place, or joined its fight */
  champion?: number
  takenOver?: boolean
  helped?: boolean
  /** Combat, last round: fought by the ally rather than the reader */
  allyRound?: boolean
}

export interface PendingRoll {
  type: RollType
  result?: boolean
  /** The rolled die (or total), so the outcome can be shown again after a reload */
  value?: number
  /** Failed without a roll (section 213 penalty) */
  penalty?: boolean
  /** Score luck: the dice and УДАЧА after the check */
  dice?: number[]
  score?: number
  timestamp: number
}

/** Luck fields (`luck` squares or `luckScore`) are kept as the book's luck system says (shared/engine/luck.ts) */
export interface CharacterStats extends LuckState {
  agility: number // ЛОВКОСТЬ
  strength: number // СИЛА
  maxAgility: number // Initial max values
  maxStrength: number
  gold: number
  food: number // Portions of food; not duplicated in inventory
  inventory: string[] // Backpack items (sword is worn, not stored here)
  /** The book's own stats (ОБАЯНИЕ, Сила мысли, ЧЕСТЬ...), by attribute id (book.character.attributes) */
  attributes: Record<string, number>
  nextLuckCheckFails: boolean // Penalty from section 213: next luck check fails without a roll
  knownSpells: string[]
  currentPage: string
  visitedPages: string[]
  gameStartTime: number
  pendingRolls: Record<string, PendingRoll>
  /** ВЫНОСЛИВОСТЬ of fighters carried between sections, by `<persist key>:<name>` («минус потери от ран») */
  foes: Record<string, number>
  /** Effects resolved in the current section, by effect index. Cleared when leaving the section */
  resolvedEffects: Record<string, Record<number, EffectOutcome>>
}

/** Lowest and highest value an attribute may take (0 and unbounded unless the book says otherwise) */
export const attributeBounds = (book: Book, attribute: string) => {
  const definition = book.character.attributes[attribute]
  return { min: definition?.min ?? 0, max: definition?.max ?? Number.MAX_SAFE_INTEGER }
}

/** A section id is `preface` or a 1-3 digit number. */
export function isValidPageId(pageId: unknown): pageId is string {
  return typeof pageId === 'string' && (pageId === 'preface' || /^\d{1,3}$/.test(pageId))
}

/** Extract the target section from a link href such as `#n_89` (or a bare `001`). */
export function parseSectionHref(href: string | null | undefined): string | null {
  const match = href?.match(/^(?:#n_)?(\d{1,3})$/)
  if (!match?.[1]) return null
  return match[1].padStart(3, '0')
}

/**
 * Fresh default state for a book (an empty one when no book is open yet, e.g. on the shelf).
 * Always returns new arrays/objects so nothing is shared between games.
 */
export function createDefaultCharacter(book: Book | undefined = tryGetBook()): CharacterStats {
  if (!book) {
    return {
      agility: 0, strength: 0, maxAgility: 0, maxStrength: 0, ...createLuck().initial(),
      gold: 0, food: 0, inventory: [], attributes: {}, nextLuckCheckFails: false, knownSpells: [],
      currentPage: 'preface', visitedPages: [], gameStartTime: 0, pendingRolls: {}, resolvedEffects: {}, foes: {}
    }
  }
  const { character } = book
  return {
    agility: 0,
    strength: 0,
    maxAgility: 0,
    maxStrength: 0,
    ...book.luckSystem.initial(),
    gold: character.gold,
    food: character.food,
    inventory: [],
    attributes: Object.fromEntries(book.attributeIds.map(id => [id, character.attributes[id]?.start ?? 0])),
    nextLuckCheckFails: false,
    knownSpells: [],
    currentPage: 'preface',
    visitedPages: [],
    gameStartTime: 0,
    pendingRolls: {},
    resolvedEffects: {},
    foes: {}
  }
}

const toInt = (value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number => {
  const num = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback
  return Math.min(Math.max(num, min), max)
}

const isRollType = (value: unknown): value is RollType =>
  value === 'luck' || value === 'charisma' || value === 'combat'

/**
 * Validate data loaded from localStorage. Unknown or malformed fields fall back to defaults,
 * so a corrupted or hand-edited save cannot break the app. Returns null if the value is not an object.
 */
export function sanitizeStoredCharacter(raw: unknown, book: Book | undefined = tryGetBook()): CharacterStats | null {
  if (!book) return null
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const data = raw as Record<string, unknown>
  const defaults = createDefaultCharacter(book)

  const luck = book.luckSystem.sanitize(data, defaults)

  const inventory = Array.isArray(data.inventory)
    // Older saves duplicated food as a "Food (N days)" inventory entry
    ? data.inventory.filter((item): item is string => typeof item === 'string' && !/^Food \(/.test(item))
    : defaults.inventory

  const visitedPages = Array.isArray(data.visitedPages)
    ? data.visitedPages.filter(isValidPageId)
    : defaults.visitedPages

  const pendingRolls: Record<string, PendingRoll> = {}
  if (data.pendingRolls && typeof data.pendingRolls === 'object') {
    for (const [pageId, roll] of Object.entries(data.pendingRolls as Record<string, unknown>)) {
      if (!isValidPageId(pageId) || !roll || typeof roll !== 'object') continue
      const { type, result, timestamp, value, penalty, dice, score } = roll as Record<string, unknown>
      if (!isRollType(type)) continue
      pendingRolls[pageId] = {
        type,
        timestamp: toInt(timestamp, 0),
        ...(typeof result === 'boolean' ? { result } : {}),
        ...(typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 36 ? { value } : {}),
        ...(penalty === true ? { penalty } : {}),
        ...(Array.isArray(dice) && dice.length <= 6 && dice.every(d => Number.isInteger(d) && d >= 1 && d <= 20) ? { dice: [...dice] as number[] } : {}),
        ...(typeof score === 'number' && Number.isInteger(score) && score >= 0 ? { score } : {})
      }
    }
  }

  const resolvedEffects: Record<string, Record<number, EffectOutcome>> = {}
  if (data.resolvedEffects && typeof data.resolvedEffects === 'object') {
    for (const [pageId, effects] of Object.entries(data.resolvedEffects as Record<string, unknown>)) {
      if (!isValidPageId(pageId) || !effects || typeof effects !== 'object') continue
      const outcomes: Record<number, EffectOutcome> = {}
      for (const [index, outcome] of Object.entries(effects as Record<string, unknown>)) {
        if (!/^\d+$/.test(index) || !outcome || typeof outcome !== 'object') continue
        const { value, success, dice, rounds, damage, done, enemies, attacks, target, champion, takenOver, helped, allyRound } = outcome as Record<string, unknown>
        const isNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
        outcomes[Number(index)] = {
          ...(isNumber(value) ? { value } : {}),
          ...(typeof success === 'boolean' ? { success } : {}),
          ...(Array.isArray(dice) && dice.every(isNumber) ? { dice: [...dice] } : {}),
          ...(isNumber(rounds) ? { rounds } : {}),
          ...(isNumber(damage) ? { damage } : {}),
          ...(typeof done === 'boolean' ? { done } : {}),
          ...(Array.isArray(enemies) && enemies.every(isNumber) ? { enemies: [...enemies] } : {}),
          ...(Array.isArray(attacks) && attacks.every(isNumber) ? { attacks: [...attacks] } : {}),
          ...(isNumber(target) ? { target } : {}),
          ...(isNumber(champion) ? { champion } : {}),
          ...(takenOver === true ? { takenOver } : {}),
          ...(helped === true ? { helped } : {}),
          ...(allyRound === true ? { allyRound } : {})
        }
      }
      resolvedEffects[pageId] = outcomes
    }
  }

  const knownSpells = Array.isArray(data.knownSpells)
    ? data.knownSpells.filter((spell): spell is string => typeof spell === 'string')
    : defaults.knownSpells

  // Saves made before attributes were per book kept them at the top level (charisma, mentalPower)
  const storedAttributes = data.attributes && typeof data.attributes === 'object' && !Array.isArray(data.attributes)
    ? data.attributes as Record<string, unknown>
    : data
  // Before a character is made an attribute may still be 0, so only the upper bound applies here
  const attributes = Object.fromEntries(book.attributeIds.map(id =>
    [id, toInt(storedAttributes[id], defaults.attributes[id]!, 0, attributeBounds(book, id).max)]))

  const maxAgility = toInt(data.maxAgility, defaults.maxAgility)
  const maxStrength = toInt(data.maxStrength, defaults.maxStrength)

  return {
    agility: toInt(data.agility, defaults.agility, 0, maxAgility || Number.MAX_SAFE_INTEGER),
    strength: toInt(data.strength, defaults.strength, 0, maxStrength || Number.MAX_SAFE_INTEGER),
    maxAgility,
    maxStrength,
    ...luck,
    gold: toInt(data.gold, defaults.gold),
    food: toInt(data.food, defaults.food),
    inventory,
    attributes,
    nextLuckCheckFails: data.nextLuckCheckFails === true,
    knownSpells,
    currentPage: isValidPageId(data.currentPage) ? data.currentPage : defaults.currentPage,
    visitedPages,
    gameStartTime: toInt(data.gameStartTime, defaults.gameStartTime),
    pendingRolls,
    resolvedEffects,
    foes: data.foes && typeof data.foes === 'object' && !Array.isArray(data.foes)
      ? Object.fromEntries(Object.entries(data.foes as Record<string, unknown>)
        .filter((pair): pair is [string, number] => typeof pair[1] === 'number' && Number.isFinite(pair[1]))
        .map(([key, value]) => [key, Math.max(0, Math.trunc(value))]))
      : {}
  }
}
