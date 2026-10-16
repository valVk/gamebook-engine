/**
 * Replace an edition's quotes with fingerprints (shared/engine/quote.ts), so it can be published
 * without the book's text. Needs the text installed (BOOKS_DIR): every quote is checked first.
 *
 *   npm run book:fingerprint povelitel
 *
 * Rewrites the string literals of editions/<id>/*.ts that are rule quotes; comments are left to a
 * human (they must not quote the book either).
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import installed from '#books'
import type { BookDefinition } from '#shared/engine/book'
import { checkBook } from '#shared/engine/check'
import { findBook, registerBooks } from '#shared/engine/library'
import { fingerprint, isFingerprint } from '#shared/engine/quote'
import { readSections } from '#shared/engine/readSections'
import { booksDirs, editionsDir, findPacks } from './packs'

registerBooks(installed as BookDefinition[])

const root = fileURLToPath(new URL('..', import.meta.url))
const id = process.argv.slice(2).find(arg => !arg.startsWith('-'))
const dir = id ? findPacks(booksDirs(root), root).get(id) : undefined
const book = id ? findBook(id) : undefined
if (!id || !dir || !book) {
  console.error('Usage: npm run book:fingerprint <edition id> (its text must be installed in BOOKS_DIR)')
  process.exit(1)
}

const missing = checkBook(book, readSections(dir)).missingQuotes
if (missing.length) {
  for (const { section, source } of missing) console.error(`✗ ${section}: quote not in the text: «${source}»`)
  process.exit(1)
}

const quotes = new Set(Object.values(book.sectionRules)
  .flatMap(rules => [...(rules.effects ?? []), ...(rules.links ?? []), ...(rules.conditions ?? [])])
  .map(rule => rule.source)
  .filter(source => source && !isFingerprint(source)))

const escape = (text: string, quote: string) => text.replaceAll('\\', '\\\\').replaceAll(quote, `\\${quote}`)
const folder = join(editionsDir(root), id)
let replaced = 0
for (const file of readdirSync(folder).filter(name => name.endsWith('.ts'))) {
  const path = join(folder, file)
  let code = readFileSync(path, 'utf-8')
  for (const quote of quotes) {
    for (const mark of ['\'', '"']) {
      const literal = `${mark}${escape(quote, mark)}${mark}`
      const count = code.split(literal).length - 1
      if (count) {
        code = code.replaceAll(literal, `'${fingerprint(quote)}'`)
        replaced += count
      }
    }
  }
  writeFileSync(path, code)
}
console.log(`${id}: ${quotes.size} quotes, ${replaced} literals replaced in ${folder}`)
