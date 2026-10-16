import type { BookDefinition } from '#shared/engine/book'
import { ALL_ITEMS, ALL_SPELLS, RULES } from './rules'
import type { ItemId, SpellId, Stat } from './rules'

/** «Тайна капитана Шелтона», Дмитрий Браславский */
// Loaded at runtime by the engine: only types are imported from it
export default {
  id: 'shelton',
  title: 'Тайна капитана Шелтона',
  author: 'Дмитрий Браславский',
  year: 1993,
  lede: 'Корабли перестали возвращаться в гавань Грейкейпа, и военная эскадра исчезла вслед за ними. У вас небольшая шхуна, 15 золотых и шпага с тяжелым эфесом.',
  cover: { file: 'oblozhka.png', width: 300, height: 397 },
  rulesHeading: 'ПРАВИЛА ИГРЫ',
  victoryLine: 'Неведомое повержено, его тайна разгадана.',
  start: '001',
  character: {
    // The preface: МАСТЕРСТВО is one die + 6, ВЫНОСЛИВОСТЬ two dice + 12
    roll: { agility: '1d6+6', strength: '2d6+12' },
    labels: {
      agility: { name: 'МАСТЕРСТВО', of: 'МАСТЕРСТВА', short: 'МАСТ.', sheet: 'МАСТЕР\u00ADСТВО' },
      strength: { name: 'ВЫНОСЛИВОСТЬ', of: 'ВЫНОСЛИВОСТИ', short: 'ВЫН.', sheet: 'ВЫНОС\u00ADЛИВОСТЬ' }
    },
    attributes: {
      // 067: four hours from there on; the clock is shown from that section
      timeLeft: { label: { name: 'ВРЕМЯ', of: 'минут' }, start: 240, sheet: 'cell', format: 'clock', visibleAfter: '067', visibleUntil: '500' }
    },
    gold: 15,
    food: 0,
    // The preface: each portion of food restores 3 ВЫНОСЛИВОСТИ
    foodRestores: 3,
    kit: 'С собой у вас шпага, 15 золотых в кошельке и шхуна «Святая Елена» с командой.',
    emptyBag: 'карманы пусты, только шпага на поясе'
  },
  // The preface: an attack is two dice + МАСТЕРСТВО
  combat: { attack: 'sum' },
  // The preface: two dice not above УДАЧА are lucky, and every check costs 1 УДАЧИ
  luck: { system: 'score', start: '1d6+6', evenLucky: 'luckSpell' },
  rules: RULES,
  // The fights are in the rules (combats.ts: several per section, with allies)
  combats: {},
  items: ALL_ITEMS,
  spells: ALL_SPELLS,
  endings: {
    // The mystery solved
    629: 'victory',
    // Home alive, the mystery unsolved
    '057': 'survived',
    370: 'survived',
    510: 'survived',
    // Stranded or taken
    579: 'captured',
    // Caught with the stolen shield by the Водяные
    616: 'captured'
  },
  // 440: Мейстон's story, read from 629 and back again; 478 is read from 488 without leaving it
  peek: ['440', '478'],
  // 067: arriving at an island with less than 15 minutes left sends the reader to 220
  deadlines: [{ stat: 'timeLeft', below: 15, on: ['248', '016', '233', '165', '418', '395', '535', '100', '084', '352', '282', '456'], section: '220', title: 'Время истекло' }],
  // Links the FB2 left as plain numbers
  misprints: {
    183: [{ from: 'сражаться самому— 388.', to: 'сражаться самому — [**388**](#n_388).' }],
    309: [{ from: 'гаснет—476.', to: 'гаснет — [**476**](#n_476).' }],
    323: [{ from: '5 или 6 — 573.', to: '5 или 6 — [**573**](#n_573).' }],
    392: [{ from: 'двигаться дальше—549.', to: 'двигаться дальше — [**549**](#n_549).' }],
    597: [{ from: 'плыть дальше—32.', to: 'плыть дальше — [**32**](#n_32).' }],
    620: [{ from: 'еще 1 — 549.', to: 'еще 1 — [**549**](#n_549).' }]
  }
} satisfies BookDefinition<Stat, ItemId, SpellId, 'timeLeft'>
