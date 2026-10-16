/**
 * «Повелитель Безбрежной Пустыни»: its known FB2 → the pack's sections.
 *
 * Dedicated to that file: one <section id="n_123"> per paragraph (numeric <title>), links as
 * <a l:href="#n_123">, enemy stat blocks as <subtitle> + <cite><subtitle>Ловкость N Сила N</subtitle></cite>,
 * the cover, the stats table and the Листок as <binary> images. Output matches the pack's
 * markdown exactly (checked 2026-10-15: all 631 sections, luck markers included).
 * Run it with `npm run import:povelitel` (import.ts).
 */

import { verifyFile } from '../fb2'

export { convertFb2, decodeFb2, imageSize, md5, parseXml } from '../fb2'
export type { Fb2Book, Fb2Node } from '../fb2'

/**
 * The one FB2 this importer is written for, known by its checksum and size (FB2 document by AV,
 * 2013, version 1.0). Another file, even another edition of the same book,
 * may be split or marked differently, so it is refused unless forced.
 */
export const KNOWN_FB2 = { md5: '6109bc522627ffda9f611b28402dd569', bytes: 503416 } as const

/** Whether `bytes` is the known FB2, with its checksum for the message */
export const verifyFb2 = (bytes: Uint8Array) => verifyFile(bytes, KNOWN_FB2)

/**
 * Luck markers the engine reads (docs/AUTHORING.md): a section that says «ПРОВЕРЬТЕ СВОЮ УДАЧУ»
 * with exactly two links gets success = the first, failure = the second; luck restoration gets its
 * marker. Sections with anything less clear are returned for a human to mark.
 */
export const addLuckMarkers = (sections: Record<string, string>) => {
  const unclear: string[] = []
  const marked = Object.fromEntries(Object.entries(sections).map(([id, text]) => {
    const markers: string[] = []
    if (/ПРОВЕРЬТЕ СВОЮ УДАЧУ/i.test(text)) {
      const sentence = text.slice(text.search(/ПРОВЕРЬТЕ СВОЮ УДАЧУ/i))
      const links = [...sentence.matchAll(/\(#n_(\d+)\)/g)].map(match => match[1]!)
      if (links.length === 2) {
        markers.push('<!-- DICE_ROLL_REQUIRED: luck -->', `<!-- LUCK_SUCCESS_LINK: ${links[0]} -->`, `<!-- LUCK_FAILURE_LINK: ${links[1]} -->`)
      } else {
        unclear.push(id)
      }
    } else if (/почистить один из квадратов УДАЧИ/i.test(text)) {
      markers.push('<!-- LUCK_RESTORATION: true -->', '<!-- DICE_ROLL_REQUIRED: luck_restoration -->')
    } else if (/считайте, что Удача отвернулась от вас/i.test(text)) {
      // 213: the next luck check fails (applied by the rules; the marker shows it on the debug page)
      markers.push('<!-- LUCK_PENALTY: true -->', '<!-- NEXT_LUCK_CHECK_FAILS: true -->')
    }
    return [id, markers.length ? `${markers.join('\n')}\n\n${text}` : text]
  }))
  return { sections: marked, unclear }
}
