/**
 * The command line every book importer shares: check the file's MD5, convert it, compare with the
 * installed pack and, with --write, write sections/ and public/.
 *
 *   npm run import:<book> -- "<path>.fb2" [--pack <folder>] [--write] [--force]
 *
 * The pack folder defaults to the installed pack with the importer's id (BOOKS_DIR), or
 * <first BOOKS_DIR>/<id>. An existing preface.md is kept; book.ts, rules.ts and combats.ts are not
 * generated (docs/AUTHORING.md).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { booksDirs, findPacks } from '../scripts/packs'
import { verifyFile } from './fb2'
import type { KnownFile } from './fb2'

export interface ImportedBook {
  title: string
  author: string
  sections: Record<string, string>
  preface: string
  images: Record<string, { data: Buffer }>
  warnings: string[]
  /** Sections a human has to look at (luck checks the importer could not mark) */
  unclear: string[]
}

export interface Importer {
  /** The pack id and folder name */
  id: string
  /** What the known file is, for the messages */
  file: string
  known: KnownFile
  convert: (bytes: Buffer) => ImportedBook
}

export const runImport = (importer: Importer, args = process.argv.slice(2)) => {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const option = (name: string) => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] : undefined
  }
  const packOption = option('--pack')
  const file = args.find(arg => !arg.startsWith('--') && arg !== packOption)
  const write = args.includes('--write')
  const force = args.includes('--force')

  if (!file || !existsSync(file)) {
    console.error(`Usage: npm run import:${importer.id} -- "<path>.fb2" [--pack <folder>] [--write]`)
    process.exit(1)
  }

  const pack = packOption
    ? resolve(packOption)
    : findPacks(booksDirs(root), root).get(importer.id) ?? join(booksDirs(root)[0]!, importer.id)

  const bytes = readFileSync(file)
  const check = verifyFile(bytes, importer.known)
  if (check.ok) {
    console.log(`MD5 ${check.md5}: ${importer.file}`)
  } else {
    const message = [
      'This is not the file the importer was written for:',
      `  expected MD5 ${importer.known.md5} (${importer.known.bytes} bytes), ${importer.file}`,
      `  got      MD5 ${check.md5} (${check.bytes} bytes)`
    ].join('\n')
    if (!force) {
      console.error(`${message}\nNothing was converted. Add --force to convert it anyway and compare the result.`)
      process.exit(1)
    }
    console.warn(`${message}\n--force: converting anyway; compare the result before --write.`)
  }

  const book = importer.convert(bytes)
  const { sections } = book

  console.log(`${book.title}, ${book.author}: ${Object.keys(sections).length} sections, ${Object.keys(book.images).length} images`)
  for (const warning of book.warnings) console.log(`  warning: ${warning}`)
  if (book.unclear.length) console.log(`  to mark by hand: ${book.unclear.join(' ')}`)

  const dir = join(pack, 'sections')
  const current = existsSync(dir)
    ? Object.fromEntries(readdirSync(dir).filter(name => /^\d{3}\.md$/.test(name)).map(name => [name.slice(0, 3), readFileSync(join(dir, name), 'utf-8')]))
    : {}
  if (Object.keys(current).length) {
    const changed = Object.keys(sections).filter(id => current[id] !== sections[id])
    const gone = Object.keys(current).filter(id => !(id in sections))
    console.log(`  ${dir}: ${Object.keys(sections).length - changed.length} identical, ${changed.length} different, ${gone.length} only there`)
    if (changed.length) console.log(`  different: ${changed.slice(0, 40).join(' ')}${changed.length > 40 ? ' ...' : ''}`)
  } else {
    console.log(`  ${dir}: no sections yet`)
  }

  if (write) {
    mkdirSync(dir, { recursive: true })
    for (const [id, text] of Object.entries(sections)) writeFileSync(join(dir, `${id}.md`), text)
    if (!existsSync(join(dir, 'preface.md'))) writeFileSync(join(dir, 'preface.md'), book.preface)
    mkdirSync(join(pack, 'public'), { recursive: true })
    for (const [id, { data }] of Object.entries(book.images)) writeFileSync(join(pack, 'public', id), data)
    console.log(`  wrote ${Object.keys(sections).length} sections and ${Object.keys(book.images).length} images to ${pack}`)
    if (!existsSync(join(pack, 'book.ts'))) {
      console.log('  The pack has no book.ts yet: the rules registry is not part of the engine (docs/AUTHORING.md)')
    }
  }
}
