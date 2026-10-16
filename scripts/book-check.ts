/**
 * Check book packs against their own text.
 *
 *   npm run book:check              every installed pack (BOOKS_DIR, plus the demo)
 *   npm run book:check demo         one pack
 *   npm run book:check demo -- --quotes   also print every rule's quote, read from the text
 *
 * Errors (broken links, quotes not in the text, fights that do not match their stat blocks...)
 * fail the command. Unreachable sections and sections to review are listed for a human to read.
 */
import { fileURLToPath } from 'node:url'
import { checkBook, reportErrors } from '#shared/engine/check'
import installed from '#books'
import type { BookDefinition } from '#shared/engine/book'
import { findBook, registerBooks } from '#shared/engine/library'
import { booksDirs, demoDir, findPacks } from './packs'
import { readSections } from '#shared/engine/readSections'
import { findQuote } from '#shared/engine/quote'

registerBooks(installed as BookDefinition[])

const root = fileURLToPath(new URL('..', import.meta.url))
const packs = findPacks([...booksDirs(root), demoDir(root)], root)
const requested = process.argv.slice(2).filter(arg => !arg.startsWith('-'))
const ids = requested.length ? requested : [...packs.keys()]

let failed = false

for (const id of ids) {
  const dir = packs.get(id)
  const book = findBook(id)
  if (!dir || !book) {
    console.error(`✗ ${id}: no such pack (installed: ${[...packs.keys()].join(', ') || 'none'})`)
    failed = true
    continue
  }

  const report = checkBook(book, readSections(dir))
  const errors = reportErrors(report)
  failed ||= errors.length > 0

  console.log(`\n${book.title} (${id}), ${dir}`)
  console.log(`  sections: ${report.sections}, reachable from ${book.start}: ${report.reachable.length}`)
  console.log(`  rules: ${Object.keys(book.sectionRules).length} sections, fights: ${Object.values(book.sectionRules).filter(rules => rules.effects?.some(effect => effect.kind === 'combat')).length} sections`)

  if (report.unreachable.length) console.log(`  unreachable: ${report.unreachable.join(' ')}`)

  if (errors.length) {
    console.log(`  ${errors.length} error(s):`)
    for (const error of errors) console.log(`    ✗ ${error}`)
  } else {
    console.log('  no errors')
  }

  if (process.argv.includes('--quotes')) {
    const sections = readSections(dir)
    for (const [section, rules] of Object.entries(book.sectionRules)) {
      const sources = [...(rules.effects ?? []), ...(rules.links ?? []), ...(rules.conditions ?? [])].map(rule => rule.source)
      for (const source of sources) {
        console.log(`    ${section}: «${findQuote(book.correctMisprints(section, sections[section] ?? ''), source) ?? findQuote(sections[section] ?? '', source) ?? `? ${source}`}»`)
      }
    }
  }

  if (report.review.length) {
    console.log(`  to review (mechanical wording, no rule): ${report.review.length}`)
    for (const { section, words } of report.review) console.log(`    ${section}: ${words.join(', ')}`)
  }
}

process.exitCode = failed ? 1 : 0
