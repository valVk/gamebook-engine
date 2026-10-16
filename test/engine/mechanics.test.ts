// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { BookDefinition } from '#shared/engine/book'
import { findBook, registerBook, setBook } from '#shared/engine/library'
import { useCharacter } from '~/composables/useCharacter'
import { useSectionEffects } from '~/composables/useSectionEffects'

/**
 * Mechanics of the «Шелтон» family on the demo book: attacks of two dice, dice branches, a strict
 * test, refilling УДАЧА, gains above the start, a weapon's fight bonus, a harpoon, the luck spell.
 */
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

const demo = findBook('demo')!

registerBook({
  ...demo,
  id: 'mechanics-demo',
  combat: { attack: 'sum' },
  luck: { system: 'score', start: '1d6+6', evenLucky: 'luckSpell' },
  items: {
    ...demo.items,
    sword: { name: 'Рыба-меч', fightSkill: 1 },
    harpoon: { name: 'Гарпун', strike: 12 }
  },
  spells: { ...demo.spells, luckSpell: { name: 'Заклятие Удачи' } },
  rules: {
    ...demo.rules,
    '006': { effects: [{ kind: 'rollBranch', dice: 1, branches: [{ upTo: 3, link: '007' }, { upTo: 6, link: '008' }], source: '' }] },
    '007': { effects: [{ kind: 'agilityTest', dice: 2, strict: true, successLinks: ['008'], failureLinks: ['009'], source: '' }] },
    '008': { effects: [{ kind: 'refill', stat: 'luck', plus: 1, source: '' }, { kind: 'change', stat: 'agility', amount: 1, aboveStart: true, source: '' }] }
  }
} satisfies BookDefinition)

/** A traveller of 2d6 = 7 on the demo table (ЛОВКОСТЬ 10, СИЛА 18) with УДАЧА 1d6+6 = 9 */
const setup = (page: string) => {
  const api = useCharacter()
  dice.queue.push(3, 4, 3)
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
  return { api, effects, go }
}

describe('«Шелтон» mechanics', () => {
  beforeEach(() => {
    dice.queue.length = 0
    setBook('mechanics-demo')
    useCharacter().endGameSession()
  })

  it('attacks with two dice summed', () => {
    const { effects } = setup('004')
    // You 5 + 4 + 10 = 19, the wolf 1 + 1 + 7 = 9
    dice.queue.push(5, 4, 1, 1)
    expect(effects.combatRound(0)).toMatchObject({ dice: [5, 4, 1, 1], enemies: [4] })
  })

  it('adds a weapon\'s fight bonus, and throws a harpoon once', () => {
    const { api, effects } = setup('004')
    api.addItem('Рыба-меч')
    api.addItem('Гарпун')
    // You 3 + 3 + 10 + 1 = 17 against 4 + 5 + 7 = 16: the bonus wins the round
    dice.queue.push(3, 3, 4, 5)
    expect(effects.combatRound(0)).toMatchObject({ enemies: [4], damage: 0 })
    expect(effects.strikes.value).toEqual(['Гарпун'])
    expect(effects.strike(0, 'Гарпун')).toEqual({ enemies: [0], won: true })
    expect(api.hasItem('Гарпун')).toBe(false)
  })

  it('lets dice pick a branch', () => {
    const { effects } = setup('006')
    dice.queue.push(5)
    expect(effects.rollBranch(0)).toMatchObject({ total: 5, link: '008' })
    expect(effects.linkState('008').status).toBe('testSuccess')
    expect(effects.linkState('007').status).toBe('testDimmed')
  })

  it('a strict test needs less than the stat', () => {
    const { effects } = setup('007')
    dice.queue.push(5, 5)
    expect(effects.testAgility(0)).toMatchObject({ total: 10, success: false })
  })

  it('refills УДАЧА one above the start, and raises a stat above its start', () => {
    const { api, go } = setup('002')
    api.applyChange('luck', -4)
    go('008')
    expect(api.character.value).toMatchObject({ luckScore: 10, maxLuckScore: 10, agility: 11, maxAgility: 11 })
  })

  it('the luck spell makes an even throw lucky and free', () => {
    const { api } = setup('001')
    api.learnSpell('luckSpell')
    dice.queue.push(6, 6)
    expect(api.checkLuck()).toMatchObject({ lucky: true, roll: 12, score: 9 })
    dice.queue.push(6, 5)
    expect(api.checkLuck()).toMatchObject({ lucky: false, score: 8 })
  })
})

