import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getBook, setBook } from '#shared/engine/library'
import {
  createDefaultCharacter,
  isValidPageId,
  parseSectionHref,
  sanitizeStoredCharacter
} from '~/utils/character'
import packDirs from '#pack-dirs'

// The registry holds every installed book; these tests read «Повелитель»
setBook('povelitel')

describe('creation table', () => {
  // The table itself is a picture; the preface spells out two of its rows in words
  it('agrees with the two rows the preface spells out (2 and 8)', () => {
    const preface = readFileSync(join(packDirs.povelitel!, 'sections', 'preface.md'), 'utf-8')
    const two = preface.match(/выпало 2, то ваши ЛОВКОСТЬ и ОБАЯНИЕ окажутся равны (\d+), а СИЛА — (\d+)/)!
    const eight = preface.match(/Если 8, то ЛОВКОСТЬ — (\d+), СИЛА — (\d+) и ОБАЯНИЕ — (\d+)/)!
    expect(getBook().character.table?.[2]).toEqual({ agility: Number(two[1]), strength: Number(two[2]), charisma: Number(two[1]) })
    expect(getBook().character.table?.[8]).toEqual({ agility: Number(eight[1]), strength: Number(eight[2]), charisma: Number(eight[3]) })
  })
})

describe('isValidPageId', () => {
  it.each(['preface', '1', '001', '632'])('accepts %j', (id) => {
    expect(isValidPageId(id)).toBe(true)
  })

  it.each(['debug', '', '1000', '../x', 12, null])('rejects %j', (id) => {
    expect(isValidPageId(id)).toBe(false)
  })
})

describe('parseSectionHref', () => {
  it('parses section anchors and pads them', () => {
    expect(parseSectionHref('#n_89')).toBe('089')
    expect(parseSectionHref('#n_230')).toBe('230')
    expect(parseSectionHref('001')).toBe('001')
  })

  it('ignores in-page anchors and external links', () => {
    expect(parseSectionHref('#Listok')).toBeNull()
    expect(parseSectionHref('https://example.com')).toBeNull()
    expect(parseSectionHref(null)).toBeNull()
  })
})

describe('createDefaultCharacter', () => {
  it('returns independent objects each time', () => {
    const a = createDefaultCharacter()
    const b = createDefaultCharacter()
    a.luck[0] = false
    a.visitedPages.push('001')
    a.pendingRolls['001'] = { type: 'luck', timestamp: 1 }

    expect(b.luck[0]).toBe(true)
    expect(b.visitedPages).toEqual([])
    expect(b.pendingRolls).toEqual({})
  })

  it('does not duplicate food in the inventory', () => {
    const character = createDefaultCharacter()
    expect(character.food).toBe(3)
    expect(character.inventory).toEqual([])
  })
})

describe('sanitizeStoredCharacter', () => {
  const valid = {
    ...createDefaultCharacter(),
    agility: 9,
    strength: 18,
    attributes: { charisma: 7, mentalPower: 4 },
    maxAgility: 9,
    maxStrength: 20,
    currentPage: '089',
    visitedPages: ['001', '089'],
    gameStartTime: 1000
  }

  it('keeps a valid save unchanged', () => {
    expect(sanitizeStoredCharacter(valid)).toEqual(valid)
  })

  it('moves the attributes of saves made before books had their own stats', () => {
    const { attributes, ...old } = valid
    const result = sanitizeStoredCharacter({ ...old, charisma: attributes.charisma, mentalPower: attributes.mentalPower })
    expect(result).toEqual(valid)
  })

  it('rejects non-objects', () => {
    expect(sanitizeStoredCharacter(null)).toBeNull()
    expect(sanitizeStoredCharacter('x')).toBeNull()
    expect(sanitizeStoredCharacter([1, 2])).toBeNull()
  })

  it('migrates the old food inventory entry', () => {
    const result = sanitizeStoredCharacter({ ...valid, inventory: ['Food (2 days)', 'Rope'] })
    expect(result?.inventory).toEqual(['Rope'])
  })

  it('repairs the debug pseudo page left by older debug sessions', () => {
    const result = sanitizeStoredCharacter({ ...valid, currentPage: 'debug', visitedPages: ['debug', '001'] })
    expect(result?.currentPage).toBe('preface')
    expect(result?.visitedPages).toEqual(['001'])
  })

  it('replaces malformed fields with defaults and clamps numbers', () => {
    const result = sanitizeStoredCharacter({
      ...valid,
      luck: [true, 'no'],
      strength: 999,
      attributes: { charisma: 40, mentalPower: 'x' },
      gold: -5,
      food: Number.NaN,
      pendingRolls: { '001': { type: 'luck', result: true, timestamp: 5 }, 'evil': { type: 'luck' }, '002': { type: 'nope' } }
    })

    expect(result?.luck).toEqual([true, true, true, true, true, true])
    expect(result?.strength).toBe(20)
    expect(result?.attributes).toEqual({ charisma: 12, mentalPower: 3 })
    expect(result?.gold).toBe(0)
    expect(result?.food).toBe(3)
    expect(result?.pendingRolls).toEqual({ '001': { type: 'luck', result: true, timestamp: 5 } })
  })
})
