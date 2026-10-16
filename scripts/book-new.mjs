#!/usr/bin/env node
/**
 * Start a new book pack: npm run book:new <id>
 * Creates <first BOOKS_DIR folder>/<id>/ with a manifest, an empty rules registry, two sections
 * and a check test. See docs/AUTHORING.md for what goes where.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { delimiter, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const id = process.argv[2]

if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error('Usage: npm run book:new <id>   (lowercase latin letters, digits and dashes, e.g. shpaga)')
  process.exit(1)
}

const configured = process.env.BOOKS_DIR ?? 'books'
const dir = join(resolve(root, configured.split(delimiter)[0]), id)
if (existsSync(dir)) {
  console.error(`${dir} already exists`)
  process.exit(1)
}

const files = {
  'book.ts': `import type { BookDefinition } from '#shared/engine/book'
import { COMBATS, RULES } from './rules'
import type { ItemId, SpellId, Stat } from './rules'

/**
 * The book's manifest: everything the engine needs to know about it (docs/AUTHORING.md).
 * Loaded at runtime: import only types from the engine.
 */
export default {
  id: '${id}',
  title: 'Название книги',
  author: 'Автор',
  year: 1993,
  lede: 'Одна-две фразы о завязке, голосом книги.',
  // A cover in public/, e.g. { file: 'cover.jpg', width: 300, height: 372 }
  cover: undefined,
  rulesHeading: 'ПРАВИЛА ИГРЫ',
  victoryLine: 'Миссия выполнена.',
  start: '001',
  character: {
    // 2d6 sum -> starting ЛОВКОСТЬ, СИЛА and the attributes the table rolls
    table: Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(sum => [sum, { agility: 10, strength: 18, charisma: 7 }])),
    attributes: {
      charisma: { label: { name: 'ОБАЯНИЕ', of: 'ОБАЯНИЯ' }, min: 1, max: 12, sheet: 'cell', tested: true }
    },
    gold: 15,
    food: 3,
    foodRestores: 4,
    kit: 'С собой у вас меч, три порции ЕДЫ и 15 золотых.'
  },
  rules: RULES,
  combats: COMBATS,
  items: {
    rope: { name: 'Моток веревки' }
  },
  spells: {},
  // Sections without links that are not deaths: { '400': 'victory', '123': 'captured', '321': 'survived' }
  endings: {},
  // Reference pages read "не закрывая этого параграфа"
  peek: []
} satisfies BookDefinition<Stat, ItemId, SpellId, 'charisma'>
`,
  'rules.ts': `/**
 * Every mechanical instruction in the text, per section, with an exact quote (\`source\`).
 * Rule kinds: shared/engine/rules.ts. Guide: docs/AUTHORING.md.
 */
import type { CombatEffect, SectionEffect, SectionRules } from '#shared/engine/rules'

export type Stat = 'strength' | 'agility' | 'gold' | 'food'
export type ItemId = 'rope'
export type SpellId = never

type Rules = SectionRules<Stat, ItemId, SpellId>

const strength = (amount: number, source: string): SectionEffect<Stat, ItemId, SpellId> =>
  ({ kind: 'change', stat: 'strength', amount, source })

export const RULES: Readonly<Record<string, Rules>> = {
  '002': { effects: [strength(-2, 'потеряйте 2 СИЛЫ')] }
}

/** Fights, one per section with an enemy stat block ("> ##### Ловкость 8 Сила 10") */
export const COMBATS: Readonly<Record<string, CombatEffect>> = {}
`,
  'sections/preface.md': `# НАЗВАНИЕ КНИГИ

# ПРАВИЛА ИГРЫ

Правила из книги.

Теперь переверните страницу.
`,
  'sections/001.md': `Первый параграф. Пойдете налево ([**2**](#n_2))?
`,
  'sections/002.md': `Камень срывается со склона: потеряйте 2 СИЛЫ. Здесь ваш путь окончен.
`,
  'tests/check.test.ts': `import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkBook, reportErrors } from '#shared/engine/check'
import { findBook } from '#shared/engine/library'
import { readSections } from '#shared/engine/readSections'

describe('${id} against its text', () => {
  it('has no errors', () => {
    expect(reportErrors(checkBook(findBook('${id}')!, readSections(join(__dirname, '..'))))).toEqual([])
  })
})
`,
  'public/.gitkeep': ''
}

for (const [name, content] of Object.entries(files)) {
  mkdirSync(join(dir, name, '..'), { recursive: true })
  writeFileSync(join(dir, name), content)
}

console.log(`Created ${dir}
Next:
  1. Put the sections in ${join(dir, 'sections')} (001.md ..., preface.md)
  2. Fill in book.ts and register the rules in rules.ts (docs/AUTHORING.md)
  3. npm run book:check ${id}
  4. npm run dev, then open /${id}`)