describe('retries and visits', () => {
  beforeEach(() => {
    dice.queue.length = 0
    useCharacter().endGameSession()
  })

  it('pays for every try until the dice show a hit', () => {
    registerBook({
      ...findBook('mechanics-demo')!,
      id: 'retry-demo',
      rules: {
        ...findBook('mechanics-demo')!.rules,
        '006': { effects: [{ kind: 'retryRoll', dice: 2, hits: [2, 12], cost: { stat: 'strength', amount: 1 }, successLinks: ['008'], failureLinks: [], source: '' }] },
        '009': { conditions: [{ link: '010', section: '006', visited: true, source: '' }] }
      }
    } satisfies BookDefinition)
    setBook('retry-demo')
    const { api, effects, go } = setup('006')
    expect(effects.linkState('008').status).toBe('locked')
    expect(effects.linkState('007').status).toBe('open')
    dice.queue.push(3, 4)
    expect(effects.retryRoll(0)).toMatchObject({ hit: false })
    dice.queue.push(6, 6)
    expect(effects.retryRoll(0)).toMatchObject({ hit: true })
    expect(api.character.value.strength).toBe(16)
    expect(effects.linkState('008').status).toBe('testSuccess')
    go('009')
    expect(effects.linkState('010').status).toBe('open')
  })
})

describe('team fights', () => {
  const pirate = (n: number, skill = 10) => ({ name: `ПИРАТ ${n}`, skill, strength: 8 })
  registerBook({
    ...findBook('mechanics-demo')!,
    id: 'team-demo',
    rules: {
      ...findBook('mechanics-demo')!.rules,
      // Two pairs: the Rhino against pirate 1, the reader against pirates 2 and 3
      '006': {
        effects: [
          { kind: 'combat', type: 'sword', enemies: [pirate(1)], champion: { name: 'НОСОРОГ', skill: 10, strength: 8 }, persist: 'pirates', source: '' },
          { kind: 'combat', type: 'sword', enemies: [pirate(2), pirate(3)], mode: 'simultaneous', persist: 'pirates', escapeLinks: ['008', '009'], source: '' }
        ],
        conditions: [
          { link: '008', fights: [{ fight: 0, won: true }, { fight: 1, foesLeft: 2 }], source: '' },
          { link: '009', fights: [{ fight: 0, won: true }, { fight: 1, foesLeft: 1 }], source: '' }
        ]
      },
      // The fight goes on elsewhere, wounds carried; pirate 1 is already dead
      '008': { effects: [{ kind: 'combat', type: 'sword', enemies: [pirate(1)], persist: 'pirates', source: '' }] },
      '010': { effects: [{ kind: 'combat', type: 'sword', enemies: [pirate(4)], champion: { name: 'ЛЕВ', skill: 1, strength: 2 }, takeOver: true, source: '' }] },
      '011': {
        effects: [
          { kind: 'combat', type: 'sword', enemies: [pirate(5)], champion: { name: 'ЛЕВ', skill: 10, strength: 8 }, source: '' },
          { kind: 'combat', type: 'sword', enemies: [{ name: 'ПИРАТ 6', skill: 1, strength: 2 }], source: '' }
        ]
      }
    }
  } satisfies BookDefinition)

  beforeEach(() => {
    dice.queue.length = 0
    setBook('team-demo')
    useCharacter().endGameSession()
  })

  it('an ally fights its pair; the way on depends on how the fights stand', () => {
    const { effects, api } = setup('006')
    expect(effects.linkState('008').status).toBe('unavailable')
    // The Rhino 6+6+10 = 22 against 1+1+10 = 12, four times: pirate 1 is down
    for (let round = 0; round < 4; round++) {
      dice.queue.push(6, 6, 1, 1)
      effects.combatRound(0)
    }
    expect(effects.fightState(0)).toMatchObject({ enemies: [0], champion: 8 })
    expect(api.character.value.strength).toBe(18)
    expect(effects.linkState('008').status).toBe('open')
    expect(effects.linkState('009').status).toBe('unavailable')
    expect(api.character.value.foes).toMatchObject({ 'pirates:ПИРАТ 1': 0, 'pirates:НОСОРОГ': 8 })
  })

  it('a battle whose enemies fell earlier is already won', () => {
    const { api, go } = setup('001')
    api.setFoes({ 'pirates:ПИРАТ 1': 0 })
    go('008')
    expect(useSectionEffects(() => '008').entries.value[0]).toMatchObject({ resolved: true, outcome: { success: true } })
  })

  it('the reader takes the place of an ally who falls', () => {
    const { effects } = setup('010')
    // The Lion 1+1+1 = 3 against 6+6+10 = 22: it falls (2 → 0), the reader fights on
    dice.queue.push(1, 1, 6, 6)
    expect(effects.combatRound(0)).toMatchObject({ takenOver: true, done: false })
    dice.queue.push(6, 6, 1, 1)
    expect(effects.combatRound(0)).toMatchObject({ enemies: [6] })
  })

  it('having won its own pair, the reader may help the ally', () => {
    const { effects } = setup('011')
    expect(effects.canHelp(0)).toBe(false)
    dice.queue.push(6, 6, 1, 1)
    expect(effects.combatRound(1)).toMatchObject({ won: true })
    expect(effects.canHelp(0)).toBe(true)
    effects.help(0)
    // The Lion 1+1+10 = 12 against the pirate's 5+5+10 = 20: the Lion is wounded;
    // the reader, helping, 6+6+10 = 22 out-hits the pirate and wounds it
    dice.queue.push(1, 1, 5, 5, 6, 6)
    expect(effects.combatRound(0)).toMatchObject({ enemies: [6], champion: 6 })
  })
})

