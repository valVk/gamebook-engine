import { toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { getBook } from '#shared/engine/library'
import { useCharacter } from '~/composables/useCharacter'
import type { LuckCheckResult } from '~/composables/useCharacter'
import { parseSectionHref } from '~/utils/character'
import { DIE_FACE_PATH, DIE_PIPS } from '~/utils/die'

export interface LuckRollMetadata {
  required?: string
  successLink?: string
  failureLink?: string
  successLinks?: string[]
  failureLinks?: string[]
  hasLuckCheck?: boolean
}

type LuckLinks = { successLink: string; failureLink: string; successLinks?: string[]; failureLinks?: string[] }

/** Every link of an outcome (a choice when there are several) */
const linksOf = (meta: LuckLinks, lucky: boolean) =>
  (lucky ? meta.successLinks : meta.failureLinks) ?? [lucky ? meta.successLink : meta.failureLink]

const LUCK_PHRASE = /ПРОВЕР(?:ЬТЕ|ИТЬ) СВОЮ УДАЧУ/i

const linkTarget = (link: HTMLAnchorElement) => parseSectionHref(link.getAttribute('href'))

// Paragraph that asks for the luck check; roll UI is attached right after its text
const findLuckParagraph = (container: HTMLElement): HTMLElement =>
  [...container.querySelectorAll('p')].find(p => LUCK_PHRASE.test(p.textContent ?? '')) ?? container

const SVG = 'http://www.w3.org/2000/svg'

const svgEl = (tag: string, attrs: Record<string, string | number>) => {
  const el = document.createElementNS(SVG, tag)
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value))
  return el
}

/** One die drawn in ink (the DOM twin of InkDie.vue) */
const inkDie = (value: number) => {
  const svg = svgEl('svg', { viewBox: '0 0 100 100', class: 'ink-die' })
  svg.appendChild(svgEl('path', { d: DIE_FACE_PATH, class: 'ink-die-face' }))
  for (const [cx, cy] of DIE_PIPS[value] ?? []) svg.appendChild(svgEl('circle', { cx, cy, r: 7.5, class: 'ink-die-pip' }))
  return svg
}

/** The thrown die in the card's medallion */
const drawDie = (value: number) => {
  const medallion = document.createElement('div')
  medallion.className = 'outcome-medallion'
  medallion.setAttribute('aria-hidden', 'true')
  medallion.appendChild(inkDie(value))
  return medallion
}

/** Several dice inside the card (a score check throws two) */
const drawDice = (values: number[]) => {
  const row = document.createElement('div')
  row.className = 'outcome-dice'
  row.setAttribute('aria-hidden', 'true')
  for (const value of values) row.appendChild(inkDie(value))
  return row
}

