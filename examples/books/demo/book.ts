import type { BookDefinition } from '#shared/engine/book'
import { COMBATS, RULES } from './rules'
import type { ItemId, SpellId, Stat } from './rules'

/**
 * A demo book written for this engine: free to use, copy and change.
 * Packs are loaded at runtime, so they import only types from the engine (`satisfies`).
 */
export default {
  id: 'demo',
  title: 'Тропа Стеклянной долины',
  author: 'Gamebook Engine',
  year: 2026,
  lede: 'В Стеклянной долине спрятаны Песочные часы, что останавливают время. Дорога короткая, но каждый шаг на ней стоит СИЛЫ, золота или удачи.',
  cover: { file: 'cover.svg', width: 300, height: 372 },
  rulesHeading: 'ПРАВИЛА ИГРЫ',
  victoryLine: 'Песочные часы у вас в руках.',
  imprint: {
    full: [
      '«Тропа Стеклянной долины» написана как пример для движка Gamebook Engine: в ней есть все виды правил, которые движок умеет вести.',
      'Текст и обложку можно свободно копировать, менять и использовать как образец для своей книги.'
    ],
    short: 'Пример книги-игры для движка Gamebook Engine. Можно свободно копировать и менять.'
  },
  start: '001',
  character: {
    // 2d6 → ЛОВКОСТЬ, СИЛА, ЧЕСТЬ
    table: {
      2: { agility: 7, strength: 20, honor: 9 },
      3: { agility: 8, strength: 18, honor: 8 },
      4: { agility: 9, strength: 18, honor: 7 },
      5: { agility: 9, strength: 16, honor: 8 },
      6: { agility: 10, strength: 16, honor: 7 },
      7: { agility: 10, strength: 18, honor: 6 },
      8: { agility: 10, strength: 14, honor: 7 },
      9: { agility: 11, strength: 14, honor: 6 },
      10: { agility: 11, strength: 16, honor: 5 },
      11: { agility: 12, strength: 14, honor: 5 },
      12: { agility: 12, strength: 12, honor: 6 }
    },
    attributes: {
      honor: { label: { name: 'ЧЕСТЬ', of: 'ЧЕСТИ' }, min: 1, max: 12, sheet: 'cell', tested: true },
      mind: {
        label: { name: 'Сила мысли', of: 'к Силе мысли' },
        start: 3,
        sheet: 'circle',
        card: { icon: 'i-lucide-brain', titles: ['Сила мысли растет', 'Сила мысли слабеет'], weight: 7 }
      }
    },
    mindSkill: 'mind',
    gold: 10,
    food: 2,
    foodRestores: 3,
    kit: 'С собой у вас палка вместо меча, две порции ЕДЫ и 10 золотых.'
  },
  rules: RULES,
  combats: COMBATS,
  items: {
    rope: { name: 'Моток веревки' },
    shield: { name: 'Тяжелый щит', agility: -1, enemyAttackPenalty: 1, dailyStrength: 1 },
    amulet: { name: 'Медный амулет' },
    lantern: { name: 'Фонарь' },
    key: { name: 'Бронзовый ключ' },
    stick: { name: 'Крепкая палка', agility: -1, replacedByWeapon: true, kept: true },
    spear: { name: 'Копье', weapon: true, damage: 3 }
  },
  spells: {
    light: { name: 'Слово света', add: 3 }
  },
  endings: {
    '017': 'victory',
    '018': 'captured'
  },
  peek: ['015'],
  // Printed «91» where 13 is meant: corrected when the section is served
  misprints: {
    '012': [{ from: '[**91**](#n_91)', to: '[**13**](#n_13)' }]
  },
  shop: '005'
} satisfies BookDefinition<Stat, ItemId, SpellId, 'honor' | 'mind'>
