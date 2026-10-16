/**
 * Handwriting: every action (`.pencil-action`) and every section reference in the text
 * (`.book-content a`) gets its own tilt, derived from its label so it always leans the same way
 * (no jitter between visits). Sets `--tilt-rest` and `--tilt-hover`; see main.css.
 * Short numbers may lean more than a phrase without looking messy.
 */
interface TiltRange {
  rest: [number, number]
  hover: [number, number]
}

const ACTIONS: TiltRange = { rest: [0.4, 0.8], hover: [1, 2.5] }
const NUMBERS: TiltRange = { rest: [0.6, 1.8], hover: [2.5, 4.5] }

const within = (h: number, [min, max]: [number, number]) => min + ((h % 101) / 100) * (max - min)
const hash = (text: string) => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** `key` is the label plus its occurrence on the page, so two "Взять" in a row lean differently */
const tilt = (el: HTMLElement, key: string, range: TiltRange) => {
  if (el.dataset.tiltFor === key) return
  const h = hash(key)
  const direction = h & 1 ? 1 : -1
  el.style.setProperty('--tilt-rest', `${(direction * within(h >>> 1, range.rest)).toFixed(1)}deg`)
  el.style.setProperty('--tilt-hover', `${(direction * within(h >>> 9, range.hover)).toFixed(1)}deg`)
  el.dataset.tiltFor = key
}

export default defineNuxtPlugin(() => {
  const apply = () => {
    const seen = new Map<string, number>()
    document.querySelectorAll<HTMLElement>('.pencil-action, .book-content a').forEach((el) => {
      const label = el.textContent?.trim() ?? ''
      if (!label) return
      const n = (seen.get(label) ?? 0) + 1
      seen.set(label, n)
      tilt(el, n === 1 ? label : `${label}#${n}`, el.matches('.book-content a') ? NUMBERS : ACTIONS)
    })
  }
  // Labels change ("Начать бой" -> "Следующий раунд"), so re-check on every DOM change
  const observer = new MutationObserver(apply)
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  apply()
})
