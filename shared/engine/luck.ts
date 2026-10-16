/**
 * Luck systems. Books of the same family keep УДАЧА differently, so the engine asks the book's
 * luck system (a strategy, made by `createLuck` from the manifest) instead of knowing the rules:
 *
 * - `squares` («Повелитель Безбрежной Пустыни»): six squares numbered 1-6; two are crossed out at
 *   creation. A check throws one die: a free square is luck (and is crossed out), a crossed one is not.
 * - `score` («Тайна капитана Шелтона»): УДАЧА is a number (1d6+6 at creation). A check throws two
 *   dice: not more than УДАЧА is luck. Every check costs 1 УДАЧИ; at 0 a check always fails.
 *
 * Both keep their state in the same fields of the character, so saves need no per-system shape.
 */

import { parseFormula } from './dice'
import type { DiceFormula } from './dice'

/** The luck a character carries. `luck` is used by `squares`, `luckScore`/`maxLuckScore` by `score` */
export interface LuckState {
  /** Squares 1..N, true = still free */
  luck: boolean[]
  luckScore: number
  /** The score at creation: changes may not exceed it */
  maxLuckScore: number
}

/** Throws one die with `sides` sides (6 by default) */
export type DieRoller = (sides?: number) => number

export type LuckDefinition =
  | { system: 'squares'; squares?: number; crossedAtStart?: number }
  /** `start`: the creation formula; a check throws `checkDice` d6 (2) and costs `checkCost` (1) */
  | {
    system: 'score'
    start: DiceFormula
    checkDice?: number
    checkCost?: number
    /** While this code is at hand an even throw is lucky and costs nothing («заклятие Удачи») */
    evenLucky?: string
  }

/** What the reader has at hand that bends a check (codes known) */
export interface LuckContext {
  hasCode: (spell: string) => boolean
}

/** What the creation throw gave: the dice and what they did */
export interface LuckStart {
  dice: number[]
  /** `squares`: the squares crossed out; `score`: the starting УДАЧА */
  crossed?: number[]
  score?: number
}

export interface LuckThrow {
  lucky: boolean
  dice: number[]
  /** The sum of the dice */
  total: number
  /** `score`: УДАЧА after the check (it costs one) */
  score?: number
}

export interface LuckRestore {
  /** The die thrown to pick the square (`squares`), none for `score` */
  dice: number[]
  changed: boolean
  /** The square cleared, or the score after the restoration */
  value: number
}

export interface LuckSystem {
  readonly kind: LuckDefinition['system']
  readonly definition: LuckDefinition
  /** Luck before a character is made */
  initial: () => LuckState
  /** Character creation: throws and records the starting luck */
  start: (state: LuckState, die: DieRoller) => LuckStart
  /** Whether a check can still succeed (a free square, a score above 0) */
  canSucceed: (state: LuckState) => boolean
  /** Free squares or the score: what the sheet and summaries show as a number */
  available: (state: LuckState) => number
  /** A check: throws, decides and pays for it */
  check: (state: LuckState, die: DieRoller, context?: LuckContext) => LuckThrow
  /** A check that fails without a throw (a curse): `score` still pays for it */
  forfeit: (state: LuckState) => LuckThrow
  /** "Восстановите УДАЧУ": `squares` clears the square a die picks, `score` gains 1 up to the start */
  restore: (state: LuckState, die: DieRoller) => LuckRestore
  /** A rule's `change` of УДАЧА by `amount`; returns what was applied (0 for `squares`) */
  change: (state: LuckState, amount: number, aboveStart?: boolean) => number
  /** Back to the start, `plus` above it (raising the start); returns what was applied */
  refill: (state: LuckState, plus?: number) => number
  /** Saved luck checked against this system; anything malformed falls back to `fallback` */
  sanitize: (raw: Record<string, unknown>, fallback: LuckState) => Pick<LuckState, 'luck' | 'luckScore' | 'maxLuckScore'>
}

const throwDice = (die: DieRoller, count: number) => Array.from({ length: count }, () => die())
const sum = (dice: number[]) => dice.reduce((a, b) => a + b, 0)
const toInt = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), min), max) : fallback

