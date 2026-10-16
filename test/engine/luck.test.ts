// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BookDefinition } from '#shared/engine/book'
import { createLuck } from '#shared/engine/luck'
import type { LuckState } from '#shared/engine/luck'
import { findBook, registerBook, setBook } from '#shared/engine/library'
import { useCharacter } from '~/composables/useCharacter'
import { sanitizeStoredCharacter } from '~/utils/character'

/** Luck systems: the strategies alone, then a score book played through useCharacter */
const dice = vi.hoisted(() => ({ queue: [] as number[] }))

vi.mock('@dice-roller/rpg-dice-roller', () => ({
  DiceRoll: class {
    total: number
    output = ''
    constructor() {
      const value = dice.queue.shift()
      if (value === undefined) throw new Error('No queued roll')
      this.total = value
    }
  }
}))

const dieFrom = (...values: number[]) => () => {
  const value = values.shift()
  if (value === undefined) throw new Error('No queued die')
  return value
}

describe('luck systems', () => {
  describe('squares', () => {
    const luck = createLuck()
    const state = (): LuckState => luck.initial()

    it('crosses out the squares the creation dice show', () => {
      const s = state()
      expect(luck.start(s, dieFrom(2, 5))).toEqual({ dice: [2, 5], crossed: [2, 5] })
      expect(s.luck).toEqual([true, false, true, true, false, true])
      expect(luck.available(s)).toBe(4)
    })

    it('is lucky on a free square and crosses it out', () => {
      const s = state()
      expect(luck.check(s, dieFrom(3))).toEqual({ lucky: true, dice: [3], total: 3 })
      expect(luck.check(s, dieFrom(3))).toMatchObject({ lucky: false })
    })

    it('ignores a change of УДАЧА as a number', () => {
      expect(luck.change(state(), 2)).toBe(0)
    })
  })

  describe('score', () => {
    const luck = createLuck({ system: 'score', start: '1d6+6' })
    const started = (score: number) => {
      const s = luck.initial()
      luck.start(s, dieFrom(score - 6))
      return s
    }

    it('rolls the starting score', () => {
      const s = luck.initial()
      expect(luck.start(s, dieFrom(4))).toEqual({ dice: [4], score: 10 })
      expect(s).toMatchObject({ luckScore: 10, maxLuckScore: 10 })
    })

    it('is lucky when two dice are not above УДАЧА, and every check costs 1', () => {
      const s = started(8)
      expect(luck.check(s, dieFrom(3, 5))).toEqual({ lucky: true, dice: [3, 5], total: 8, score: 7 })
      expect(luck.check(s, dieFrom(4, 4))).toEqual({ lucky: false, dice: [4, 4], total: 8, score: 6 })
    })

    it('always fails at 0', () => {
      const s = started(7)
      s.luckScore = 0
      expect(luck.canSucceed(s)).toBe(false)
      expect(luck.check(s, dieFrom(1, 1))).toMatchObject({ lucky: false, score: 0 })
    })

    it('changes up to the starting score', () => {
      const s = started(9)
      s.luckScore = 6
      expect(luck.change(s, 2)).toBe(2)
      expect(luck.change(s, 5)).toBe(1)
      expect(s.luckScore).toBe(9)
      expect(luck.change(s, -20)).toBe(-9)
    })

    it('keeps a sane score from a save', () => {
      expect(luck.sanitize({ luckScore: 50, maxLuckScore: 11 }, luck.initial())).toEqual({ luck: [], luckScore: 11, maxLuckScore: 11 })
      expect(luck.sanitize({ luckScore: 'x' }, luck.initial())).toEqual({ luck: [], luckScore: 0, maxLuckScore: 0 })
    })
  })
})

const demo = findBook('demo')!
registerBook({ ...demo, id: 'score-demo', luck: { system: 'score', start: '1d6+6' } } satisfies BookDefinition)

describe('a book with score luck', () => {
  beforeEach(() => {
    dice.queue.length = 0
    setBook('score-demo')
    useCharacter().endGameSession()
  })

  const traveller = () => {
    const api = useCharacter()
    dice.queue.push(3, 4) // the demo table: 2d6 = 7
    api.rollStats()
    dice.queue.push(3) // УДАЧА 1d6+6 = 9
    const start = api.startJourney()
    return { api, start }
  }

  it('rolls УДАЧА when the journey starts', () => {
    const { api, start } = traveller()
    expect(start).toEqual({ dice: [3], score: 9 })
    expect(api.character.value).toMatchObject({ luckScore: 9, maxLuckScore: 9, luck: [] })
  })

  it('checks with two dice and pays for each check', () => {
    const { api } = traveller()
    dice.queue.push(4, 5)
    expect(api.checkLuck('015')).toEqual({ lucky: true, roll: 9, penalty: false, dice: [4, 5], score: 8 })
    expect(api.getPendingRoll('015')).toMatchObject({ result: true, value: 9, dice: [4, 5], score: 8 })
    dice.queue.push(6, 6)
    expect(api.checkLuck().lucky).toBe(false)
    expect(api.getAvailableLuckPoints()).toBe(7)
  })

  it('a curse fails the check without dice and still costs 1', () => {
    const { api } = traveller()
    api.applyLuckPenalty()
    expect(api.checkLuck()).toEqual({ lucky: false, roll: null, penalty: true, dice: [], score: 8 })
  })

  it('changes УДАЧА through rules and conditions read it', () => {
    const { api } = traveller()
    dice.queue.push(1, 1)
    api.checkLuck()
    expect(api.applyChange('luck', 2)).toBe(1)
    expect(api.statValue('luck')).toBe(9)
  })

  it('restores УДАЧА by one', () => {
    const { api } = traveller()
    api.applyChange('luck', -3)
    expect(api.restoreLuck()).toEqual({ roll: null, wasAlreadyAvailable: false, score: 7 })
  })

  it('survives a save round trip', () => {
    const { api } = traveller()
    const saved = sanitizeStoredCharacter(JSON.parse(JSON.stringify(api.character.value)), findBook('score-demo'))
    expect(saved).toMatchObject({ luckScore: 9, maxLuckScore: 9 })
  })
})
