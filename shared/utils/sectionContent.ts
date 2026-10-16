export type DiceRollType = 'luck' | 'luck_restoration' | 'charisma' | 'combat'

export interface CombatEnemy {
  name: string | null
  /** 'sword' uses the book's ЛОВКОСТЬ (МАСТЕРСТВО), 'mind' its mind skill (Сила мысли: a telepathic duel) */
  type: 'sword' | 'mind'
  skill: number
  strength: number
}

export interface DiceRollMetadata {
  required?: DiceRollType
  /** The first link of each outcome; `successLinks`/`failureLinks` hold all of them */
  successLink?: string
  failureLink?: string
  /** A luck outcome may offer a choice: `<!-- LUCK_FAILURE_LINK: 43, 508 -->` */
  successLinks?: string[]
  failureLinks?: string[]
  hasLuckCheck: boolean
  hasLuckRestoration: boolean
  hasLuckPenalty: boolean
  hasCharisma: boolean
  hasCombat: boolean
  enemies: CombatEnemy[]
}

const SECTION_ID_PATTERN = /^\d{1,3}$/

/**
 * Map a request slug to a file name inside the sections directory.
 * Returns null for anything that is not `preface` or a 1-3 digit section number,
 * which rules out path traversal and arbitrary file reads.
 */
export function resolveSectionFileName(slug: string | undefined | null): string | null {
  if (!slug) return null
  if (slug === 'preface') return 'preface.md'
  if (!SECTION_ID_PATTERN.test(slug)) return null
  return `${slug.padStart(3, '0')}.md`
}

/** True when the section contains at least one navigation link to another section. */
export function hasSectionLinks(content: string): boolean {
  return /\]\(#n_\d+\)/.test(content) || /<a[^>]+href\s*=\s*["']#n_\d+["']/i.test(content)
}

/** The words an enemy stat block uses, as the book prints them («Ловкость», «Мастерство»...) */
export interface EnemyBlockWords {
  /** The skill of a sword fight */
  sword: string
  /** The skill of a duel of minds, if the book has one */
  mind?: string
  /** The stat wounds take away */
  strength: string
}

/** «Повелитель Безбрежной Пустыни»: `Ловкость 7 Сила 6`, `Сила мысли 8 Сила 10` */
export const DEFAULT_ENEMY_WORDS: EnemyBlockWords = { sword: 'Ловкость', mind: 'Сила мысли', strength: 'Сила' }

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const patterns = new Map<string, RegExp>()

/**
 * Enemy stat blocks are quoted headings, optionally preceded by a name heading:
 *   ##### ВОЛК
 *   > ##### Ловкость 7 Сила 6
 * The two numbers may also sit in two quoted headings, and anything may follow them
 * ("Выносливость 10 минус потери от ран").
 */
const enemyBlockPattern = (words: EnemyBlockWords) => {
  const key = JSON.stringify(words)
  let pattern = patterns.get(key)
  if (!pattern) {
    // The longer word first: «Сила мысли» must not be read as «Сила»
    const kinds = [words.sword, words.mind].filter((word): word is string => !!word).sort((a, b) => b.length - a.length).map(escape)
    pattern = new RegExp(
      `(?:^#+[ \\t]+(?<name>[^\\n]+)\\n+)?^>[ \\t]*#+[ \\t]*(?<kind>${kinds.join('|')})[ \\t]+(?<skill>\\d+)`
      + `(?:[ \\t]+|[ \\t]*\\n+>[ \\t]*#*[ \\t]*)${escape(words.strength)}[ \\t]+(?<strength>\\d+)`,
      'gmiu'
    )
    patterns.set(key, pattern)
  }
  pattern.lastIndex = 0
  return pattern
}

export function parseEnemies(content: string, words: EnemyBlockWords = DEFAULT_ENEMY_WORDS): CombatEnemy[] {
  const sword = words.sword.toLocaleLowerCase('ru')
  return [...content.matchAll(enemyBlockPattern(words))].map(match => ({
    name: match.groups?.name?.trim() || null,
    type: match.groups?.kind?.toLocaleLowerCase('ru') === sword ? 'sword' : 'mind',
    skill: Number(match.groups?.skill),
    strength: Number(match.groups?.strength)
  }))
}

/** Read mechanics metadata from HTML comment markers, falling back to text detection. */
export function parseDiceRollMetadata(content: string, words: EnemyBlockWords = DEFAULT_ENEMY_WORDS): DiceRollMetadata {
  const enemies = parseEnemies(content, words)
  const metadata: DiceRollMetadata = {
    hasLuckCheck: /ПРОВЕР(?:ЬТЕ|ИТЬ) СВОЮ УДАЧУ/i.test(content),
    hasLuckRestoration: /<!-- LUCK_RESTORATION: true -->/.test(content),
    hasLuckPenalty: /<!-- NEXT_LUCK_CHECK_FAILS: true -->/.test(content),
    hasCharisma: /Проверьте свое ОБАЯНИЕ/i.test(content),
    hasCombat: enemies.length > 0,
    enemies
  }

  const required = content.match(/<!-- DICE_ROLL_REQUIRED: (\w+) -->/)?.[1]
  if (required === 'luck' || required === 'luck_restoration' || required === 'charisma' || required === 'combat') {
    metadata.required = required
  }

  const linkList = (marker: string) => content.match(new RegExp(`<!-- ${marker}: (\\d+(?:\\s*,\\s*\\d+)*) -->`))?.[1]?.split(/\s*,\s*/)

  const successLinks = linkList('LUCK_SUCCESS_LINK')
  if (successLinks) Object.assign(metadata, { successLink: successLinks[0], successLinks })

  const failureLinks = linkList('LUCK_FAILURE_LINK')
  if (failureLinks) Object.assign(metadata, { failureLink: failureLinks[0], failureLinks })

  // Explicit markers take priority over text detection
  if (metadata.required === 'luck') metadata.hasLuckCheck = true
  if (metadata.required === 'luck_restoration') metadata.hasLuckRestoration = true
  if (metadata.required === 'charisma') metadata.hasCharisma = true
  if (metadata.required === 'combat') metadata.hasCombat = true

  return metadata
}
