// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setBook } from '#shared/engine/library'
import { reloadCharacter, saveKey, useCharacter } from '~/composables/useCharacter'

// The registry holds every installed book; these tests read «Повелитель»
setBook('povelitel')

// Deterministic dice: each DiceRoll takes the next queued value as its total
const dice = vi.hoisted(() => ({ queue: [] as number[] }))

vi.mock('@dice-roller/rpg-dice-roller', () => ({
  DiceRoll: class {
    total: number
    output: string
    constructor(notation: string) {
      const value = dice.queue.shift()
      if (value === undefined) throw new Error(`No queued roll for ${notation}`)
      this.total = value
      this.output = `${notation}: ${value}`
    }
  }
}))

const queueRolls = (...values: number[]) => {
  dice.queue.push(...values)
}

describe('useCharacter', () => {
  beforeEach(() => {
    dice.queue.length = 0
    useCharacter().endGameSession()
  })

  const createCharacter = (stats: [number, number] = [3, 4], luck: [number, number] = [2, 5]) => {
    const api = useCharacter()
    queueRolls(...stats)
    api.rollStats()
    queueRolls(...luck)
    api.startJourney()
    return api
  }

  describe('creation', () => {
    it('looks up stats from the 2d6 sum', () => {
      const api = useCharacter()
      queueRolls(3, 4)
      const result = api.rollStats()

      expect(result).toMatchObject({ sum: 7, dice: [3, 4] })
      expect(api.character.value).toMatchObject({
        agility: 9, strength: 20, attributes: { charisma: 7, mentalPower: 3 }, maxAgility: 9, maxStrength: 20
      })
    })

    it('crosses out the two rolled luck squares when the journey starts', () => {
      const api = createCharacter([6, 6], [2, 5])

      expect(api.character.value.luck).toEqual([true, false, true, true, false, true])
      expect(api.isCharacterCreated.value).toBe(true)
      expect(api.character.value.currentPage).toBe('001')
    })

    it('refuses to start without stats', () => {
      expect(() => useCharacter().startJourney()).toThrow()
    })
  })

  describe('luck', () => {
    it('is lucky on an available square and crosses it out', () => {
      const api = createCharacter()
      queueRolls(1)

      expect(api.checkLuck()).toEqual({ lucky: true, roll: 1, penalty: false })
      expect(api.character.value.luck[0]).toBe(false)
    })

    it('is unlucky on a crossed out square', () => {
      const api = createCharacter([3, 4], [2, 5])
      queueRolls(2)

      expect(api.checkLuck()).toEqual({ lucky: false, roll: 2, penalty: false })
    })

    it('records the result for the section', () => {
      const api = createCharacter()
      queueRolls(1)
      api.checkLuck('165')

      expect(api.getPendingRoll('165')).toMatchObject({ type: 'luck', result: true })
    })

    it('fails the next check without rolling after the section 213 penalty', () => {
      const api = createCharacter()
      api.applyLuckPenalty()
      const luckBefore = [...api.character.value.luck]

      expect(api.checkLuck()).toEqual({ lucky: false, roll: null, penalty: true })
      expect(api.character.value.luck).toEqual(luckBefore)
      expect(api.character.value.nextLuckCheckFails).toBe(false)

      // Only the first check is affected
      queueRolls(1)
      expect(api.checkLuck().lucky).toBe(true)
    })

    it('restores a rolled luck square', () => {
      const api = createCharacter([3, 4], [2, 5])
      queueRolls(5)

      expect(api.restoreLuck()).toEqual({ roll: 5, wasAlreadyAvailable: false })
      expect(api.character.value.luck[4]).toBe(true)
    })
  })

  describe('charisma', () => {
    it('rises by 1 on success (2d6 <= charisma)', () => {
      const api = createCharacter() // charisma 7
      queueRolls(3, 4)

      expect(api.testCharisma().success).toBe(true)
      expect(api.character.value.attributes.charisma).toBe(8)
    })

    it('drops by 1 on failure', () => {
      const api = createCharacter()
      queueRolls(4, 4)

      expect(api.testCharisma().success).toBe(false)
      expect(api.character.value.attributes.charisma).toBe(6)
    })

    it('always succeeds at 12 and stays capped', () => {
      const api = createCharacter()
      api.setAttribute('charisma', 12)
      queueRolls(6, 6)

      expect(api.testCharisma().success).toBe(true)
      expect(api.character.value.attributes.charisma).toBe(12)
    })

    it('always fails at 1 and never drops below 1', () => {
      const api = createCharacter()
      api.setAttribute('charisma', 1)
      queueRolls(1, 1)

      expect(api.testCharisma().success).toBe(false)
      expect(api.character.value.attributes.charisma).toBe(1)
    })
  })

  describe('food', () => {
    it('restores 4 strength, capped at the initial maximum', () => {
      const api = createCharacter() // strength 20/20
      api.setStrength(14)

      expect(api.useFood()).toBe(true)
      expect(api.character.value.strength).toBe(18)
      expect(api.character.value.food).toBe(2)

      api.useFood()
      expect(api.character.value.strength).toBe(20)
    })

    it('does nothing without food', () => {
      const api = createCharacter()
      api.setFood(0)

      expect(api.useFood()).toBe(false)
    })
  })

  describe('session', () => {
    it('drops roll results of other sections on navigation', () => {
      const api = createCharacter()
      queueRolls(1)
      api.checkLuck('165')
      api.navigateToPage('073')

      expect(api.getPendingRoll('165')).toBeUndefined()
      expect(api.character.value.visitedPages).toEqual(['001', '073'])
    })

    it('starts the next game from clean defaults', () => {
      const api = createCharacter()
      api.navigateToPage('089')
      api.endGameSession()

      expect(api.character.value.visitedPages).toEqual([])
      expect(api.character.value.luck).toEqual([true, true, true, true, true, true])
      expect(localStorage.getItem(saveKey('povelitel'))).toBeNull()
    })

    it('persists to localStorage', () => {
      createCharacter()
      const stored = JSON.parse(localStorage.getItem(saveKey('povelitel')) ?? '{}')

      expect(stored).toMatchObject({ agility: 9, currentPage: '001', inventory: [] })
    })

    it('moves a save from before the library to the book\'s own key', () => {
      createCharacter()
      const old = localStorage.getItem(saveKey('povelitel'))!
      localStorage.removeItem(saveKey('povelitel'))
      localStorage.setItem('rpg-character', old)
      reloadCharacter()

      expect(useCharacter().character.value.agility).toBe(9)
      expect(localStorage.getItem('rpg-character')).toBeNull()
      expect(localStorage.getItem(saveKey('povelitel'))).toBe(old)
    })

    it('debug reset starts from a real section', () => {
      const api = useCharacter()
      queueRolls(3, 4, 2, 5)
      api.resetToDebugState()

      expect(api.character.value.currentPage).toBe('001')
    })
  })
})