/** No single die (penalty, no luck left, a score check): the medallion shows the clover */
const drawClover = () => {
  const medallion = document.createElement('div')
  medallion.className = 'outcome-medallion'
  medallion.setAttribute('aria-hidden', 'true')
  const svg = svgEl('svg', { viewBox: '0 0 24 24', class: 'outcome-emblem', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
  for (const d of [
    'M16.17 7.83 2 22',
    'M4.02 12a2.827 2.827 0 1 1 3.81-4.17A2.827 2.827 0 1 1 12 4.02a2.827 2.827 0 1 1 4.17 3.81A2.827 2.827 0 1 1 19.98 12a2.827 2.827 0 1 1-3.81 4.17A2.827 2.827 0 1 1 12 19.98a2.827 2.827 0 1 1-4.17-3.81A1 1 0 1 1 4 12',
    'm7.83 7.83 8.34 8.34'
  ]) svg.appendChild(svgEl('path', { d }))
  medallion.appendChild(svg)
  return medallion
}

/** A pencil mark over a luck square: an X when it is crossed out now, a circle when it already was */
const drawMark = (kind: 'cross' | 'circle') => {
  const svg = svgEl('svg', { 'viewBox': '0 0 40 40', 'class': `pencil-mark pencil-mark--${kind}`, 'aria-hidden': 'true' })
  const paths = kind === 'cross'
    ? ['M8 9 C 16 17, 24 24, 32 32', 'M31 8 C 24 16, 16 24, 9 33']
    : ['M20 2 C 34 2, 39 12, 38 21 C 37 32, 27 38, 18 37 C 8 36, 2 28, 3 18 C 4 9, 12 3, 24 4']
  for (const d of paths) svg.appendChild(svgEl('path', { d, pathLength: 1 }))
  return svg
}

const paragraphText = (text: string, className: string) => {
  const p = document.createElement('p')
  p.className = className
  p.textContent = text
  return p
}

/**
 * Luck check interaction for a rendered section: blocks the success/failure links until the
 * player rolls, then unlocks only the link matching the result. State lives in the character's
 * pendingRolls so a page reload cannot be used to re-roll.
 */
export const useLuckCheck = (pageId: MaybeRefOrGetter<string>) => {
  const character = useCharacter()

  const isLuckSection = (meta?: LuckRollMetadata | null): meta is Required<Pick<LuckRollMetadata, 'successLink' | 'failureLink'>> & LuckRollMetadata =>
    meta?.required === 'luck' && !!meta.successLink && !!meta.failureLink

  const outcomeLinks = (container: HTMLElement, meta: LuckLinks) => {
    const success = new Set(linksOf(meta, true).map(link => link.padStart(3, '0')))
    const failure = new Set(linksOf(meta, false).map(link => link.padStart(3, '0')))
    return [...container.querySelectorAll<HTMLAnchorElement>('a')]
      .map(link => ({ link, target: linkTarget(link) ?? '' }))
      .filter(({ target }) => success.has(target) || failure.has(target))
      .map(({ link, target }) => ({ link, isSuccess: success.has(target) }))
  }

  const blockLinks = (container: HTMLElement, meta: LuckLinks) => {
    for (const { link } of outcomeLinks(container, meta)) {
      link.classList.remove('luck-success-link', 'luck-failure-link', 'luck-dimmed-link')
      link.classList.add('blocked-link')
    }

    if (!container.querySelector('.luck-roll-btn')) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'luck-roll-btn pencil-action pencil-action--primary'
      button.textContent = 'Проверить удачу'
      findLuckParagraph(container).appendChild(button)
    }
  }

  const showResultLinks = (container: HTMLElement, meta: LuckLinks, lucky: boolean) => {
    for (const { link, isSuccess } of outcomeLinks(container, meta)) {
      link.classList.remove('blocked-link', 'luck-success-link', 'luck-failure-link', 'luck-dimmed-link')
      if (isSuccess === lucky) {
        link.classList.add(lucky ? 'luck-success-link' : 'luck-failure-link')
      } else {
        link.classList.add('luck-dimmed-link')
      }
    }
    container.querySelector('.luck-roll-btn')?.remove()
  }

  /**
   * The outcome of a luck check, as a small scene. Squares: the thrown die lands, the pencil
   * crosses out the square on the luck row (or circles the one that was already gone). Score: the
   * two dice and УДАЧА after the check. Then the verdict and the way on. `fresh` plays the drawing
   * once; after a reload the scene is shown as it ended.
   */
  const showOutcome = (
    container: HTMLElement,
    meta: LuckLinks,
    outcome: { lucky: boolean; roll?: number; penalty?: boolean; noLuckLeft?: boolean; dice?: number[]; score?: number },
    fresh: boolean
  ) => {
    container.querySelector('.luck-outcome')?.remove()
    const box = document.createElement('div')
    box.className = `outcome-card luck-outcome ${outcome.lucky ? 'is-reward' : 'is-penalty'}${fresh ? ' is-fresh' : ''}`
    box.setAttribute('role', 'status')

    const squares = getBook().luckSystem.kind === 'squares'
    box.appendChild(squares && outcome.roll ? drawDie(outcome.roll) : drawClover())
    if (!squares && outcome.dice?.length) box.appendChild(drawDice(outcome.dice))
    if (squares) box.appendChild(squareRow(outcome))

    box.appendChild(paragraphText(outcome.lucky ? 'Удача на вашей стороне!' : 'Удача отвернулась от вас', 'outcome-title'))

    const after = outcome.score === undefined ? '' : ` Теперь УДАЧА ${outcome.score}.`
    const note = outcome.penalty
      ? `Боги наказали вас: в этот раз кубик не бросают.${after}`
      : outcome.noLuckLeft
        ? (squares ? 'Все квадраты УДАЧИ уже зачеркнуты.' : 'УДАЧИ не осталось.')
        : squares
          ? outcome.lucky
            ? `Выпало ${outcome.roll}: квадрат зачеркнут.`
            : `Выпало ${outcome.roll}: этот квадрат уже был зачеркнут.`
          : `Выпало ${outcome.roll}: ${outcome.lucky ? 'не больше' : 'больше'} УДАЧИ.${after}`
    // Non-breaking spaces keep "путь — 73" on one line
    const noteEl = paragraphText(`${note} Ваш путь\u00A0—\u00A0`, 'outcome-line')
    // One way on, or a choice ("43 или 508")
    linksOf(meta, outcome.lucky).forEach((next, i, all) => {
      if (i > 0) noteEl.append(i === all.length - 1 ? ' или ' : ', ')
      const link = document.createElement('a')
      link.href = `#n_${Number(next)}`
      link.className = outcome.lucky ? 'luck-success-link' : 'luck-failure-link'
      link.textContent = String(Number(next))
      noteEl.append(link)
    })
    noteEl.append('.')
    box.appendChild(noteEl)

    const paragraph = findLuckParagraph(container)
    if (paragraph === container) container.appendChild(box)
    else paragraph.after(box)
  }

  /** The luck row with the thrown square marked */
  const squareRow = (outcome: { lucky: boolean; roll?: number }) => {
    const row = document.createElement('div')
    row.className = 'luck-row'
    row.setAttribute('aria-hidden', 'true')
    character.character.value.luck.forEach((available, i) => {
      const square = document.createElement('span')
      const isRolled = outcome.roll === i + 1
      square.className = `luck-square${available ? '' : ' crossed'}${isRolled ? ' is-rolled' : ''}`
      square.textContent = String(i + 1)
      // Lucky: the square has just been crossed out, so the pencil draws the X now
      if (isRolled && outcome.lucky) {
        square.classList.remove('crossed')
        square.appendChild(drawMark('cross'))
      }
      if (isRolled && !outcome.lucky) square.appendChild(drawMark('circle'))
      row.appendChild(square)
    })
    return row
  }

  /** Bring the rendered section in line with the current roll state. Safe to call repeatedly. */
  const apply = (container: HTMLElement, meta?: LuckRollMetadata | null) => {
    if (!isLuckSection(meta)) return
    const id = toValue(pageId)
    const pending = character.getPendingRoll(id)

    if (pending?.result !== undefined) {
      showResultLinks(container, meta, pending.result)
      // After a reload the scene is shown as it ended, without drawing it again
      if (!container.querySelector('.luck-outcome')) {
        showOutcome(container, meta, {
          lucky: pending.result,
          roll: pending.value,
          penalty: pending.penalty,
          noLuckLeft: !pending.value && !pending.penalty,
          dice: pending.dice,
          score: pending.score
        }, false)
      }
      return
    }

    if (character.getAvailableLuckPoints() === 0) {
      const result = character.checkLuck(id)
      showResultLinks(container, meta, result.lucky)
      showOutcome(container, meta, { lucky: false, penalty: result.penalty, noLuckLeft: !result.penalty, score: result.score }, true)
      return
    }

    if (!pending) {
      character.setPendingRoll(id, 'luck')
    }
    blockLinks(container, meta)
  }

  /** Roll for the current section and update the rendered links. */
  const roll = (container: HTMLElement, meta?: LuckRollMetadata | null): LuckCheckResult | null => {
    if (!isLuckSection(meta)) return null
    const result = character.checkLuck(toValue(pageId))
    showResultLinks(container, meta, result.lucky)
    showOutcome(container, meta, { lucky: result.lucky, roll: result.roll ?? undefined, penalty: result.penalty, dice: result.dice, score: result.score }, true)
    return result
  }

  return { apply, roll, isLuckSection }
}