const squaresLuck = (definition: Extract<LuckDefinition, { system: 'squares' }>): LuckSystem => {
  const count = definition.squares ?? 6
  const crossedAtStart = definition.crossedAtStart ?? 2
  const fresh = () => Array.from({ length: count }, () => true)
  return {
    kind: 'squares',
    definition,
    initial: () => ({ luck: fresh(), luckScore: 0, maxLuckScore: 0 }),
    start: (state, die) => {
      const dice = throwDice(() => die(count), crossedAtStart)
      state.luck = fresh()
      for (const value of dice) state.luck[value - 1] = false
      return { dice, crossed: [...new Set(dice)] }
    },
    canSucceed: state => state.luck.some(Boolean),
    available: state => state.luck.filter(Boolean).length,
    check: (state, die) => {
      const value = die(count)
      const lucky = state.luck[value - 1] === true
      if (lucky) state.luck[value - 1] = false
      return { lucky, dice: [value], total: value }
    },
    forfeit: () => ({ lucky: false, dice: [], total: 0 }),
    restore: (state, die) => {
      const value = die(count)
      const changed = state.luck[value - 1] !== true
      state.luck[value - 1] = true
      return { dice: [value], changed, value }
    },
    change: () => 0,
    refill: (state) => {
      const crossed = state.luck.filter(free => !free).length
      state.luck = fresh()
      return crossed
    },
    sanitize: (raw, fallback) => ({
      luck: Array.isArray(raw.luck) && raw.luck.length === count && raw.luck.every(v => typeof v === 'boolean')
        ? [...raw.luck] as boolean[]
        : fallback.luck,
      luckScore: 0,
      maxLuckScore: 0
    })
  }
}

const scoreLuck = (definition: Extract<LuckDefinition, { system: 'score' }>): LuckSystem => {
  const checkDice = definition.checkDice ?? 2
  const checkCost = definition.checkCost ?? 1
  const start = parseFormula(definition.start)
  const pay = (state: LuckState) => {
    state.luckScore = Math.max(0, state.luckScore - checkCost)
    return state.luckScore
  }
  return {
    kind: 'score',
    definition,
    initial: () => ({ luck: [], luckScore: 0, maxLuckScore: 0 }),
    start: (state, die) => {
      const dice = throwDice(() => die(start.sides), start.count)
      const score = sum(dice) + start.modifier
      state.luckScore = score
      state.maxLuckScore = score
      return { dice, score }
    },
    canSucceed: state => state.luckScore > 0,
    available: state => state.luckScore,
    check: (state, die, context) => {
      const dice = throwDice(die, checkDice)
      const total = sum(dice)
      // «Каждый раз, когда ... выпадет четное число, считайте, что вы удачливы ... не надо уменьшать»
      if (definition.evenLucky && context?.hasCode(definition.evenLucky) && total % 2 === 0) {
        return { lucky: true, dice, total, score: state.luckScore }
      }
      const lucky = state.luckScore > 0 && total <= state.luckScore
      return { lucky, dice, total, score: pay(state) }
    },
    forfeit: state => ({ lucky: false, dice: [], total: 0, score: pay(state) }),
    restore: (state) => {
      const before = state.luckScore
      state.luckScore = Math.min(before + 1, Math.max(state.maxLuckScore, before))
      return { dice: [], changed: state.luckScore !== before, value: state.luckScore }
    },
    change: (state, amount, aboveStart) => {
      const before = state.luckScore
      const cap = aboveStart ? Number.MAX_SAFE_INTEGER : Math.max(state.maxLuckScore, before)
      state.luckScore = Math.max(0, Math.min(before + amount, cap))
      if (state.luckScore > state.maxLuckScore) state.maxLuckScore = state.luckScore
      return state.luckScore - before
    },
    refill: (state, plus = 0) => {
      const before = state.luckScore
      state.maxLuckScore += plus
      state.luckScore = state.maxLuckScore
      return state.luckScore - before
    },
    sanitize: (raw, fallback) => {
      const maxLuckScore = toInt(raw.maxLuckScore, fallback.maxLuckScore, 0, 99)
      return { luck: [], luckScore: toInt(raw.luckScore, fallback.luckScore, 0, maxLuckScore || 99), maxLuckScore }
    }
  }
}

/** The luck system a book declares (squares when it says nothing) */
export const createLuck = (definition: LuckDefinition = { system: 'squares' }): LuckSystem => {
  switch (definition.system) {
    case 'squares': return squaresLuck(definition)
    case 'score': return scoreLuck(definition)
  }
}
