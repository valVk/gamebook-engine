import type { DiceFormula } from './dice'
import { createLuck } from './luck'
import type { LuckDefinition, LuckSystem } from './luck'
import type { CombatEffect, EndingKind, SectionRules } from './rules'
import type { EnemyBlockWords } from '../utils/sectionContent'

/** What an item does besides sitting in the backpack */
export interface ItemDefinition {
  /** The name the player sees */
  name: string
  /** ЛОВКОСТЬ change while carried (armour, a poor weapon); given back when it leaves the backpack */
  agility?: number
  /** A real weapon: taking one throws away the items marked `replacedByWeapon` */
  weapon?: boolean
  /** СИЛА a sword wound costs the enemy with this weapon (default 2) */
  damage?: number
  /** Thrown away as soon as a `weapon` is taken (a makeshift blade) */
  replacedByWeapon?: boolean
  /** The player cannot simply drop it from the sheet */
  kept?: boolean
  /** Subtracted from the enemy's attack in sword fights (armour) */
  enemyAttackPenalty?: number
  /** СИЛА lost each day it is carried (charged with every meal, the book's day marker) */
  dailyStrength?: number
  /** Added to the reader's skill in sword fights while carried («в бою это оружие добавит вам 1 МАСТЕРСТВО») */
  fightSkill?: number
  /** Thrown once in a fight: the enemy loses this much at once, and the item is gone (a harpoon) */
  strike?: number
}

/**
 * A code the reader carries: a spell, an ally to call, an item's power. The book says
 * "прибавьте N к номеру параграфа": `add` is that N
 */
export interface SpellDefinition {
  name: string
  add?: number
  /** Usable only while this item is carried (a figurine in the pocket, a rusty sword) */
  item?: string
  /** The button that uses it: «Позвать Филина» (default «Произнести заклятие») */
  action?: string
}

/** How a stat is named: alone on the sheet (`name`) and after a number (`of`: "−2 СИЛЫ") */
export interface StatLabel {
  name: string
  of: string
  /** Abbreviation for the narrow status bar (ЛОВК.); defaults to `name` */
  short?: string
  /** The name on the Листок when it is too long for a cell, with a soft hyphen: 'ВЫНОС\u00ADЛИВОСТЬ' */
  sheet?: string
}

/** The stats every book has; a book may rename them (МАСТЕРСТВО, ВЫНОСЛИВОСТЬ) */
export type CoreStat = 'agility' | 'strength' | 'gold' | 'food' | 'luck'

export type { DiceFormula } from './dice'
export type { LuckDefinition } from './luck'

/**
 * A stat of this book beyond the shared core (СИЛА, ЛОВКОСТЬ, gold, food, УДАЧА):
 * ОБАЯНИЕ, Сила мысли, ЧЕСТЬ...
 */
export interface AttributeDefinition {
  label: StatLabel
  /** Starting value when the creation table does not roll it */
  start?: number
  min?: number
  max?: number
  /** Where the Листок shows it: a circled value in the top row, or a plain cell beside money and food */
  sheet: 'circle' | 'cell'
  /** Tested by `charismaTest`: 2d6 not above it succeeds and raises it by 1, failure lowers it by 1 */
  tested?: boolean
  /** `clock`: the value is minutes, shown as 3:40 */
  format?: 'clock'
  /** Shown on the Листок only once this section has been visited (a clock that starts mid-book) */
  visibleAfter?: string
  /** Hidden again once this section has been visited (the clock's part of the book is over) */
  visibleUntil?: string
  /** On outcome cards: emblem, titles for a gain and a loss, and how much a change matters */
  card?: { icon: string; titles: [gain: string, loss: string]; weight: number }
}

/** How a character is made and what it carries at the start */
export interface CharacterDefinition<Attribute extends string = string> {
  /** 2d6 sum → starting ЛОВКОСТЬ, СИЛА and any rolled attributes. Give either `table` or `roll` */
  table?: Readonly<Record<number, { agility: number; strength: number } & Partial<Record<Attribute, number>>>>
  /** Each stat rolled by its own formula: `{ agility: '1d6+6', strength: '2d6+12' }` */
  roll?: Readonly<{ agility: DiceFormula; strength: DiceFormula } & Partial<Record<Attribute, DiceFormula>>>
  /** The book's own names for the core stats (default ЛОВКОСТЬ, СИЛА, золото, ЕДА) */
  labels?: Readonly<Partial<Record<CoreStat, StatLabel>>>
  attributes: Readonly<Record<Attribute, AttributeDefinition>>
  /** The attribute a telepathic ('mind') fight uses, and that its `reward` raises */
  mindSkill?: Attribute
  gold: number
  food: number
  /** СИЛА one portion of food restores */
  foodRestores: number
  /** What the reader starts with, shown when the character is made */
  kit: string
  /** The Листок's line for an empty backpack (default «пусто») */
  emptyBag?: string
}

