import type { BookDefinition } from '#shared/engine/book'
import povelitel from './povelitel/book'
import shelton from './shelton/book'

/**
 * The engine's editions: the rules of known books, matched to the exact text their importers write
 * (importers/<id>/, each checking its file's MD5). A folder in BOOKS_DIR named after an edition and
 * holding only that text is a playable book. No book text is kept here: every rule quotes its
 * section by a fingerprint (shared/engine/quote.ts), checked against the reader's own copy.
 */
export const EDITIONS: Readonly<Record<string, BookDefinition>> = { povelitel, shelton } as unknown as Record<string, BookDefinition>
