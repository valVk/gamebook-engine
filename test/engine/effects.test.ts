// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { findBook, setBook } from '#shared/engine/library'
import { useCharacter } from '~/composables/useCharacter'
import { useSectionEffects } from '~/composables/useSectionEffects'
import { arrivalCard } from '~/utils/outcomes'

/**
 * The engine on the demo book (examples/books/demo): every rule kind, with stats and items that are
 * not «Повелитель»'s (ЧЕСТЬ is the tested attribute, Сила мысли is called `mind`).
 */
setBook('demo')
const demo = findBook('demo')!

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

const queue = (...values: number[]) => dice.queue.push(...values)

/** A traveller from the demo table (2d6 = 7: ЛОВКОСТЬ 10, СИЛА 18, ЧЕСТЬ 6), arriving at `page` */
const setup = (page: string) => {
  const api = useCharacter()
  queue(3, 4, 2, 5)
  api.rollStats()
  api.startJourney()
  const current = ref(page)
  const effects = useSectionEffects(current)
  const go = (next: string) => {
    api.navigateToPage(next)
    current.value = next
    effects.applyArrival()
  }
  go(page)
  return { api, effects, go, character: api.character }
}

const indexOf = (effects: ReturnType<typeof setup>['effects'], test: (kind: string, item?: string) => boolean) =>
  effects.entries.value.findIndex(({ effect }) => test(effect.kind, 'item' in effect ? effect.item : undefined))

