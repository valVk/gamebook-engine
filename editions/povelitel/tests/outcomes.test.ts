import { describe, expect, it } from 'vitest'
import type { SectionEffect } from '#shared/engine/rules'
import { getBook, setBook } from '#shared/engine/library'
import type { EffectOutcome } from '~/utils/character'
import { actionCard, arrivalCard, deathCard, endingCard, enemyName, hasCard } from '~/utils/outcomes'
import type { OutcomeEntry } from '~/utils/outcomes'

// The registry holds every installed book; these tests read «Повелитель»
setBook('povelitel')

const luck = [true, false, true, true, false, true]

let nextIndex = 0
const entry = (effect: Omit<SectionEffect, 'source'>, outcome?: EffectOutcome, automatic = true): OutcomeEntry => ({
  index: nextIndex++,
  effect: { ...effect, source: '' } as SectionEffect,
  outcome,
  resolved: true,
  automatic
})

describe('arrivalCard', () => {
  it('merges automatic effects into one card led by the weightiest', () => {
    const card = arrivalCard([
      entry({ kind: 'change', stat: 'gold', amount: 5 }, { value: 5 }),
      entry({ kind: 'gainItem', item: 'medallion' })
    ])
    expect(card).toMatchObject({ tone: 'reward', title: 'Новый предмет', icon: 'i-lucide-backpack' })
    expect(card?.lines).toEqual(['+5 золотых', getBook().itemName('medallion')])
  })

  it('takes the penalty tone for losses', () => {
    const card = arrivalCard([entry({ kind: 'change', stat: 'strength', amount: -3 }, { value: -3 })])
    expect(card).toMatchObject({ tone: 'penalty', title: 'Рана', lines: ['−3 СИЛЫ'] })
  })

  it('follows the lead when gains and losses mix', () => {
    const card = arrivalCard([
      entry({ kind: 'change', stat: 'gold', amount: 2 }, { value: 2 }),
      entry({ kind: 'change', stat: 'agility', amount: -1 }, { value: -1 })
    ])
    expect(card).toMatchObject({ tone: 'penalty', title: 'Увечье' })
  })

  it('stays neutral for a meal and skips changes already at the limit', () => {
    const card = arrivalCard([
      entry({ kind: 'meal', penalty: 2 }, { success: true, value: -1 }),
      entry({ kind: 'change', stat: 'strength', amount: 2 }, { value: 0 })
    ])
    expect(card).toMatchObject({ tone: 'neutral', title: 'Привал', lines: ['Съедена порция ЕДЫ'] })
  })

  it('is null when nothing changed or effects are not automatic', () => {
    expect(arrivalCard([entry({ kind: 'change', stat: 'food', amount: 1 }, { value: 0 })])).toBeNull()
    expect(arrivalCard([entry({ kind: 'pickup', item: 'medallion' }, {}, false)])).toBeNull()
  })
})

describe('actionCard', () => {
  it('shows a single die in the medallion for a one-die wound', () => {
    expect(actionCard(entry({ kind: 'roll', dice: 1 }, { value: 4, dice: [4] }, false), { luck })).toMatchObject({
      tone: 'penalty', die: 4, lines: ['Выпало 4', '−4 СИЛЫ']
    })
  })

  it('shows a dice row when several dice decided it', () => {
    const card = actionCard(entry({ kind: 'roll', dice: 2 }, { value: 7, dice: [3, 4] }, false), { luck })
    expect(card).toMatchObject({ dice: [3, 4], icon: 'i-lucide-heart-crack', lines: ['Выпало 3 + 4 = 7', '−7 СИЛЫ'] })
  })

  it('rewards a won fight and names the enemy in sentence case', () => {
    const effect = { kind: 'combat', type: 'sword', enemies: [{ name: 'ПЕРВЫЙ РАЗБОЙНИК', skill: 7, strength: 6 }] } as const
    const card = actionCard(entry(effect, { success: true, rounds: 3, damage: 2 }, false), { luck })
    expect(card).toMatchObject({ tone: 'reward', title: 'Победа!', lines: ['Первый разбойник: победа за 3 раунда', 'Потеряно СИЛЫ: 2'] })
  })

  it('marks a fight lost on the round limit as a penalty', () => {
    const effect = { kind: 'combat', type: 'sword', roundLimit: 5, enemies: [{ name: null, skill: 7, strength: 6 }] } as const
    const card = actionCard(entry(effect, { success: false, rounds: 5, damage: 0 }, false), { luck })
    expect(card).toMatchObject({ tone: 'penalty', title: 'Не успели', lines: ['За 5 раундов победить не удалось', 'Вы не ранены'] })
  })

  it('marks the restored luck square on the luck row', () => {
    const card = actionCard(entry({ kind: 'luckRestore' }, { success: true, value: 2 }, false), { luck })
    expect(card).toMatchObject({ tone: 'reward', die: 2, luckRow: { luck, mark: 2 } })
  })

  it('deals a card for a picked up item', () => {
    expect(actionCard(entry({ kind: 'pickup', item: 'bracelet' }, {}, false), { luck })).toMatchObject({
      tone: 'reward', title: 'Новый предмет', lines: [getBook().itemName('bracelet')]
    })
  })

  it('leaves purchases and unresolved actions without a card', () => {
    const purchase = entry({ kind: 'purchase', item: 'cloak', price: 5 } as Omit<SectionEffect, 'source'>, {}, false)
    expect(actionCard(purchase, { luck })).toBeNull()
    expect(hasCard(purchase, { luck })).toBe(false)
    expect(actionCard({ ...entry({ kind: 'roll', dice: 1 }, undefined, false), resolved: false }, { luck })).toBeNull()
  })
})

describe('endings', () => {
  it('deals death, capture, survival and victory cards', () => {
    expect(deathCard()).toMatchObject({ tone: 'penalty', icon: 'i-lucide-skull' })
    expect(endingCard('victory')).toMatchObject({ tone: 'reward', title: 'Победа!' })
    expect(endingCard('captured')).toMatchObject({ tone: 'penalty', title: 'Плен' })
    expect(endingCard('survived').tone).toBe('neutral')
  })
})

describe('enemyName', () => {
  it('keeps the capital inside quotes and falls back for unnamed enemies', () => {
    expect(enemyName('«ЖЕЛТЫЙ» ВОИН')).toBe('«Желтый» воин')
    expect(enemyName(null)).toBe('Противник')
  })
})
