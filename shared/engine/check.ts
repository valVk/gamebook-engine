import { hasSectionLinks, parseDiceRollMetadata, parseEnemies } from '../utils/sectionContent'
import type { Book } from './book'
import { findQuote } from './quote'
import { isOutcomeEffect } from './rules'
import type { CombatEffect, SectionEffect } from './rules'

/**
 * Checks a book pack against its own text: what `npm run book:check` reports and what pack tests
 * assert. `sections` maps section ids ('001', 'preface') to the files' markdown as printed.
 */

export interface BookReport {
  sections: number
  reachable: string[]
  /** Sections no link (or spell) leads to from the start */
  unreachable: string[]
  /** "section -> target" for links to sections that do not exist */
  brokenLinks: string[]
  /** Rules whose `source` quote is not in their section's text */
  missingQuotes: { section: string; source: string }[]
  /** Rules registered for sections that do not exist */
  unknownSections: string[]
  /** Links named by rules (outcomes, conditions, costs, escapes) that the section does not contain */
  unknownLinks: { section: string; link: string }[]
  /** Fights that do not match the enemy stat blocks of their section */
  combatMismatches: string[]
  /** Sections with enemy stat blocks but no registered fight */
  unregisteredFights: string[]
  /** Endings or reference pages that have links, or link-less sections that are neither */
  endingProblems: string[]
  /** Misprints whose printed fragment is not in the text */
  staleMisprints: string[]
  /** Codes (castSpell) that lead nowhere, or whose `target` is not the section plus the code */
  codeProblems: string[]
  /** Sections whose text mentions mechanics (stats, dice, money, items) but have no rules or luck markers: review them */
  review: { section: string; words: string[] }[]
}