describe('engine on the demo book', () => {
  beforeEach(() => {
    dice.queue.length = 0
    useCharacter().endGameSession()
  })

  describe('character', () => {
    it('is made from the book\'s table and starting kit', () => {
      const { character } = setup('015')
      expect(character.value).toMatchObject({
        agility: 10, strength: 18, maxStrength: 18, gold: 10, food: 2,
        attributes: { honor: 6, mind: 3 }
      })
    })

    it('eats for the book\'s amount of СИЛА', () => {
      const { api, character } = setup('015')
      api.applyChange('strength', -5)
      api.useFood()
      expect(character.value.strength).toBe(16)
    })
  })

  describe('automatic effects', () => {
    it('001: gold found, a makeshift weapon costs 1 ЛОВКОСТЬ', () => {
      const { character } = setup('001')
      expect(character.value).toMatchObject({ gold: 15, agility: 9, inventory: ['Крепкая палка'] })
    })

    it('the makeshift weapon cannot be dropped and leaves when a real one is taken (011)', () => {
      const { effects, go, character } = setup('001')
      expect(demo.item('stick')?.kept).toBe(true)
      go('011')
      effects.pickup(indexOf(effects, kind => kind === 'pickup'))
      expect(character.value.inventory).toEqual(['Копье'])
      expect(character.value.agility).toBe(10)
    })

    it('002: a meal eats food, or costs СИЛА without it', () => {
      const { api, go, character } = setup('002')
      expect(character.value).toMatchObject({ food: 1, inventory: ['Фонарь'] })
      api.applyChange('food', -1)
      go('015') // leave, then come back: arriving again at the same section is a reload
      go('002')
      expect(character.value.strength).toBe(16)
    })
  })

  describe('required actions', () => {
    it('003: a roll locks the way on but not the way back', () => {
      const { effects, character } = setup('003')
      expect(effects.linkState('004').status).toBe('locked')
      expect(effects.linkState('002').status).toBe('open')
      queue(4)
      effects.roll(0)
      expect(character.value.strength).toBe(14)
      expect(effects.linkState('004').status).toBe('open')
    })

    it('004: a sword fight is won round by round; a spear wounds for 3', () => {
      const { effects, go } = setup('004')
      queue(6, 1) // 12 + 10 vs 2 + 7
      effects.combatRound(0)
      expect(effects.entries.value[0]?.outcome?.enemies).toEqual([4])

      go('011')
      effects.pickup(indexOf(effects, kind => kind === 'pickup'))
      go('004')
      queue(6, 1)
      effects.combatRound(0)
      expect(effects.entries.value[0]?.outcome?.enemies).toEqual([3])
    })

    it('006: the tested attribute is the book\'s own (ЧЕСТЬ)', () => {
      const { effects, character } = setup('006')
      queue(3, 3)
      effects.testCharisma(0)
      expect(character.value.attributes.honor).toBe(7)
      expect(effects.linkState('008').status).toBe('testSuccess')
      expect(effects.linkState('009').status).toBe('testDimmed')
    })

    it('007: a curse on the next luck check, and an agility test', () => {
      const { effects, character } = setup('007')
      expect(character.value.nextLuckCheckFails).toBe(true)
      queue(4, 5)
      effects.testAgility(1)
      expect(effects.linkState('008').status).toBe('testSuccess')
    })

    it('009: robbed of all gold, then an even/odd roll', () => {
      const { effects, character } = setup('009')
      expect(character.value.gold).toBe(0)
      queue(2, 4)
      effects.parityRoll(1)
      expect(character.value.strength).toBe(12)
      expect(effects.linkState('011').status).toBe('testSuccess')
    })

    it('010: a duel re-rolls ties', () => {
      const { effects } = setup('010')
      queue(3, 3)
      expect(effects.duel(0)?.tie).toBe(true)
      queue(5, 2)
      effects.duel(0)
      expect(effects.linkState('011').status).toBe('testSuccess')
    })

    it('011: rounds against a swarm until enough are driven off', () => {
      const { effects, character } = setup('011')
      const swarm = indexOf(effects, kind => kind === 'attrition')
      queue(3, 2)
      effects.attritionRound(swarm)
      expect(effects.linkState('013').status).toBe('locked')
      queue(1, 1)
      effects.attritionRound(swarm)
      expect(character.value.strength).toBe(15)
      expect(effects.linkState('013').status).toBe('open')
    })

    it('013: a fight of minds uses the book\'s mind attribute and raises it when won', () => {
      const { effects, character } = setup('013')
      expect(character.value.knownSpells).toEqual(['light'])
      const fight = indexOf(effects, kind => kind === 'combat')
      for (let round = 0; round < 3; round++) {
        queue(6, 1) // 12 + 3 vs 2 + 3
        effects.combatRound(fight)
      }
      expect(character.value.attributes.mind).toBe(4)
      expect(effects.linkState('014').status).toBe('open')
    })
  })

  describe('the shop (005)', () => {
    it('sells, takes back, and only offers back what you hold', () => {
      const { effects, character } = setup('005')
      const amulet = indexOf(effects, (kind, item) => kind === 'purchase' && item === 'amulet')
      const back = indexOf(effects, kind => kind === 'refund')
      expect(effects.canRefund(back)).toBe(false)
      effects.purchase(amulet)
      expect(character.value.gold).toBe(8)
      effects.refund(back)
      expect(character.value).toMatchObject({ gold: 10, inventory: [] })
    })

    it('a shield: −1 ЛОВКОСТЬ while carried, enemy attack −1, 1 СИЛА a day', () => {
      const { effects, go, character } = setup('005')
      effects.purchase(indexOf(effects, (kind, item) => kind === 'purchase' && item === 'shield'))
      expect(character.value.agility).toBe(9)
      go('002')
      expect(character.value.strength).toBe(17)
    })

    it('prices are not links, the garden costs 2, the game needs 2, the inscription is a reference page', () => {
      const { effects, api, character } = setup('005')
      expect(effects.linkState('003').status).toBe('plain')
      expect(effects.linkState('015').status).toBe('peek')
      expect(effects.followLink('006')).toBe(true)
      expect(character.value.gold).toBe(8)
      api.applyChange('gold', -7)
      expect(effects.linkState('010').status).toBe('unaffordable')
    })
  })

  describe('conditions and optional actions', () => {
    it('008: links by item and by stat', () => {
      const { effects, api } = setup('008')
      expect(effects.linkState('011').status).toBe('unavailable')
      expect(effects.linkState('012').status).toBe('open')
      expect(effects.linkState('013').status).toBe('unavailable')
      api.addItem('Моток веревки')
      api.applyChange('mind', 1)
      expect(effects.linkState('011').status).toBe('open')
      expect(effects.linkState('012').status).toBe('unavailable')
      expect(effects.linkState('013').status).toBe('open')
    })

    it('014: take the key to open the door, give food away, cast a known spell', () => {
      const { effects, character, go } = setup('013')
      go('014')
      expect(effects.linkState('018').status).toBe('unavailable')
      effects.pickup(indexOf(effects, kind => kind === 'pickup'))
      expect(effects.linkState('018').status).toBe('open')
      effects.applyOptional(indexOf(effects, kind => kind === 'optional'))
      expect(character.value.food).toBe(1)
      expect(effects.castSpell(indexOf(effects, kind => kind === 'castSpell'))).toBe('017')
    })
  })

  describe('the book', () => {
    it('knows its endings, reference pages and misprints', () => {
      expect(['016', '017', '018', '001'].map(demo.endingKind)).toEqual(['death', 'victory', 'captured', 'death'])
      expect(demo.isPeek('015')).toBe(true)
      expect(demo.correctMisprints('012', '[**91**](#n_91)')).toBe('[**13**](#n_13)')
    })

    it('names its stats on cards and in conditions', () => {
      expect(demo.statLabel('honor').name).toBe('ЧЕСТЬ')
      expect(demo.testedAttribute).toBe('honor')
      const card = arrivalCard([{ index: 0, effect: { kind: 'change', stat: 'mind', amount: 1, source: '' }, outcome: { value: 1 }, resolved: true, automatic: true }])
      expect(card).toMatchObject({ title: 'Сила мысли растет', lines: ['+1 к Силе мысли'] })
    })
  })
})

describe('saves', () => {
  it('a save under the engine\'s earlier key name is moved to the current one', async () => {
    const { reloadCharacter, saveKey } = await import('~/composables/useCharacter')
    localStorage.clear()
    localStorage.setItem('desert-lord:demo', JSON.stringify({ agility: 11, strength: 15, maxAgility: 11, maxStrength: 15, gameStartTime: 1, currentPage: '004' }))
    reloadCharacter()

    expect(useCharacter().character.value).toMatchObject({ agility: 11, currentPage: '004' })
    expect(localStorage.getItem('desert-lord:demo')).toBeNull()
    expect(localStorage.getItem(saveKey('demo'))).not.toBeNull()
  })
})