/**
 * When a stat runs low at certain sections, the book sends the reader elsewhere: «если до истечения
 * времени останется меньше 15 минут ... отправиться на параграф 220»
 */
export interface Deadline {
  stat: string
  /** Applies when the stat is below this on arrival at one of `on` */
  below: number
  on: readonly string[]
  section: string
  /** Title of the card that explains it */
  title: string
}

/** A misprint corrected when the section is served (the file stays as printed) */
export interface Misprint {
  from: string
  to: string
}

/**
 * Everything the engine needs to know about one book, written by the book's pack
 * (books/<id>/book.ts) with `defineBook`.
 */
export interface BookDefinition<Stat extends string = string, Item extends string = string, Spell extends string = string, Attribute extends string = string> {
  /** Folder name and URL segment */
  id: string
  title: string
  author: string
  year: number
  /** One or two sentences under the title: the premise, in the book's voice */
  lede: string
  /** The cover in the pack's public/ folder, with its size (served at /books/<id>/<file>) */
  cover?: { file: string; width: number; height: number }
  /** Where the rules start in preface.md; the title lines before it are replaced by the title page */
  rulesHeading?: string
  /** The line on the victory card */
  victoryLine?: string
  /** Imprint and footer text for a book that is not someone else's copyright (a demo, your own book) */
  imprint?: { full: string[]; short: string }
  /** Where saves of this book were kept before the library existed; moved to the book's own key once */
  legacySaveKey?: string
  /** The first section of the adventure */
  start: string
  character: CharacterDefinition<Attribute>
  /** How УДАЧА works: six squares (the default) or a score (shared/engine/luck.ts) */
  luck?: LuckDefinition
  /** How an attack is rolled: one die doubled («Повелитель», the default) or two dice summed */
  combat?: { attack: 'doubled' | 'sum' }
  /** Section rules from the text (fights are given separately in `combats`) */
  rules: Readonly<Record<string, SectionRules<Stat, Item, Spell>>>
  /** Fights from the enemy stat blocks; appended last to their section's effects */
  combats: Readonly<Record<string, CombatEffect>>
  items: Readonly<Record<Item, ItemDefinition>>
  /** Codes: a name alone, or with the number it adds to the section and the item it needs */
  spells: Readonly<Record<Spell, string | SpellDefinition>>
  /** Sections without links that are not deaths */
  endings: Readonly<Record<string, Exclude<EndingKind, 'death'>>>
  /** Reference sections read "не закрывая этого параграфа": shown in a modal, never an ending */
  peek: readonly string[]
  misprints?: Readonly<Record<string, readonly Misprint[]>>
  deadlines?: readonly Deadline[]
  /** The section whose purchases count for `purchases` conditions */
  shop?: string
}

/** Identity helper: lets a pack declare its own stat, item and spell ids and get them checked */
export const defineBook = <Stat extends string, Item extends string, Spell extends string, Attribute extends string>(
  definition: BookDefinition<Stat, Item, Spell, Attribute>
) => definition

/** A book ready for the engine: the definition plus the lookups derived from it */
export interface Book extends BookDefinition {
  /** Text rules plus each section's fight (if any), which always comes last */
  sectionRules: Readonly<Record<string, SectionRules>>
  getSectionRules: (section: string) => SectionRules
  isPeek: (section: string) => boolean
  endingKind: (section: string) => EndingKind
  correctMisprints: (section: string, content: string) => string
  itemName: (item: string) => string
  /** The item id for a name in the backpack, if the book knows it */
  itemId: (name: string) => string | undefined
  item: (item: string) => ItemDefinition | undefined
  /** Names of the items with a property, e.g. every `weapon` */
  itemNamesWhere: (test: (item: ItemDefinition) => boolean) => string[]
  spellName: (spell: string) => string
  spell: (spell: string) => SpellDefinition
  /** Where using a code (castSpell) in `section` leads: its `target`, or the section plus the codes' numbers */
  /** How the book words a code's number: «прибавьте 101 к номеру параграфа», «вычтите 50 из номера параграфа» */
  codeInstruction: (spell: string) => string | undefined
  castTarget: (section: string, effect: { spell: string; with?: readonly string[]; target?: string }) => string | undefined
  /** How a stat reads (core stats and the book's attributes) */
  statLabel: (stat: string) => StatLabel
  /** Attributes in the order the book lists them */
  attributeIds: string[]
  /** The attribute `charismaTest` uses, if the book has one */
  testedAttribute?: string
  /** How the book's enemy stat blocks read: «Ловкость 7 Сила 6», «Мастерство 10 Выносливость 8» */
  enemyWords: EnemyBlockWords
  /** The book's luck system (the strategy every luck rule goes through) */
  luckSystem: LuckSystem
  /** The stats character creation rolls: ЛОВКОСТЬ and СИЛА first, then the book's rolled attributes */
  rolledStats: string[]
}

