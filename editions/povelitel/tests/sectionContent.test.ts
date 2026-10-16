import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { setBook } from '#shared/engine/library'
import { hasSectionLinks, parseDiceRollMetadata, parseEnemies, resolveSectionFileName } from '#shared/utils/sectionContent'
import packDirs from '#pack-dirs'

// The registry holds every installed book; these tests read «Повелитель»
setBook('povelitel')

const readSection = (name: string) => readFileSync(join(packDirs.povelitel!, 'sections', name), 'utf-8')

describe('resolveSectionFileName', () => {
  it('pads section numbers to three digits', () => {
    expect(resolveSectionFileName('1')).toBe('001.md')
    expect(resolveSectionFileName('89')).toBe('089.md')
    expect(resolveSectionFileName('632')).toBe('632.md')
  })

  it('maps preface', () => {
    expect(resolveSectionFileName('preface')).toBe('preface.md')
  })

  it.each([
    '../package.json',
    '../../etc/passwd',
    '..%2F..%2Fsecret',
    'sections/001',
    '1234',
    '12a',
    '',
    ' 1',
    'PREFACE',
    'preface.md'
  ])('rejects %j', (slug) => {
    expect(resolveSectionFileName(slug)).toBeNull()
  })

  it('rejects missing slugs', () => {
    expect(resolveSectionFileName(undefined)).toBeNull()
    expect(resolveSectionFileName(null)).toBeNull()
  })
})

describe('hasSectionLinks', () => {
  it('detects bold, plain and html links', () => {
    expect(hasSectionLinks('go to [**89**](#n_89)')).toBe(true)
    expect(hasSectionLinks('go to [89](#n_89)')).toBe(true)
    expect(hasSectionLinks('go to <a href="#n_89">89</a>')).toBe(true)
  })

  it('returns false for endings', () => {
    expect(hasSectionLinks('Вы погибли.')).toBe(false)
  })
})

describe('parseEnemies', () => {
  it('parses a telepathic duel with a named enemy (section 016)', () => {
    expect(parseEnemies(readSection('016.md'))).toEqual([
      { name: 'НЕВИДИМЫЙ СТРАЖ', type: 'mind', skill: 7, strength: 12 }
    ])
  })

  it('parses sword combat blocks', () => {
    const enemies = parseEnemies('##### ГОБЛИН\n\n> ##### Ловкость 8 Сила 10\n\n> ##### Ловкость 7 Сила 6')
    expect(enemies).toEqual([
      { name: 'ГОБЛИН', type: 'sword', skill: 8, strength: 10 },
      { name: null, type: 'sword', skill: 7, strength: 6 }
    ])
  })

  it('ignores prose that merely mentions ЛОВКОСТЬ (section 105)', () => {
    expect(parseEnemies(readSection('105.md'))).toEqual([])
  })
})

describe('parseDiceRollMetadata', () => {
  it('reads luck check markers (section 165)', () => {
    const meta = parseDiceRollMetadata(readSection('165.md'))
    expect(meta).toMatchObject({
      required: 'luck',
      successLink: '73',
      failureLink: '621',
      hasLuckCheck: true,
      hasCombat: false
    })
  })

  it('reads the luck penalty marker (section 213)', () => {
    const meta = parseDiceRollMetadata(readSection('213.md'))
    expect(meta.hasLuckPenalty).toBe(true)
    // "ПРОВЕРИТЬ СВОЮ УДАЧУ" here describes the penalty, it is not a check on this page
    expect(meta.required).toBeUndefined()
  })

  it('reads luck restoration markers (section 094)', () => {
    const meta = parseDiceRollMetadata(readSection('094.md'))
    expect(meta.required).toBe('luck_restoration')
    expect(meta.hasLuckRestoration).toBe(true)
  })

  it('ignores unknown roll types', () => {
    expect(parseDiceRollMetadata('<!-- DICE_ROLL_REQUIRED: teleport -->').required).toBeUndefined()
  })

  it('flags every section with an enemy stat block as combat', () => {
    const combatSections = ['016.md', '028.md', '038.md', '049.md']
    for (const name of combatSections) {
      expect(parseDiceRollMetadata(readSection(name)).hasCombat, name).toBe(true)
    }
  })
})
