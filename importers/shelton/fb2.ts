/**
 * «Тайна капитана Шелтона»: its known FB2 → the pack's sections.
 *
 * Dedicated to that file (windows-1251, one <section id="n_123"> per paragraph). On top of the
 * shared conversion (importers/fb2.ts) it
 * - writes links printed in brackets, «(43)», as the engine's [**43**](#n_43);
 * - renames images whose ids are not file names (`p002.png_1` → `p002_1.png`);
 * - marks luck checks: «ПРОВЕРЬТЕ СВОЮ УДАЧУ» with two links gets success = the first, failure =
 *   the second; the checks with a choice of ways are marked from LUCK_BY_HAND.
 * Run it with `npm run import:shelton` (import.ts).
 */

import { convertFb2, decodeFb2, verifyFile } from '../fb2'
import type { Fb2Book } from '../fb2'

/**
 * The one FB2 this importer is written for, known by its checksum and size. Another file is
 * refused unless forced.
 */
export const KNOWN_FB2 = { md5: 'eaf182fbf0d6a79ffc5e77e9a3f06060', bytes: 2221775 } as const

export const verifyFb2 = (bytes: Uint8Array) => verifyFile(bytes, KNOWN_FB2)

/** Luck checks whose outcomes are not simply «first link, second link» */
export const LUCK_BY_HAND: Readonly<Record<string, { success: string[]; failure: string[] }>> = {
  // «Если вам повезло, — 139, если нет, — можете либо перейти к правому сундуку ... 43, либо уплыть прочь 508»
  474: { success: ['139'], failure: ['43', '508'] }
}

const LUCK_CHECK = /ПРОВЕРЬТЕ СВОЮ УДАЧУ/i

/** `p002.png_1` → `p002_1.png`; a proper file name stays as it is */
export const imageFileName = (id: string) => id.replace(/^(.+)\.(png|jpe?g|gif)_(\d+)$/i, '$1_$3.$2')

/** «(43)» links → [**43**](#n_43), the form the engine and book:check read */
export const normalizeLinks = (text: string) => text.replace(/\[\((\d+)\)\]\(#n_(\d+)\)/g, '[**$1**](#n_$2)')

export const addLuckMarkers = (sections: Record<string, string>) => {
  const unclear: string[] = []
  const marked = Object.fromEntries(Object.entries(sections).map(([id, text]) => {
    if (!LUCK_CHECK.test(text)) return [id, text]
    const byHand = LUCK_BY_HAND[Number(id)]
    const links = [...text.slice(text.search(LUCK_CHECK)).matchAll(/\(#n_(\d+)\)/g)].map(match => match[1]!)
    const outcome = byHand ?? (links.length === 2 ? { success: [links[0]!], failure: [links[1]!] } : undefined)
    if (!outcome) {
      unclear.push(id)
      return [id, text]
    }
    const markers = [
      '<!-- DICE_ROLL_REQUIRED: luck -->',
      `<!-- LUCK_SUCCESS_LINK: ${outcome.success.join(', ')} -->`,
      `<!-- LUCK_FAILURE_LINK: ${outcome.failure.join(', ')} -->`
    ]
    return [id, `${markers.join('\n')}\n\n${text}`]
  }))
  return { sections: marked, unclear }
}

export const convertShelton = (bytes: Uint8Array) => {
  const book = convertFb2(decodeFb2(bytes))
  const renames = Object.keys(book.images).filter(id => imageFileName(id) !== id)
  const fix = (text: string) => renames.reduce(
    (out, id) => out.replaceAll(`/static/${id})`, `/static/${imageFileName(id)})`),
    normalizeLinks(text)
  )
  const sections = Object.fromEntries(Object.entries(book.sections).map(([id, text]) => [id, fix(text)]))
  const images: Fb2Book['images'] = Object.fromEntries(Object.entries(book.images).map(([id, image]) => [imageFileName(id), image]))
  return {
    ...book,
    preface: fix(book.preface),
    images,
    coverId: book.coverId && imageFileName(book.coverId),
    ...addLuckMarkers(sections)
  }
}
