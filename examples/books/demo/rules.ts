/**
 * «Тропа Стеклянной долины»: a short original adventure that uses every rule kind of the engine.
 * It is the engine's test fixture and a playable demo for the public repository.
 * Every rule quotes its section exactly (`source`), as in a real book pack.
 */

import type { CombatEffect, ItemCondition, LinkRule, SectionEffect, SectionRules, StatCondition } from '#shared/engine/rules'

export type Stat = 'strength' | 'agility' | 'gold' | 'food' | 'mind'
export type ItemId = 'rope' | 'shield' | 'amulet' | 'lantern' | 'key' | 'stick' | 'spear'
export type SpellId = 'light'

type Effect = SectionEffect<Stat, ItemId, SpellId>
type Rules = SectionRules<Stat, ItemId, SpellId>

const has = (link: string, items: ItemId[], source: string): ItemCondition<ItemId> => ({ link, items, has: 'any', source })
const hasNone = (link: string, items: ItemId[], source: string): ItemCondition<ItemId> => ({ link, items, has: 'none', source })
const mind = (link: string, op: StatCondition<Stat>['op'], value: number, source: string): StatCondition<Stat> =>
  ({ link, stat: 'mind', op, value, source })
const cost = (link: string, amount: number, charge: boolean, source: string): LinkRule => ({ link, stat: 'gold', amount, charge, source })
const gain = (item: ItemId, source: string): Effect => ({ kind: 'gainItem', item, source })

export const RULES: Readonly<Record<string, Rules>> = {
  '001': { effects: [{ kind: 'change', stat: 'gold', amount: 5, source: 'В траве блестят 5 монет' }, gain('stick', 'подбираете крепкую палку')] },
  '002': { effects: [{ kind: 'meal', penalty: 2, source: 'иначе потеряйте 2 СИЛЫ' }, gain('lantern', 'дарит вам фонарь')] },
  '003': { effects: [{ kind: 'roll', dice: 1, escapeLinks: ['002'], source: 'Киньте кубик и вычтите выпавшее из своей СИЛЫ' }] },
  '005': {
    effects: [
      { kind: 'purchase', item: 'rope', price: 3, source: 'моток веревки' },
      { kind: 'purchase', item: 'shield', price: 4, source: 'тяжелый щит' },
      { kind: 'purchase', item: 'amulet', price: 2, source: 'медный амулет' },
      { kind: 'refund', item: 'amulet', price: 2, source: 'заберет амулет обратно за ту же цену' }
    ],
    links: [cost('006', 2, true, 'Пройти через его сад стоит 2 золотых'), cost('010', 2, false, 'сыграть с ним в кости на 2 золотых')],
    plainLinks: ['003']
  },
  '006': { effects: [{ kind: 'charismaTest', successLinks: ['008'], failureLinks: ['009'], source: 'Проверьте свою ЧЕСТЬ' }] },
  '007': {
    effects: [
      { kind: 'luckPenalty', source: 'считайте, что Удача отвернулась от вас' },
      { kind: 'agilityTest', dice: 2, successLinks: ['008'], failureLinks: ['010'], source: 'сравните результат со своей ЛОВКОСТЬЮ' }
    ]
  },
  '008': {
    conditions: [
      has('011', ['rope'], 'Если у вас есть веревка'),
      hasNone('012', ['rope'], 'Если нет'),
      mind('013', '>=', 4, 'Если ваша Сила мысли 4 и больше')
    ]
  },
  '009': {
    effects: [
      { kind: 'loseAll', stat: 'gold', source: 'забирает все ваши монеты' },
      { kind: 'parityRoll', dice: 2, successLinks: ['011'], failureLinks: ['007'], source: 'Если сумма четная' }
    ]
  },
  '010': { effects: [{ kind: 'duel', successLinks: ['011'], failureLinks: ['012'], source: 'Вы бросаете кубик за себя, а потом за торговца' }] },
  '011': {
    effects: [
      { kind: 'loseItems', items: ['rope'], source: 'веревка обрывается и падает в темноту' },
      { kind: 'attrition', enemy: 'Летучие мыши', killTarget: 4, damageDice: 1, source: 'Кидайте, пока не отгоните 4 мыши' },
      { kind: 'pickup', item: 'spear', source: 'можете взять копье' }
    ]
  },
  '013': { effects: [{ kind: 'learnSpell', spell: 'light', source: 'учит вас Слову света' }] },
  '014': {
    effects: [
      { kind: 'luckRestore', source: 'почистить один из квадратов УДАЧИ' },
      { kind: 'pickup', item: 'key', source: 'можете взять бронзовый ключ' },
      { kind: 'optional', stat: 'food', amount: -1, label: 'Отдать нищему 1 ЕДУ', source: 'можете отдать ему 1 ЕДУ' },
      { kind: 'castSpell', spell: 'light', source: 'Если вам ведомо Слово света' }
    ],
    conditions: [has('018', ['key'], 'Если у вас есть ключ')]
  }
}

/** Fights from the enemy stat blocks */
export const COMBATS: Readonly<Record<string, CombatEffect>> = {
  '004': { kind: 'combat', type: 'sword', enemies: [{ name: 'ВОЛК', skill: 7, strength: 6 }], escapeLinks: ['005'], source: '> ##### Ловкость 7 Сила 6' },
  '013': { kind: 'combat', type: 'mind', enemies: [{ name: 'ТЕНЬ', skill: 3, strength: 6 }], reward: 1, source: '> ##### Сила мысли 3 Сила 6' }
}
