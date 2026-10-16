import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

/** Responses smaller than this are not worth the CPU or the extra header */
const MIN_BYTES = 1024

const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml)|image\/svg\+xml)/

/** The client's preferred encoding we can produce, or null */
const pickEncoding = (accept: string): 'br' | 'gzip' | null => {
  const offered = accept.toLowerCase().split(',').map(part => part.trim().split(';'))
  const allows = (name: string) => offered.some(([token, q]) => token === name && q?.trim() !== 'q=0')
  if (allows('br')) return 'br'
  if (allows('gzip')) return 'gzip'
  return null
}

const isPlainData = (value: unknown) =>
  Array.isArray(value) || (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype)

/**
 * Compresses dynamic responses (server-rendered pages, the section API) with brotli or gzip.
 * Static files are precompressed at build time (`nitro.compressPublicAssets`) and served as is.
 */
export default defineNitroPlugin((nitroApp) => {
  if (import.meta.dev) return

  nitroApp.hooks.hook('beforeResponse', (event, response) => {
    const res = event.node.res
    if (res.headersSent || res.getHeader('content-encoding') || event.method === 'HEAD') return

    let body: string
    let type = String(res.getHeader('content-type') ?? '')
    if (typeof response.body === 'string') {
      body = response.body
      type ||= 'text/html; charset=utf-8'
    } else if (isPlainData(response.body)) {
      body = JSON.stringify(response.body)
      type = 'application/json; charset=utf-8'
    } else {
      return
    }

    // Vary is needed even when the body ends up uncompressed, so caches keep the variants apart
    appendResponseHeader(event, 'vary', 'Accept-Encoding')
    const encoding = pickEncoding(getRequestHeader(event, 'accept-encoding') ?? '')
    if (!encoding || Buffer.byteLength(body) < MIN_BYTES || !COMPRESSIBLE.test(type)) return

    const compressed = encoding === 'br'
      // Quality 5 keeps per-request cost low; static assets get the maximum at build time
      ? brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5, [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT } })
      : gzipSync(body, { level: 6 })

    res.setHeader('content-type', type)
    res.setHeader('content-encoding', encoding)
    res.removeHeader('content-length')
    response.body = compressed
  })
})
