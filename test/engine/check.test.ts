import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBook } from '#shared/engine/book'
import { checkBook, reportErrors } from '#shared/engine/check'
import { findBook } from '#shared/engine/library'
import { readSections } from '#shared/engine/readSections'

const demo = findBook('demo')!
const sections = readSections(join(__dirname, '../../examples/books/demo'))

describe('checkBook on the demo pack', () => {
  const report = checkBook(demo, sections)

  it('finds no errors', () => {
    expect(reportErrors(report)).toEqual([])
  })

  it('reaches every section from the start, the spell target included', () => {
    expect(report.unreachable).toEqual([])
    expect(report.reachable).toContain('017')
  })

  it('leaves nothing to review: every mechanical sentence has a rule', () => {
    expect(report.review).toEqual([])
  })
})

describe('checkBook catches mistakes', () => {
  it('a rule quote that is not in the text', () => {
    const changed = { ...sections, '001': sections['001']!.replace('В траве блестят 5 монет', 'В траве лежат монеты') }
    expect(checkBook(demo, changed).missingQuotes).toEqual([{ section: '001', source: 'В траве блестят 5 монет' }])
  })

  it('a link to a section that does not exist', () => {
    const changed = { ...sections, '002': `${sections['002']} Или — [**99**](#n_99).` }
    expect(checkBook(demo, changed).brokenLinks).toEqual(['002 -> 099'])
  })

  it('a fight that does not match its stat block', () => {
    const changed = { ...sections, '004': sections['004']!.replace('Ловкость 7 Сила 6', 'Ловкость 8 Сила 6') }
    expect(checkBook(demo, changed).combatMismatches).toEqual(['004'])
  })

  it('an unreachable section and mechanical wording with no rule', () => {
    const changed = { ...sections, '019': 'Потеряйте 2 СИЛЫ и вернитесь в [**1**](#n_1).' }
    const report = checkBook(demo, changed)
    expect(report.unreachable).toEqual(['019'])
    expect(report.review.map(entry => entry.section)).toEqual(['019'])
  })

  it('a code that leads elsewhere than its target, or nowhere', () => {
    const castIn014 = (spell: Record<string, unknown>, extra: Record<string, unknown> = {}) => createBook({
      ...demo,
      spells: { light: spell as never },
      rules: { ...demo.rules, '014': { effects: [{ kind: 'castSpell', spell: 'light', source: 'Если вам ведомо Слово света', ...extra }] } }
    })
    expect(checkBook(castIn014({ name: 'Слово света', add: 4 }, { target: '017' }), sections).codeProblems)
      .toEqual(['014: light target 017, but 014 + code = 018'])
    expect(checkBook(castIn014({ name: 'Слово света' }), sections).codeProblems)
      .toEqual(['014: light has no number to add and no target'])
    expect(checkBook(castIn014({ name: 'Слово света', add: 900 }), sections).codeProblems)
      .toEqual(['014: light leads to missing section 914'])
  })
})
