import { existsSync, readdirSync } from 'node:fs'
import { delimiter, join, resolve } from 'node:path'

/**
 * Where book packs live. BOOKS_DIR lists one or more folders, separated like PATH
 * (`books:examples/books`); by default ./books, or the demo book when ./books holds no pack.
 *
 * A pack is a folder with a book.ts (a book of your own), or a folder holding only a book's text
 * (sections/, public/) whose name is one of the engine's editions (editions/<id>/: the rules of a
 * known edition, matched to the text its importer writes). The first folder wins for a repeated id.
 */
export const booksDirs = (root: string, configured = process.env.BOOKS_DIR) => {
  // An empty ./books (e.g. a Docker build without a books context) falls back to the demo too
  const value = configured ?? (findPacks([join(root, 'books')], root).size ? 'books' : 'examples/books')
  return value.split(delimiter).filter(Boolean).map(dir => resolve(root, dir))
}

/** The engine's built-in editions (rules for a known text), by id */
export const editionsDir = (root: string) => join(root, 'editions')

const hasEdition = (root: string, id: string) => existsSync(join(editionsDir(root), id, 'book.ts'))

/** Pack folders by book id, sorted by id */
export const findPacks = (dirs: string[], root: string): Map<string, string> => {
  const packs = new Map<string, string>()
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const folder = join(dir, entry.name)
      const isPack = existsSync(join(folder, 'book.ts'))
        || (existsSync(join(folder, 'sections')) && hasEdition(root, entry.name))
      if (entry.isDirectory() && isPack && !packs.has(entry.name)) packs.set(entry.name, folder)
    }
  }
  return new Map([...packs].sort(([a], [b]) => a.localeCompare(b)))
}

/** The book.ts that defines a pack: its own, or the engine's edition of that id */
export const definitionFile = (root: string, id: string, dir: string) =>
  existsSync(join(dir, 'book.ts')) ? join(dir, 'book.ts') : join(editionsDir(root), id, 'book.ts')

/** Tests of a pack: its own tests/, or its edition's */
export const testsDir = (root: string, id: string, dir: string) =>
  existsSync(join(dir, 'book.ts')) ? join(dir, 'tests') : join(editionsDir(root), id, 'tests')

/** The demo book, the engine's own example and test fixture */
export const demoDir = (root: string) => join(root, 'examples/books')