/** A stat name inside a sentence: «Ловкость», «Мастерство» */
export const sentenceCase = (text: string) =>
  text.charAt(0).toLocaleUpperCase('ru') + text.slice(1).toLocaleLowerCase('ru')

/** Default names of the core stats, shared by most books of this family */
const CORE_LABELS: Record<CoreStat, StatLabel> = {
  strength: { name: 'СИЛА', of: 'СИЛЫ' },
  agility: { name: 'ЛОВКОСТЬ', of: 'ЛОВКОСТИ', short: 'ЛОВК.' },
  gold: { name: 'золото', of: 'золотых' },
  food: { name: 'ЕДА', of: 'ЕДЫ' },
  luck: { name: 'УДАЧА', of: 'УДАЧИ' }
}

export const createBook = (definition: BookDefinition): Book => {
  const { rules, combats, items, spells, endings, misprints = {} } = definition
  const { table, roll, labels = {}, attributes } = definition.character
  if (!table === !roll) throw new Error(`${definition.id}: character needs exactly one of \`table\` or \`roll\``)
  const coreLabels: Record<string, StatLabel> = { ...CORE_LABELS, ...labels }
  const rolled = Object.keys(roll ?? Object.values(table ?? {})[0] ?? {})
  const sectionRules: Record<string, SectionRules> = Object.fromEntries(
    [...new Set([...Object.keys(rules), ...Object.keys(combats)])].sort().map((id) => {
      const text = rules[id] ?? {}
      const combat = combats[id]
      return [id, combat ? { ...text, effects: [...(text.effects ?? []), combat] } : text]
    })
  )
  const peek = new Set(definition.peek)
  const spellOf = (spell: string): SpellDefinition => {
    const value = (spells as Record<string, string | SpellDefinition | undefined>)[spell]
    return typeof value === 'string' ? { name: value } : value ?? { name: spell }
  }
  const byName = new Map(Object.entries(items).map(([id, item]) => [item.name, id]))

  return {
    ...definition,
    sectionRules,
    getSectionRules: section => sectionRules[section] ?? {},
    isPeek: section => peek.has(section),
    endingKind: section => endings[section] ?? 'death',
    correctMisprints: (section, content) =>
      (misprints[section] ?? []).reduce((text, { from, to }) => text.replace(from, to), content),
    itemName: item => items[item]?.name ?? item,
    itemId: name => byName.get(name),
    item: item => items[item],
    itemNamesWhere: test => Object.values(items).filter(test).map(item => item.name),
    spellName: spell => spellOf(spell).name,
    spell: spellOf,
    codeInstruction: (spell) => {
      const add = spellOf(spell).add
      if (add === undefined) return undefined
      return add >= 0 ? `прибавьте ${add} к номеру параграфа` : `вычтите ${-add} из номера параграфа`
    },
    castTarget: (section, effect) => {
      if (effect.target) return effect.target
      const adds = [effect.spell, ...(effect.with ?? [])].map(id => spellOf(id).add)
      if (adds.some(add => add === undefined)) return undefined
      return String(Number(section) + adds.reduce((a: number, b) => a + b!, 0)).padStart(3, '0')
    },
    statLabel: stat => coreLabels[stat] ?? attributes[stat]?.label ?? { name: stat, of: stat },
    attributeIds: Object.keys(attributes),
    testedAttribute: Object.entries(attributes).find(([, attribute]) => attribute.tested)?.[0],
    enemyWords: {
      sword: sentenceCase(coreLabels.agility!.name),
      strength: sentenceCase(coreLabels.strength!.name),
      ...(definition.character.mindSkill ? { mind: sentenceCase(attributes[definition.character.mindSkill]?.label.name ?? '') } : {})
    },
    luckSystem: createLuck(definition.luck),
    rolledStats: ['agility', 'strength', ...Object.keys(attributes).filter(id => rolled.includes(id))]
  }
}
