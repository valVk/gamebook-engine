// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setBook } from '#shared/engine/library'
import { useCharacter } from '~/composables/useCharacter'
import { useLuckCheck } from '~/composables/useLuckCheck'

// The registry holds every installed book; these tests read «Повелитель»
setBook('povelitel')

const dice = vi.hoisted(() => ({ queue: [] as number[] }))

vi.mock('@dice-roller/rpg-dice-roller', () => ({
  DiceRoll: class {
    total: number
    output = ''
    constructor() {
      const value = dice.queue.shift()
      if (value === undefined) throw new Error('No queued roll')
      this.total = value
    }
  }
}))

const meta = { required: 'luck', successLink: '73', failureLink: '621', hasLuckCheck: true }

const renderSection = () => {
  const container = document.createElement('div')
  container.innerHTML = '<p>Пора ПРОВЕРИТЬ СВОЮ УДАЧУ. Повезет — '
    + '<a href="#n_73">73</a>, не повезет — <a href="#n_621">621</a>.</p>'
  return container
}

const links = (container: HTMLElement) => {
  const [success, failure] = container.querySelectorAll('a')
  return { success: success!, failure: failure! }
}

describe('useLuckCheck', () => {
  beforeEach(() => {
    dice.queue.length = 0
    const api = useCharacter()
    api.endGameSession()
    dice.queue.push(3, 4, 2, 5) // stats sum 7, luck squares 2 and 5 crossed out
    api.rollStats()
    api.startJourney()
    api.navigateToPage('165')
  })

  it('blocks both outcome links and adds a roll button', () => {
    const container = renderSection()
    useLuckCheck('165').apply(container, meta)

    const { success, failure } = links(container)
    expect(success.classList.contains('blocked-link')).toBe(true)
    expect(failure.classList.contains('blocked-link')).toBe(true)
    expect(container.querySelectorAll('.luck-roll-btn')).toHaveLength(1)
  })

  it('does not add a second button when applied again', () => {
    const container = renderSection()
    const luck = useLuckCheck('165')
    luck.apply(container, meta)
    luck.apply(container, meta)

    expect(container.querySelectorAll('.luck-roll-btn')).toHaveLength(1)
  })

  it('unlocks only the success link after a lucky roll', () => {
    const container = renderSection()
    const luck = useLuckCheck('165')
    luck.apply(container, meta)
    dice.queue.push(1)
    luck.roll(container, meta)

    const { success, failure } = links(container)
    expect(success.className).toBe('luck-success-link')
    expect(failure.className).toBe('luck-dimmed-link')
    expect(container.querySelector('.luck-roll-btn')).toBeNull()
    const card = container.querySelector('.luck-outcome.is-reward')
    expect(card?.querySelector('.outcome-medallion .ink-die')).not.toBeNull()
    expect(card?.querySelector('.luck-square.is-rolled .pencil-mark--cross')?.parentElement?.textContent).toBe('1')
    expect(card?.querySelector('.outcome-title')?.textContent).toBe('Удача на вашей стороне!')
    expect(card?.querySelector('.outcome-line')?.textContent).toContain('Выпало 1')
    expect(card?.querySelector('.outcome-line a')?.getAttribute('href')).toBe('#n_73')
  })

  it('unlocks only the failure link after an unlucky roll', () => {
    const container = renderSection()
    const luck = useLuckCheck('165')
    luck.apply(container, meta)
    dice.queue.push(2)
    luck.roll(container, meta)

    const { success, failure } = links(container)
    expect(success.className).toBe('luck-dimmed-link')
    expect(failure.className).toBe('luck-failure-link')
  })

  it('restores the recorded result after a reload instead of offering a re-roll', () => {
    const luck = useLuckCheck('165')
    const first = renderSection()
    luck.apply(first, meta)
    dice.queue.push(2)
    luck.roll(first, meta)

    const reloaded = renderSection()
    luck.apply(reloaded, meta)

    expect(reloaded.querySelector('.luck-roll-btn')).toBeNull()
    expect(links(reloaded).failure.className).toBe('luck-failure-link')
    // The outcome card comes back as it ended, with the rolled die, without replaying
    const card = reloaded.querySelector('.luck-outcome')
    expect(card?.classList.contains('is-fresh')).toBe(false)
    expect(card?.querySelector('.luck-square.is-rolled .pencil-mark--circle')?.parentElement?.textContent).toBe('2')
  })

  it('fails automatically when no luck squares are left', () => {
    const api = useCharacter()
    for (const roll of [1, 3, 4, 6]) {
      dice.queue.push(roll)
      api.checkLuck()
    }
    expect(api.getAvailableLuckPoints()).toBe(0)

    const container = renderSection()
    dice.queue.push(1)
    useLuckCheck('165').apply(container, meta)

    expect(links(container).failure.className).toBe('luck-failure-link')
    const card = container.querySelector('.luck-outcome.is-penalty')
    expect(card?.querySelector('.outcome-line')?.textContent).toContain('Все квадраты УДАЧИ уже зачеркнуты')
    expect(card?.querySelector('.ink-die')).toBeNull()
  })

  it('ignores sections without luck markers', () => {
    const container = renderSection()
    useLuckCheck('165').apply(container, { hasLuckCheck: true })

    expect(container.querySelector('.blocked-link')).toBeNull()
    expect(container.querySelector('.luck-roll-btn')).toBeNull()
  })
})
