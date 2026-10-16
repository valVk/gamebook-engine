import { existsSync, readdirSync } from 'node:fs'
import { delimiter, join, resolve } from 'node:path'
import { createJiti } from 'jiti'
import { createBook } from '#shared/engine/book'
import type { Book, BookDefinition } from '#shared/engine/book'
import { EDITIONS } from '../../editions'

/**
 * Book packs, loaded at runtime from BOOKS_DIR: every folder with a book.ts. BOOKS_DIR may list
 * several folders separated like PATH; it defaults to ./books (or ./examples/books when there is
 * no ./books), relative to the working directory. In the Docker image it is /books, a volume.
 *
 * A pack is either a book of your own (a folder with book.ts) or the text of a known edition (a
 * folder named after one of the engine's editions/, holding only sections/ and public/ as its
 * importer wrote them): the edition's rules are built into the server.
 *
 * A pack's own book.ts is TypeScript compiled on the fly (jiti). It must not import engine code at
 * runtime: only types (`import type`, `satisfies BookDefinition<...>`), since the built server does
 * not contain the engine's sources.
 */
export interface Pack {
  dir: string
  definition: BookDefinition
  book: Book
}

const packFolders = () => {
  const root = process.cwd()
  const configured = process.env.BOOKS_DIR
    ?? (existsSync(join(root, 'books')) ? 'books' : 'examples/books')
  const folders = new Map<string, string>()
  for (const dir of configured.split(delimiter).filter(Boolean).map(dir => resolve(root, dir))) {
    if (!existsSync(dir)) continue
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const folder = join(dir, entry.name)
      const isPack = existsSync(join(folder, 'book.ts')) || (entry.name in EDITIONS && existsSync(join(folder, 'sections')))
      if (entry.isDirectory() && isPack && !folders.has(entry.name)) {
        folders.set(entry.name, join(dir, entry.name))
      }
    }
  }
  return { configured, folders: new Map([...folders].sort(([a], [b]) => a.localeCompare(b))) }
}

const load = async (): Promise<Map<string, Pack>> => {
  // No caches on disk: the container's file system is read-only
  const jiti = createJiti(import.meta.url, { moduleCache: false, fsCache: false, interopDefault: true })
  const { configured, folders } = packFolders()
  const packs = new Map<string, Pack>()
  for (const [folder, dir] of folders) {
    try {
      const own = join(dir, 'book.ts')
      const definition = existsSync(own) ? await jiti.import<BookDefinition>(own, { default: true }) : EDITIONS[folder]
      if (!definition?.id) throw new Error('book.ts has no default export with an id')
      packs.set(definition.id, { dir, definition, book: createBook(definition) })
    } catch (error) {
      console.error(`[books] ${folder}: cannot load book.ts (packs may import only types from the engine): ${(error as Error).message}`)
    }
  }
  if (!packs.size) console.warn(`[books] No book packs found in BOOKS_DIR=${configured}`)
  else console.info(`[books] ${[...packs.keys()].join(', ')} from ${configured}`)
  return packs
}

let loaded: Promise<Map<string, Pack>> | null = null
let loadedAt = 0

/** Every installed pack: loaded once per server start (in development, again after a few seconds) */
export const getPacks = () => {
  if (!loaded || (import.meta.dev && Date.now() - loadedAt > 3000)) {
    loaded = load()
    loadedAt = Date.now()
  }
  return loaded
}
