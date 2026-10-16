/**
 * Rules prove themselves against their section by quoting it (`source`). A published edition
 * keeps no book text, so its quotes are fingerprints: `#<length>:<hash>`, the length of the quoted
 * fragment and an FNV-1a hash of it. book:check finds the fragment in the reader's own copy of the
 * text; `npm run book:check <id> -- --quotes` prints them back from it.
 *
 * Plain quotes still work (a book of your own, a rule being written); `npm run book:fingerprint <id>`
 * turns an edition's quotes into fingerprints before it is published.
 */

const FINGERPRINT = /^#(\d+):([0-9a-f]{8})$/

/** FNV-1a, 32 bits, over UTF-16 code units: enough to tell a fragment of a section from any other */
export const fnv1a = (text: string) => {
  let hash = 0x811C9DC5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export const fingerprint = (quote: string) => `#${quote.length}:${fnv1a(quote)}`

export const isFingerprint = (source: string) => FINGERPRINT.test(source)

/** The fragment of `text` a source stands for: the quote itself, or the fragment its fingerprint matches */
export const findQuote = (text: string, source: string): string | undefined => {
  const match = FINGERPRINT.exec(source)
  if (!match) return text.includes(source) ? source : undefined
  const length = Number(match[1])
  for (let i = 0; i + length <= text.length; i++) {
    const fragment = text.slice(i, i + length)
    if (fnv1a(fragment) === match[2]) return fragment
  }
  return undefined
}
