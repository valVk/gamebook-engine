/**
 * FB2 → pack markdown, shared by the book importers (importers/<book>/). Each importer is
 * dedicated to one known file; this is only the conversion they have in common: one numbered
 * <section> per paragraph, links as [**N**](#n_N), <subtitle> as `#####`, <cite> as quotes,
 * images as /static/<id>, everything else into the preface.
 */

import { createHash } from 'node:crypto'

export const md5 = (bytes: Uint8Array) => createHash('md5').update(bytes).digest('hex')

/** A known file: its checksum and size */
export interface KnownFile {
  md5: string
  bytes: number
}

/** Whether `bytes` is the `known` file, with its checksum for the message */
export const verifyFile = (bytes: Uint8Array, known: KnownFile) => {
  const actual = md5(bytes)
  return { ok: actual === known.md5, md5: actual, bytes: bytes.byteLength }
}

export interface Fb2Node {
  name: string
  attrs: Record<string, string>
  children: (Fb2Node | string)[]
}

export interface Fb2Book {
  title: string
  author: string
  year?: number
  annotation?: string
  coverId?: string
  /** Numbered sections, padded id ('001') → markdown */
  sections: Record<string, string>
  /** Everything before and between numbered sections that is not one of them (rules, preface) */
  preface: string
  /** Embedded images by id (file name) */
  images: Record<string, { type: string; data: Buffer }>
  warnings: string[]
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ' }

const decodeEntities = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1]?.toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1))
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return ENTITIES[entity] ?? match
  })

/** FB2 files often declare windows-1251 but are saved as UTF-8; trust the bytes first */
export const decodeFb2 = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    const head = new TextDecoder('latin1').decode(bytes.slice(0, 200))
    const declared = head.match(/encoding="([^"]+)"/i)?.[1] ?? 'windows-1251'
    return new TextDecoder(declared).decode(bytes)
  }
}

/** A minimal XML tree: elements, attributes (namespace prefixes dropped) and text */
export const parseXml = (xml: string): Fb2Node => {
  const root: Fb2Node = { name: '#root', attrs: {}, children: [] }
  const stack = [root]
  const tokens = xml.replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>/g, '').matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([\w:.-]+)([^>]*?)(\/?)>|([^<]+)/g)
  for (const [, cdata, closing, rawName, rawAttrs, selfClosing, text] of tokens) {
    const top = stack[stack.length - 1]!
    if (cdata !== undefined) {
      top.children.push(cdata)
    } else if (text !== undefined) {
      top.children.push(decodeEntities(text))
    } else if (closing) {
      if (stack.length > 1) stack.pop()
    } else {
      const name = rawName!.replace(/^\w+:/, '')
      const attrs: Record<string, string> = {}
      for (const [, key, value] of rawAttrs!.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) {
        attrs[key!.replace(/^\w+:/, '')] = decodeEntities(value!)
      }
      const node: Fb2Node = { name, attrs, children: [] }
      top.children.push(node)
      if (!selfClosing) stack.push(node)
    }
  }
  return root
}

const isNode = (child: Fb2Node | string): child is Fb2Node => typeof child !== 'string'
const elements = (node: Fb2Node, name?: string) => node.children.filter(isNode).filter(child => !name || child.name === name)
const find = (node: Fb2Node, name: string): Fb2Node | undefined => {
  for (const child of elements(node)) {
    if (child.name === name) return child
    const found = find(child, name)
    if (found) return found
  }
  return undefined
}
const textOf = (node: Fb2Node | string): string =>
  typeof node === 'string' ? node : node.children.map(textOf).join('')
const squash = (text: string) => text.replace(/[ \t\r\n]+/g, ' ').trim()

/** Inline content: text with **strong**, *emphasis*, links and inline images */
const inline = (node: Fb2Node | string, warnings: string[]): string => {
  if (typeof node === 'string') return node.replace(/[ \t\r\n]+/g, ' ')
  const inner = () => node.children.map(child => inline(child, warnings)).join('')
  switch (node.name) {
    case 'strong': return wrap(inner(), '**')
    case 'emphasis': return wrap(inner(), '*')
    case 'strikethrough': return wrap(inner(), '~~')
    case 'a': {
      const href = node.attrs.href ?? ''
      const label = squash(textOf(node))
      const section = href.match(/^#n_(\d+)$/)?.[1]
      if (section && label === section) return `[**${section}**](${href})`
      if (href.startsWith('#') && !section) return `[${label}](${href})`
      if (section) return `[${label}](${href})`
      return label // external links (the library's banner) are not part of the book
    }
    case 'image': return image(node)
    case 'sup': case 'sub': case 'style': case 'code': return inner()
    default:
      warnings.push(`inline <${node.name}> kept as text`)
      return inner()
  }
}

/** Markdown markers must hug the text: `**word** ` not `** word **` */
const wrap = (text: string, marker: string) => {
  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/)!
  return match[2] ? `${match[1]}${marker}${match[2]}${marker}${match[3]}` : text
}

