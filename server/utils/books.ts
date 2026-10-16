import type { Pack } from './packs'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { H3Event } from 'h3'

/** The pack named in the route (`/api/books/<book>/...`); unknown ids are a 404 */
export const packFromEvent = async (event: H3Event) => {
  const pack = (await getPacks()).get(getRouterParam(event, 'book') ?? '')
  if (!pack) throw createError({ statusCode: 404, message: 'Такой книги нет' })
  return pack
}

/** A section file of a pack as printed, or null */
export const readSection = async (pack: Pack, fileName: string) => {
  try {
    return await readFile(join(pack.dir, 'sections', fileName), 'utf-8')
  } catch {
    return null
  }
}

/** Every section file of a pack: { '001': markdown, ..., preface: markdown } */
export const readAllSections = async (pack: Pack) => {
  const files = (await readdir(join(pack.dir, 'sections'))).filter(file => /^(\d{3}|preface)\.md$/.test(file))
  return Object.fromEntries(await Promise.all(files.map(async file =>
    [file.slice(0, -3), (await readSection(pack, file)) ?? ''] as const)))
}
