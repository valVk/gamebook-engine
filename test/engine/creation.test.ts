// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BookDefinition } from '#shared/engine/book'
import { createBook } from '#shared/engine/book'
import { findBook, registerBook, setBook } from '#shared/engine/library'
import { ref } from 'vue'
import { useCharacter } from '~/composables/useCharacter'
import { useSectionEffects } from '~/composables/useSectionEffects'
import { arrivalCard, deathCard } from '~/utils/outcomes'
import { parseDiceRollMetadata, parseEnemies } from '#shared/utils/sectionContent'

/**
 * A book that names its core stats itself and rolls each one by a formula (the way «Тайна капитана
 * Шелтона» makes a character: МАСТЕРСТВО 1d6+6, ВЫНОСЛИВОСТЬ 2d6+12), built on the demo pack.
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
const { table: _table, ...demoCharacter } = demo.character

const formulaBook = {
  ...demo,
  id: 'formula-demo',
  character: {
    ...demoCharacter,
    roll: { agility: '1d6+6', strength: '2d6+12', honor: '1d6' },
    labels: {
      agility: { name: 'МАСТЕРСТВО', of: 'МАСТЕРСТВА', short: 'МАСТ.' },
      strength: { name: 'ВЫНОСЛИВОСТЬ', of: 'ВЫНОСЛИВОСТИ', short: 'ВЫН.' }
    }
  }
} satisfies BookDefinition

registerBook(formulaBook)

describe('book-defined core stats', () => {
  beforeEach(() => {
    dice.queue.length = 0
    setBook('formula-demo')
    useCharacter().endGameSession()
  })

  it('rolls each stat by its formula', () => {
    const api = useCharacter()
    dice.queue.push(4, 3, 5, 2)
    const result = api.rollStats()

    expect(result.kind).toBe('formula')
    expect(result.kind === 'formula' && result.rolls).toEqual([
      { stat: 'agility', formula: '1d6+6', dice: [4], modifier: 6, total: 10 },
      { stat: 'strength', formula: '2d6+12', dice: [3, 5], modifier: 12, total: 20 },
      { stat: 'honor', formula: '1d6', dice: [2], modifier: 0, total: 2 }
    ])
    expect(api.character.value).toMatchObject({
      agility: 10, maxAgility: 10, strength: 20, maxStrength: 20, attributes: { honor: 2 }
    })
  })

  it('names the core stats as the book does', () => {
    const book = findBook('formula-demo')!
    expect(book.statLabel('agility').name).toBe('МАСТЕРСТВО')
    expect(book.statLabel('strength').of).toBe('ВЫНОСЛИВОСТИ')
    expect(book.statLabel('gold').name).toBe('золото')
    expect(book.rolledStats).toEqual(['agility', 'strength', 'honor'])
  })

  it('uses the names on outcome cards', () => {
    const card = arrivalCard([{
      index: 0,
      effect: { kind: 'change', stat: 'strength', amount: -3, source: '' },
      outcome: { value: -3 },
      resolved: true,
      automatic: true
    }])
    expect(card?.lines).toEqual(['−3 ВЫНОСЛИВОСТИ'])
    expect(deathCard().lines[0]).toMatch(/^ВЫНОСЛИВОСТЬ иссякла/)
  })

  it('keeps the shared names for a book that does not rename them', () => {
    setBook('demo')
    expect(findBook('demo')!.statLabel('agility')).toMatchObject({ name: 'ЛОВКОСТЬ', short: 'ЛОВК.' })
    expect(findBook('demo')!.rolledStats).toEqual(['agility', 'strength', 'honor'])
  })

  it('needs exactly one way to make a character', () => {
    expect(() => createBook({ ...formulaBook, id: 'both', character: { ...formulaBook.character, table: demo.character.table } }))
      .toThrow(/exactly one of `table` or `roll`/)
    expect(() => createBook({ ...formulaBook, id: 'none', character: { ...demoCharacter } }))
      .toThrow(/exactly one/)
  })
})

describe('enemy blocks in the book\'s words', () => {
  const words = findBook('formula-demo')!.enemyWords

  it('reads the words from the book', () => {
    expect(words).toEqual({ sword: 'Мастерство', strength: 'Выносливость', mind: 'Сила мысли' })
    expect(findBook('demo')!.enemyWords).toEqual({ sword: 'Ловкость', strength: 'Сила', mind: 'Сила мысли' })
  })

  it('parses blocks with a tail, and blocks split over two headings', () => {
    const text = [
      '##### ПЕРВЫЙ ВОИН', '', '> ##### Мастерство 10 Выносливость 10 минус потери от ран', '',
      '##### АКУЛА', '', '> ##### Мастерство 10', '', '> ##### Выносливость 16', '',
      '> ##### Ловкость 7 Сила 6'
    ].join('\n')
    expect(parseEnemies(text, words)).toEqual([
      { name: 'ПЕРВЫЙ ВОИН', type: 'sword', skill: 10, strength: 10 },
      { name: 'АКУЛА', type: 'sword', skill: 10, strength: 16 }
    ])
    expect(parseEnemies(text)).toEqual([{ name: null, type: 'sword', skill: 7, strength: 6 }])
  })
})

describe('codes: numbers added to the section', () => {
  const codesBook = {
    ...demo,
    id: 'codes-demo',
    spells: {
      light: { name: 'Слово света', add: 3 },
      owl: { name: 'Филин', add: 1, action: 'Позвать Филина' },
      dolphin: { name: 'Фигурка дельфина', add: 2, item: 'key' }
    },
    rules: {
      ...demo.rules,
      '010': { effects: [{ kind: 'castSpell', spell: 'owl', with: ['light'], source: '' }] },
      '011': { effects: [{ kind: 'castSpell', spell: 'dolphin', source: '' }] },
      '013': { effects: [{ kind: 'forgetSpell', spell: 'owl', source: '' }] },
      '016': { effects: [{ kind: 'riddle', answers: { 96: '017', 144: '018' }, prompt: 'Что значит МВК?', source: '' }] }
    }
  } satisfies BookDefinition
  registerBook(codesBook)
  const book = findBook('codes-demo')!

  it('adds the codes to the section number', () => {
    expect(book.castTarget('014', { spell: 'light' })).toBe('017')
    expect(book.castTarget('010', { spell: 'owl', with: ['light'] })).toBe('014')
    expect(book.castTarget('014', { spell: 'light', target: '099' })).toBe('099')
    expect(book.spellName('owl')).toBe('Филин')
    expect(book.codeInstruction('owl')).toBe('прибавьте 1 к номеру параграфа')
    expect(createBook({ ...codesBook, spells: { ...codesBook.spells, owl: { name: 'Филин', add: -50 } } }).codeInstruction('owl'))
      .toBe('вычтите 50 из номера параграфа')
  })

  it('forgets a code, and opens a section by a riddle\'s answer', () => {
    setBook('codes-demo')
    const api = useCharacter()
    api.endGameSession()
    dice.queue.push(3, 4, 2, 5)
    api.rollStats()
    api.startJourney()
    api.learnSpell('owl')
    const current = ref('012')
    const effects = useSectionEffects(current)
    api.navigateToPage('013')
    current.value = '013'
    effects.applyArrival()
    expect(api.hasCode('owl')).toBe(false)

    api.navigateToPage('016')
    current.value = '016'
    expect(effects.answerRiddle(0, '12')).toBeNull()
    expect(effects.answerRiddle(0, '096')).toBe('017')
  })

  it('offers a code while it is at hand: learnt, or its item carried', () => {
    setBook('codes-demo')
    const api = useCharacter()
    api.endGameSession()
    expect(api.hasCode('dolphin')).toBe(false)
    api.addItem(book.itemName('key'))
    expect(api.hasCode('dolphin')).toBe(true)
    api.learnSpell('owl')
    expect(api.codesAtHand()).toEqual(['owl', 'dolphin'])
  })
})

describe('luck markers', () => {
  it('may offer a choice of links for an outcome', () => {
    const meta = parseDiceRollMetadata('<!-- DICE_ROLL_REQUIRED: luck -->\n<!-- LUCK_SUCCESS_LINK: 139 -->\n<!-- LUCK_FAILURE_LINK: 43, 508 -->\n\nТекст')
    expect(meta).toMatchObject({
      required: 'luck', successLink: '139', successLinks: ['139'], failureLink: '43', failureLinks: ['43', '508']
    })
  })
})

describe('a clock: travel costs, a Dolphin, a deadline', () => {
  const clockBook = {
    ...demo,
    id: 'clock-demo',
    character: {
      ...demo.character,
      attributes: { ...demo.character.attributes, timeLeft: { label: { name: 'ВРЕМЯ', of: 'минут' }, start: 240, sheet: 'cell', format: 'clock', visibleAfter: '002' } }
    },
    spells: { ...demo.spells, dolphin: { name: 'Дельфин' } },
    rules: {
      ...demo.rules,
      '001': { ...demo.rules['001'], links: [{ link: '002', stat: 'timeLeft', amount: 30, charge: true, cheaper: [{ spell: 'dolphin', amount: 10 }], source: '' }] },
      '012': { conditions: [{ link: '002', visited: false, source: '' }] }
    },
    deadlines: [{ stat: 'timeLeft', below: 15, on: ['003'], section: '016', title: 'Время истекло' }]
  } satisfies BookDefinition
  registerBook(clockBook)

  it('spends time on a link, less with the Dolphin, and sends the reader on when time runs out', () => {
    setBook('clock-demo')
    const api = useCharacter()
    api.endGameSession()
    dice.queue.push(3, 4, 2, 5)
    api.rollStats()
    api.startJourney()
    const current = ref('001')
    const effects = useSectionEffects(current)
    expect(effects.linkState('002')).toMatchObject({ status: 'open', cost: { amount: 30 } })
    api.learnSpell('dolphin')
    expect(effects.linkState('002')).toMatchObject({ status: 'open', cost: { amount: 10 } })
    expect(effects.followLink('002')).toBe(true)
    api.navigateToPage('002')
    expect(api.statValue('timeLeft')).toBe(230)

    api.applyChange('timeLeft', -220)
    api.navigateToPage('003')
    current.value = '003'
    expect(effects.deadline.value).toMatchObject({ section: '016' })
    expect(effects.linkState('004')).toMatchObject({ status: 'locked' })

    api.navigateToPage('012')
    current.value = '012'
    expect(effects.linkState('002')).toMatchObject({ status: 'unavailable' })
  })
})