const image = (node: Fb2Node) => {
  const id = (node.attrs.href ?? '').replace(/^#/, '')
  return id ? `![](/static/${id})` : ''
}

/** Block content of a section, as markdown paragraphs; `quote` prefixes lines inside <cite> */
const blocks = (node: Fb2Node, warnings: string[], options: { titles: boolean; quote?: boolean }): string[] => {
  const out: string[] = []
  const prefix = options.quote ? '> ' : ''
  for (const child of node.children) {
    if (typeof child === 'string') {
      if (child.trim()) out.push(prefix + squash(child))
      continue
    }
    switch (child.name) {
      case 'title':
        if (options.titles) out.push(...elements(child, 'p').map(p => `# ${squash(textOf(p))}`))
        break
      case 'p': {
        const text = squash(child.children.map(c => inline(c, warnings)).join(''))
        if (text) out.push(prefix + text)
        break
      }
      case 'subtitle':
        out.push(`${prefix}##### ${squash(child.children.map(c => inline(c, warnings)).join(''))}`)
        break
      case 'cite':
      case 'epigraph':
        out.push(...blocks(child, warnings, { ...options, quote: true }))
        break
      case 'text-author':
        out.push(`${prefix}*${squash(textOf(child))}*`)
        break
      case 'image':
        out.push(prefix + image(child))
        break
      case 'poem':
      case 'stanza':
        out.push(...blocks(child, warnings, options))
        break
      case 'v':
        out.push(prefix + squash(child.children.map(c => inline(c, warnings)).join('')))
        break
      case 'empty-line':
        break
      case 'section':
        out.push(...blocks(child, warnings, { titles: true }))
        break
      case 'table':
        warnings.push('a <table> was flattened to paragraphs')
        out.push(...elements(child).map(row => prefix + squash(textOf(row))))
        break
      default:
        warnings.push(`block <${child.name}> kept as text`)
        out.push(prefix + squash(textOf(child)))
    }
  }
  return out
}

/** "n_12" or a title that is just a number → '012'; anything else is not a numbered section */
const sectionNumber = (section: Fb2Node) => {
  const fromId = section.attrs.id?.match(/^n_(\d+)$/)?.[1]
  if (fromId) return fromId
  const title = find(section, 'title')
  const fromTitle = title ? squash(textOf(title)).match(/^(\d+)\.?$/)?.[1] : undefined
  return fromTitle
}

export function convertFb2(xml: string): Fb2Book {
  const warnings: string[] = []
  const tree = parseXml(xml)
  const fiction = find(tree, 'FictionBook') ?? tree
  const info = find(fiction, 'title-info')
  const authorNode = info ? find(info, 'author') : undefined
  const author = authorNode
    ? ['first-name', 'middle-name', 'last-name'].map(part => find(authorNode, part)).filter(Boolean).map(n => squash(textOf(n!))).join(' ')
    : ''
  const publish = find(fiction, 'publish-info')
  const yearText = (publish && find(publish, 'year') && textOf(find(publish, 'year')!)) || (info && find(info, 'date') && textOf(find(info, 'date')!)) || ''
  const coverImage = info && find(info, 'coverpage') ? find(find(info, 'coverpage')!, 'image') : undefined

  // The first <body> is the book; others hold notes and comments
  const body = elements(fiction, 'body')[0]
  if (!body) throw new Error('No <body> in the FB2 file')

  const sections: Record<string, string> = {}
  const preface: string[] = []
  const bodyTitle = elements(body, 'title')[0]
  if (bodyTitle) preface.push(...elements(bodyTitle, 'p').map(p => squash(textOf(p))).filter(Boolean), '')
  if (coverImage) preface.push(image(coverImage))

  const visit = (section: Fb2Node) => {
    const number = sectionNumber(section)
    if (number) {
      const id = number.padStart(3, '0')
      if (sections[id]) warnings.push(`section ${id} appears twice; the second copy was kept`)
      // Every paragraph, the last one included, is followed by a blank line (as in sections/*.md)
      sections[id] = blocks(section, warnings, { titles: false }).map(block => `${block}\n\n`).join('')
      return
    }
    // A section of numbered sections (a chapter wrapper): look inside
    const inner = elements(section, 'section')
    if (inner.length && inner.every(child => sectionNumber(child))) {
      inner.forEach(visit)
      return
    }
    const anchor = section.attrs.id ? `<a id="${section.attrs.id}"></a>\n\n` : ''
    preface.push(anchor + blocks(section, warnings, { titles: true }).join('\n\n'))
  }
  elements(body, 'section').forEach(visit)

  const images: Fb2Book['images'] = {}
  for (const binary of elements(fiction, 'binary')) {
    const id = binary.attrs.id
    if (!id) continue
    images[id] = { type: binary.attrs['content-type'] ?? 'application/octet-stream', data: Buffer.from(textOf(binary).replace(/\s+/g, ''), 'base64') }
  }

  return {
    title: info && find(info, 'book-title') ? squash(textOf(find(info, 'book-title')!)) : '',
    author,
    year: Number(yearText.match(/\d{4}/)?.[0]) || undefined,
    annotation: info && find(info, 'annotation') ? squash(textOf(find(info, 'annotation')!)) : undefined,
    coverId: coverImage?.attrs.href?.replace(/^#/, ''),
    sections,
    preface: `${preface.filter(part => part !== undefined).join('\n\n').replace(/\n{3,}/g, '\n\n').trim()}\n`,
    images,
    warnings: [...new Set(warnings)]
  }
}

/** Width and height of a PNG or JPEG, for the manifest's cover */
export const imageSize = (data: Buffer): { width: number; height: number } | undefined => {
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
  }
  if (data[0] === 0xFF && data[1] === 0xD8) {
    let offset = 2
    while (offset + 9 < data.length) {
      if (data[offset] !== 0xFF) return undefined
      const marker = data[offset + 1]!
      const length = data.readUInt16BE(offset + 2)
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) }
      }
      offset += 2 + length
    }
  }
  return undefined
}
