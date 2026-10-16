import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml'
}

/** A pack's images (cover, illustrations) from its public/ folder: /books/<book>/<file> */
export default defineEventHandler(async (event) => {
  const pack = await packFromEvent(event)
  const publicDir = join(pack.dir, 'public')
  const path = normalize(join(publicDir, getRouterParam(event, 'file') ?? ''))
  const type = TYPES[extname(path).toLowerCase()]
  if (!path.startsWith(publicDir + sep) || !type) throw createError({ statusCode: 404 })

  try {
    if (!(await stat(path)).isFile()) throw new Error('not a file')
  } catch {
    throw createError({ statusCode: 404 })
  }
  setResponseHeaders(event, { 'content-type': type, 'cache-control': 'public, max-age=604800' })
  return readFile(path)
})