describe('a fight that ends when the reader is worn down', () => {
  it('opens its lose links once the reader is down to yieldAt', () => {
    registerBook({
      ...findBook('mechanics-demo')!,
      id: 'yield-demo',
      rules: { ...findBook('mechanics-demo')!.rules, '006': { effects: [{ kind: 'combat', type: 'sword', enemies: [{ name: 'КРАБ', skill: 30, strength: 14 }], yieldAt: 16, loseLinks: ['007'], source: '' }] } }
    } satisfies BookDefinition)
    setBook('yield-demo')
    useCharacter().endGameSession()
    dice.queue.length = 0
    const { effects } = setup('006')
    dice.queue.push(1, 1, 6, 6)
    expect(effects.combatRound(0)).toMatchObject({ done: true, won: false })
    expect(effects.linkState('007').status).toBe('testFailure')
  })
})

describe('scales and venom', () => {
  it('a double never wounds, and an enemy 12 costs 1 skill more', () => {
    registerBook({
      ...findBook('mechanics-demo')!,
      id: 'scales-demo',
      rules: { ...findBook('mechanics-demo')!.rules, '006': { effects: [{ kind: 'combat', type: 'sword', enemies: [{ name: 'ЗМЕЯ', skill: 1, strength: 8 }], doublesMiss: true, enemyThrow: { total: 12, stat: 'agility', amount: -1 }, source: '' }] } }
    } satisfies BookDefinition)
    setBook('scales-demo')
    useCharacter().endGameSession()
    dice.queue.length = 0
    const { effects, api } = setup('006')
    // You 4+4+10 = 18 against 1+1+1 = 3: a double, deflected
    dice.queue.push(4, 4, 1, 1)
    expect(effects.combatRound(0)).toMatchObject({ enemies: [8] })
    // You 1+2+10 = 13 against 6+6+1 = 13: parried, but the 12 costs 1 МАСТЕРСТВО
    dice.queue.push(1, 2, 6, 6)
    effects.combatRound(0)
    expect(api.character.value.agility).toBe(9)
  })
})
