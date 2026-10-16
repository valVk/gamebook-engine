import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { setBook } from '#shared/engine/library'
import povelitel from '../book'
import { createBook } from '#shared/engine/book'
import { isOutcomeEffect } from '#shared/engine/rules'
import { parseEnemies } from '#shared/utils/sectionContent'
import packDirs from '#pack-dirs'
import { findQuote } from '#shared/engine/quote'

// The registry holds every installed book; these tests read «Повелитель»
setBook('povelitel')

const book = createBook(povelitel)
const { sectionRules: SECTION_RULES, combats: COMBATS, endings: ENDINGS, misprints: MISPRINTS = {} } = book
const PEEK_SECTIONS = new Set(book.peek)
const correctMisprints = book.correctMisprints

const sectionPath = (id: string) => join(packDirs.povelitel!, 'sections', `${id}.md`)
const readSection = (id: string) => readFileSync(sectionPath(id), 'utf-8')
const linksOf = (id: string) => new Set([...readSection(id).matchAll(/\(#n_(\d+)\)/g)].map(m => m[1]!.padStart(3, '0')))

const entries = Object.entries(SECTION_RULES)

describe('SECTION_RULES', () => {
  it.each(entries)('section %s: every source quote exists in the text', (id, rules) => {
    const text = readSection(id)
    const sources = [...(rules.effects ?? []), ...(rules.links ?? []), ...(rules.conditions ?? [])].map(rule => rule.source)
    for (const source of sources) {
      expect(findQuote(text, source) ?? findQuote(correctMisprints(id, text), source), `quote not found in ${id}.md: ${source}`).toBeDefined()
    }
  })

  it.each(entries)('section %s: referenced links exist in the section', (id, rules) => {
    const links = linksOf(id)
    const referenced = [
      ...(rules.links ?? []).map(rule => rule.link),
      ...(rules.plainLinks ?? []),
      ...(rules.conditions ?? []).map(condition => condition.link),
      ...(rules.effects ?? []).flatMap((effect) => {
        if (effect.kind === 'roll') return effect.escapeLinks ?? []
        if (isOutcomeEffect(effect)) return [...effect.successLinks, ...effect.failureLinks]
        if (effect.kind === 'combat') return [...(effect.escapeLinks ?? []), ...(effect.loseLinks ?? [])]
        return []
      })
    ]
    for (const link of referenced) {
      expect(links.has(link), `${id}.md has no link to ${link}`).toBe(true)
    }
  })

  it('spell targets exist', () => {
    for (const rules of Object.values(SECTION_RULES)) {
      for (const effect of rules.effects ?? []) {
        if (effect.kind === 'castSpell') expect(existsSync(sectionPath(effect.target))).toBe(true)
      }
    }
  })

  it('uses 3-digit section ids', () => {
    for (const id of Object.keys(SECTION_RULES)) expect(id).toMatch(/^\d{3}$/)
  })
})

describe('COMBATS', () => {
  it('covers every section with an enemy stat block', () => {
    const withEnemies = Object.keys(SECTION_RULES).length && [...Array(633).keys()]
      .map(n => String(n).padStart(3, '0'))
      .filter(id => existsSync(sectionPath(id)) && parseEnemies(readSection(id)).length > 0)
    expect(Object.keys(COMBATS).sort()).toEqual(withEnemies)
  })

  it.each(Object.entries(COMBATS))('section %s: enemies match the stat blocks in the text', (id, combat) => {
    const parsed = parseEnemies(readSection(id))
    expect(combat.enemies).toEqual(parsed.map(({ name, skill, strength }) => ({ name, skill, strength })))
    expect(parsed.every(enemy => enemy.type === combat.type)).toBe(true)
  })
})

describe('ENDINGS', () => {
  it.each(Object.keys(ENDINGS))('%s is an ending (no links, not a reference page)', (id) => {
    expect(linksOf(id).size).toBe(0)
    expect(PEEK_SECTIONS.has(id)).toBe(false)
  })
})

describe('PEEK_SECTIONS', () => {
  it.each([...PEEK_SECTIONS])('%s is a reference page without outgoing links', (id) => {
    expect(linksOf(id).size).toBe(0)
  })

  describe('misprints', () => {
    it.each(Object.entries(MISPRINTS))('%s: every corrected fragment is in the printed text', (id, fixes) => {
      const text = readSection(id)
      for (const { from, to } of fixes) {
        expect(text).toContain(from)
        expect(correctMisprints(id, text)).toContain(to)
      }
    })

    it('083 sends Сила мысли 4 to the abilities page, as its twin 274 does; 448 stays a trap', () => {
      const fixed = correctMisprints('083', readSection('083'))
      expect(fixed).not.toContain('#n_448')
      expect(readSection('274')).toContain('[**488**](#n_488)')
      expect(PEEK_SECTIONS.has('488')).toBe(true)
      expect(linksOf('542').has('448')).toBe(true)
    })
  })
})