const linkTargets = (text: string) =>
  [...text.matchAll(/\(#n_(\d+)\)/g)].map(match => match[1]!.padStart(3, '0'))

/** Links a rule refers to, so they can be checked against the section's own links */
const ruleLinks = (effect: SectionEffect): string[] => {
  if (isOutcomeEffect(effect)) return [...effect.successLinks, ...effect.failureLinks]
  if (effect.kind === 'roll') return effect.escapeLinks ?? []
  if (effect.kind === 'rollBranch') return effect.branches.map(branch => branch.link)
  if (effect.kind === 'combat') return [...(effect.escapeLinks ?? []), ...(effect.loseLinks ?? [])]
  return []
}

/** Words that usually mean a mechanical instruction; the book's own stat names are added */
const mechanicalWords = (book: Book) => [
  /СИЛ[АЫУЕ]\b/, /ЛОВКОСТ/, /УДАЧ/, /\bЕД[АЫУЕ]\b|порци/, /золот/i, /кубик/i,
  /вычт|вычес|отним|прибав|восстанов|потеряйте|заплат/i,
  /если у вас (?:есть|нет)|можете взять|возьмите/i,
  // A clock's name («время») is everyday wording, not a mechanic
  ...book.attributeIds.filter(id => book.character.attributes[id]?.format !== 'clock').map(id => new RegExp(book.statLabel(id).name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')),
  // A book's own names for the core stats (МАСТЕРСТВ-, ВЫНОСЛИВОСТ-), by their stem
  ...(['agility', 'strength', 'luck'] as const)
    .map(id => book.statLabel(id).name)
    .filter(name => !/^(?:ЛОВКОСТЬ|СИЛА|УДАЧА)$/.test(name))
    .map(name => new RegExp(name.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
]

export function checkBook(book: Book, sections: Readonly<Record<string, string>>): BookReport {
  const ids = Object.keys(sections).filter(id => id !== 'preface').sort()
  const text = (id: string) => book.correctMisprints(id, sections[id] ?? '')
  const plain = (id: string) => new Set(book.getSectionRules(id).plainLinks ?? [])
  const linksOf = (id: string) => linkTargets(text(id)).filter(link => !plain(id).has(link))

  // Reachability from the start, spells included
  // A deadline sends the reader from any of its sections to its own
  const deadlineEdges = (id: string) => (book.deadlines ?? []).filter(rule => rule.on.includes(id)).map(rule => rule.section)
  const reached = new Set([book.start])
  const queue = [book.start]
  while (queue.length) {
    const id = queue.shift()!
    const next = [...linksOf(id), ...deadlineEdges(id), ...(book.getSectionRules(id).effects ?? [])
      .flatMap(effect => effect.kind === 'castSpell'
        ? [book.castTarget(id, effect) ?? '']
        : effect.kind === 'riddle' ? Object.values(effect.answers) : [])]
    for (const target of next) {
      if (!reached.has(target) && sections[target] !== undefined) {
        reached.add(target)
        queue.push(target)
      }
    }
  }

  const brokenLinks = ids.flatMap(id => linksOf(id).filter(link => sections[link] === undefined).map(link => `${id} -> ${link}`))

  const missingQuotes: BookReport['missingQuotes'] = []
  const unknownLinks: BookReport['unknownLinks'] = []
  for (const [id, rules] of Object.entries(book.sectionRules)) {
    if (sections[id] === undefined) continue
    const printed = sections[id]!
    const links = new Set(linkTargets(text(id)))
    const quotes = [
      ...(rules.effects ?? []).map(effect => effect.source),
      ...(rules.links ?? []).map(rule => rule.source),
      ...(rules.conditions ?? []).map(condition => condition.source)
    ]
    for (const source of quotes) {
      if (!findQuote(printed, source) && !findQuote(text(id), source)) missingQuotes.push({ section: id, source })
    }
    const named = [
      ...(rules.effects ?? []).flatMap(ruleLinks),
      ...(rules.links ?? []).map(rule => rule.link),
      ...(rules.conditions ?? []).map(condition => condition.link)
    ]
    for (const link of new Set(named)) {
      if (!links.has(link)) unknownLinks.push({ section: id, link })
    }
  }

  const combatMismatches: string[] = []
  const unregisteredFights: string[] = []
  for (const id of ids) {
    const enemies = parseEnemies(sections[id]!, book.enemyWords)
    // Every fighter of the section's fights (enemies, allies) against its stat blocks, in any order
    const fights = (book.sectionRules[id]?.effects ?? []).filter((effect): effect is CombatEffect => effect.kind === 'combat')
    if (!fights.length) {
      if (enemies.length && !book.sectionRules[id]?.fightersListed) unregisteredFights.push(id)
      continue
    }
    // A battle going on from an earlier section («не закрывая параграфа 600, продолжайте бой») prints no blocks
    if (!enemies.length && fights.every(fight => fight.persist)) continue
    const key = ({ name, skill, strength }: { name: string | null; skill: number; strength: number }) => JSON.stringify([name, skill, strength])
    // A fighter in two fights of one section (the first guard, then all three) is one stat block
    const expected = [...new Set(enemies.map(key))].sort()
    const actual = [...new Set(fights.flatMap(fight => [...fight.enemies, ...(fight.champion ? [fight.champion] : []), ...(fight.helpers ?? [])]).map(key))].sort()
    // A battle carried on («оставшийся в живых пират») may print only some of its fighters
    const carriedOn = fights.every(fight => fight.persist)
    const matches = carriedOn ? expected.every(fighter => actual.includes(fighter)) : JSON.stringify(expected) === JSON.stringify(actual)
    if (!matches) combatMismatches.push(id)
  }

  const endingProblems: string[] = []
  for (const id of ids) {
    const linked = hasSectionLinks(text(id))
    if (book.isPeek(id) && linked) endingProblems.push(`${id}: reference page with links`)
    if (book.endings[id] && linked) endingProblems.push(`${id}: listed as ${book.endings[id]} but has links`)
  }
  for (const id of book.peek) if (sections[id] === undefined) endingProblems.push(`${id}: reference page does not exist`)
  for (const id of Object.keys(book.endings)) if (sections[id] === undefined) endingProblems.push(`${id}: ending does not exist`)

  const staleMisprints = Object.entries(book.misprints ?? {}).flatMap(([id, fixes]) =>
    fixes.filter(({ from }) => !(sections[id] ?? '').includes(from)).map(({ from }) => `${id}: ${from}`))

  const codeProblems: string[] = []
  for (const [id, rules] of Object.entries(book.sectionRules)) {
    for (const effect of rules.effects ?? []) {
      if (effect.kind === 'riddle') {
        for (const target of Object.values(effect.answers)) {
          if (sections[target] === undefined) codeProblems.push(`${id}: riddle leads to missing section ${target}`)
        }
      }
      if (effect.kind !== 'castSpell') continue
      const target = book.castTarget(id, effect)
      const added = book.castTarget(id, { ...effect, target: undefined })
      if (!target) codeProblems.push(`${id}: ${effect.spell} has no number to add and no target`)
      else if (sections[target] === undefined) codeProblems.push(`${id}: ${effect.spell} leads to missing section ${target}`)
      else if (added && added !== target) codeProblems.push(`${id}: ${effect.spell} target ${target}, but ${id} + code = ${added}`)
    }
  }

  const words = mechanicalWords(book)
  const review = ids
    // Luck checks are driven by markers in the section file rather than rules
    .filter(id => !book.sectionRules[id] && !book.isPeek(id) && !parseDiceRollMetadata(sections[id]!, book.enemyWords).required)
    .map((id) => {
      const prose = text(id).replace(/<!--[\s\S]*?-->/g, '')
      const found = words.map(word => prose.match(word)?.[0]).filter((match): match is string => Boolean(match))
      return { section: id, words: [...new Set(found)] }
    })
    .filter(entry => entry.words.length > 0)

  return {
    sections: ids.length,
    reachable: [...reached].sort(),
    unreachable: ids.filter(id => !reached.has(id)),
    brokenLinks,
    missingQuotes,
    unknownSections: Object.keys(book.sectionRules).filter(id => sections[id] === undefined),
    unknownLinks,
    combatMismatches,
    unregisteredFights,
    endingProblems,
    staleMisprints,
    codeProblems,
    review
  }
}

/** Problems that make a pack wrong (as opposed to `unreachable` and `review`, which need a human) */
export const reportErrors = (report: BookReport) => [
  ...report.brokenLinks.map(link => `broken link ${link}`),
  ...report.missingQuotes.map(({ section, source }) => `${section}: quote not in the text: «${source}»`),
  ...report.unknownSections.map(id => `rules for a missing section ${id}`),
  ...report.unknownLinks.map(({ section, link }) => `${section}: rule names link ${link}, the section has no such link`),
  ...report.combatMismatches.map(id => `${id}: fight does not match the enemy stat block`),
  ...report.unregisteredFights.map(id => `${id}: enemy stat block without a registered fight`),
  ...report.endingProblems,
  ...report.staleMisprints.map(fix => `misprint not found in ${fix}`),
  ...report.codeProblems
]
