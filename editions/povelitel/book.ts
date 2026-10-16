import type { BookDefinition } from '#shared/engine/book'
import { COMBATS } from './combats'
import { RULES } from './rules'
import type { ItemId, SpellId, Stat } from './rules'

/** «Повелитель Безбрежной Пустыни», Дмитрий Браславский, 1993 (1st edition text) */
// Loaded at runtime by the engine: only types are imported from it
export default {
  id: 'povelitel',
  title: 'Повелитель Безбрежной Пустыни',
  author: 'Дмитрий Браславский',
  year: 1993,
  lede: 'Враг поселился на одинокой скале посреди пустыни, и Король Элгариола посылает вас одного. С собой только меч, три дня еды, 15 золотых и кубик.',
  cover: { file: 'povelitel.jpg', width: 300, height: 372 },
  rulesHeading: 'ПРАВИЛА ИГРЫ',
  victoryLine: 'Повелитель Безбрежной Пустыни повержен, Элгариол спасен.',
  // The single-book app saved here
  legacySaveKey: 'rpg-character',
  start: '001',
  character: {
    // The preface's table (a picture in the text): 2d6 → ЛОВКОСТЬ, СИЛА, ОБАЯНИЕ
    table: {
      2: { agility: 8, strength: 22, charisma: 8 },
      3: { agility: 10, strength: 20, charisma: 6 },
      4: { agility: 12, strength: 16, charisma: 5 },
      5: { agility: 9, strength: 18, charisma: 8 },
      6: { agility: 11, strength: 20, charisma: 6 },
      7: { agility: 9, strength: 20, charisma: 7 },
      8: { agility: 10, strength: 16, charisma: 7 },
      9: { agility: 8, strength: 24, charisma: 7 },
      10: { agility: 9, strength: 22, charisma: 6 },
      11: { agility: 10, strength: 18, charisma: 7 },
      12: { agility: 11, strength: 20, charisma: 5 }
    },
    attributes: {
      // ОБАЯНИЕ 12 always succeeds, 1 always fails
      charisma: { label: { name: 'ОБАЯНИЕ', of: 'ОБАЯНИЯ' }, min: 1, max: 12, sheet: 'cell', tested: true },
      mentalPower: {
        label: { name: 'Сила мысли', of: 'к Силе мысли' },
        start: 3,
        sheet: 'circle',
        card: { icon: 'i-lucide-brain', titles: ['Сила мысли растет', 'Сила мысли слабеет'], weight: 7 }
      }
    },
    mindSkill: 'mentalPower',
    gold: 15,
    food: 3,
    foodRestores: 4,
    kit: 'С собой у вас меч, три порции ЕДЫ, 15 золотых, а Сила мысли пока равна 3.',
    emptyBag: 'пусто, только меч в ножнах'
  },
  rules: RULES,
  combats: COMBATS,
  items: {
    medallion: { name: 'Золотой медальон' },
    bracelet: { name: 'Браслет с изумрудами' },
    belt: { name: 'Шелковый пояс' },
    cloak: { name: 'Накидка от песчаной бури' },
    rope: { name: 'Моток веревки' },
    flask: { name: 'Флакон с неизвестной жидкостью' },
    // 376: a wound from this sword costs the enemy 3 СИЛЫ instead of 2
    sword: { name: 'Меч с письменами', weapon: true, damage: 3 },
    pigeon: { name: 'Почтовый голубь' },
    // 278: the enemy's attack is 1 lower; −2 ЛОВКОСТЬ while worn, and 3 СИЛЫ per day
    armor: { name: 'Рыцарские доспехи', agility: -2, enemyAttackPenalty: 1, dailyStrength: 3 },
    keys: { name: 'Связка ключей' },
    necklace: { name: 'Жемчужное ожерелье' },
    ring: { name: 'Перстень с топазом' },
    scabbard: { name: 'Серебряные ножны' },
    // 613: each wound with it costs the enemy 3 СИЛЫ instead of 2
    guardSword: { name: 'Меч стражника', weapon: true, damage: 3 },
    nomadSword: { name: 'Меч кочевника', weapon: true },
    // 594: −2 ЛОВКОСТЬ until another weapon is found
    rustyBlade: { name: 'Ржавый клинок', agility: -2, replacedByWeapon: true, kept: true }
  },
  spells: {
    reduction: { name: 'Заклятие Уменьшения', add: 125 }
  },
  // 632 is the victory (reached after defeating the Повелитель in 085); unlisted endings are deaths
  endings: {
    '632': 'victory',
    // Alive, but the journey is over and the mission failed
    '147': 'survived',
    '296': 'survived',
    '445': 'survived',
    '580': 'survived',
    // Taken prisoner or made a slave
    '080': 'captured',
    '140': 'captured',
    '391': 'captured',
    '434': 'captured',
    '578': 'captured'
  },
  // Telepathic abilities by Сила мысли level, and the merchant's item descriptions (512)
  peek: [
    '488', '010', '519', '100', '244', '350', '404',
    '259', '421', '290', '376', '059', '121', '278'
  ],
  // 083: the abilities list after the fight sends Сила мысли 4 to 448, a death page (the trap
  // reached from 542/178/608). Its twin 274, the same creature and sentence, sends it to 488.
  misprints: {
    '083': [{ from: '[**448**](#n_448)', to: '[**488**](#n_488)' }]
  },
  shop: '512'
} satisfies BookDefinition<Stat, ItemId, SpellId, 'charisma' | 'mentalPower'>
