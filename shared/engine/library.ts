import { createBook } from './book'
import type { Book, BookDefinition } from './book'

/**
 * The books known to this process. Books are loaded at runtime from BOOKS_DIR by the server
 * (server/utils/packs.ts) and reach the app as manifests (app/middleware/book.global.ts);
 * tests and scripts register the packs they import (#books).
 */
const BOOKS = new Map<string, Book>()

export const registerBook = (definition: BookDefinition): Book => {
  const book = createBook(definition)
  BOOKS.set(definition.id, book)
  return book
}

export const registerBooks = (definitions: readonly BookDefinition[]) => definitions.map(registerBook)

export const findBook = (id: string): Book | undefined => BOOKS.get(id)

export const allBooks = (): Book[] => [...BOOKS.values()]

let active: Book | undefined
let resolve: (() => Book | undefined) | null = null

/**
 * The app registers how to find the book of the page being rendered (from its route), so a server
 * rendering two books at once never mixes them up (app/plugins/book.ts).
 */
export const setBookResolver = (resolver: () => Book | undefined) => {
  resolve = resolver
}

/** The book being read, if one is open (the shelf has none) */
export const tryGetBook = (): Book | undefined => resolve?.() ?? active ?? BOOKS.values().next().value

/**
 * The book being read: the current page's book when the app can tell, otherwise the last one
 * opened (one book at a time in the browser). Server API code receives the book explicitly.
 */
export const getBook = (): Book => {
  const book = tryGetBook()
  if (!book) throw new Error('No book is open (is BOOKS_DIR set?)')
  return book
}

export const setBook = (id: string) => {
  const book = findBook(id)
  if (!book) throw new Error(`Unknown book: ${id}`)
  active = book
  return book
}
