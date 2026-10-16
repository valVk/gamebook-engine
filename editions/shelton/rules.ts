import type { ItemDefinition, SpellDefinition } from '#shared/engine/book'
import type { ItemCondition, LinkRule, SectionEffect, SectionRules } from '#shared/engine/rules'
import { FIGHTS, LISTED } from './combats'
import { GENERATED, GENERATED_ITEMS, GENERATED_SPELLS } from './generated'
import type { GeneratedItemId, GeneratedSpellId } from './generated'

/**
 * «Тайна капитана Шелтона»: section rules, each proved against its section by a fingerprinted quote. Codes, riddles and the island clock
 * are generated (generated.ts); what follows is written by hand, section by section, and merged
 * with them.
 */
export type Stat = 'agility' | 'strength' | 'luck' | 'gold' | 'food' | 'timeLeft'

/** Items that are not codes */
export const ITEMS = {
  trident: { name: 'Трезубец' },
  urchinFish: { name: 'Рыба-еж' },
  sawFish: { name: 'Рыба-пила' },
  oldSword: { name: 'Средневековый меч', weapon: true },
  harpoon: { name: 'Гарпун', strike: 12 },
  // The preface: a busy left hand costs 1 МАСТЕРСТВО, and the shield is carried in it
  goldShield: { name: 'Золотой щит', agility: -1 },
  bottle: { name: 'Бутылка с посланием' },
  tridentRing: { name: 'Кольцо с трезубцем' },
  driedCrab: { name: 'Сушеный краб' },
  moonFish: { name: 'Рыба-луна' },
  axe: { name: 'Боевой топор', fightSkill: 1 }
} satisfies Record<string, ItemDefinition>

/** Codes that are not «прибавьте N к номеру»: spells and states */
export const SPELLS = {
  // 210: an even throw in a luck check is lucky (book.ts luck)
  luckSpell: { name: 'Заклятие Удачи: четное число на кубиках — удача' }
} satisfies Record<string, SpellDefinition>

export type ItemId = GeneratedItemId | keyof typeof ITEMS
export type SpellId = GeneratedSpellId | keyof typeof SPELLS

type Rules = SectionRules<Stat, ItemId, SpellId>
type Effect = SectionEffect<Stat, ItemId, SpellId>

const change = (stat: Stat, amount: number, source: string): Effect => ({ kind: 'change', stat, amount, source })
const strength = (amount: number, source: string) => change('strength', amount, source)
const gold = (amount: number, source: string) => change('gold', amount, source)
const gain = (item: ItemId, source: string): Effect => ({ kind: 'gainItem', item, source })
const pickup = (item: ItemId, source: string): Effect => ({ kind: 'pickup', item, source })
const optional = (stat: Stat, amount: number, label: string, source: string): Effect => ({ kind: 'optional', stat, amount, label, source })
const has = (link: string, items: ItemId[], source: string): ItemCondition<ItemId> => ({ link, items, has: 'any', source })
const hasNone = (link: string, items: ItemId[], source: string): ItemCondition<ItemId> => ({ link, items, has: 'none', source })
const pay = (link: string, amount: number, source: string): LinkRule => ({ link, stat: 'gold', amount, charge: true, source })
/** The money must be at hand; the section it leads to takes it */
const need = (link: string, amount: number, source: string): LinkRule => ({ link, stat: 'gold', amount, charge: false, source })
const feed = (link: string, amount: number, source: string): LinkRule => ({ link, stat: 'food', amount, charge: true, source })
const lose = (items: ItemId[], source: string): Effect => ({ kind: 'loseItems', items, source })

const MANUAL: Readonly<Record<string, Rules>> = {
  // The tavern: who sails with you and for how much
  '001': { links: [pay('151', 5, '#23:5ec44d20')] },
  '051': { effects: [gold(-10, '#33:0ee41c21')] },
  '230': { effects: [gold(-1, '#38:e0221957')] },
  '529': { effects: [gold(-7, '#29:de07af00')] },

  '014': { effects: [strength(-1, '#24:dab920ce')] },
  '021': { effects: [strength(-1, '#29:4b0833ff')] },
  '022': { effects: [gold(2, '#21:792870b1')] },
  '030': { effects: [gold(3, '#40:1cb5ddfa')] },
  '036': { effects: [optional('strength', 10, 'Съесть устрицу', '#32:e2965152')] },
  '038': { effects: [pickup('trident', '#33:695152d4')] },
  '040': { effects: [gold(-2, '#20:8390fa2b'), gain('urchinFish', '#31:45b81295')] },
  '043': { effects: [{ kind: 'agilityTest', dice: 2, strict: true, successLinks: ['557'], failureLinks: ['327'], source: '#44:79d04417' }] },
  '054': { effects: [strength(-2, '#28:a894bd42'), change('agility', -1, '#28:01cc8592')] },
  '059': { effects: [strength(-2, '#24:7f262c59')] },
  '065': { effects: [strength(6, '#33:164c7030'), optional('food', 1, 'Взять мяса с собой', '#14:74a847a8')] },
  '068': { effects: [strength(-4, '#24:9f4dfa9b')] },
  '074': { effects: [change('agility', -1, '#22:2841f502'), strength(-2, '#16:43eb45d6')] },
  '081': { effects: [change('luck', 1, '#17:03e5f6a0')] },
  '093': {
    effects: [strength(-4, '#23:adb27b7c')],
    conditions: [has('272', ['trident'], '#24:5c243bc5'), hasNone('608', ['trident'], '#11:abd49cb1')]
  },
  '094': {
    effects: [
      { kind: 'loseAll', stat: 'gold', source: '#34:b1571a8a' },
      { kind: 'loseAll', stat: 'food', source: '#34:b1571a8a' },
      gain('oldSword', '#20:73b8c4ad')
    ]
  },
  '122': { effects: [strength(6, '#28:6570c866')] },
  '139': { effects: [gold(5, '#20:bd126b9e')] },
  '150': {
    conditions: [
      has('341', ['amulet'], '#16:d866cc51'),
      has('348', ['rustySword'], '#32:1a04610b'),
      hasNone('609', ['amulet', 'rustySword'], '#31:44996ab3')
    ]
  },
  '164': { effects: [strength(-1, '#24:dab920ce')] },
  '172': { effects: [change('luck', -1, '#22:b998ea39')] },
  '173': { effects: [gain('axe', '#22:d72840e5')] },
  '184': { effects: [strength(-4, '#26:ed37865c')] },
  '186': { effects: [strength(5, '#33:d1315115')] },
  '192': { effects: [gold(2, '#22:e6340d60'), gain('driedCrab', '#22:e6340d60')], plainLinks: ['002'] },
  '202': { conditions: [has('045', ['ring'], '#32:8e84ad92'), hasNone('501', ['ring'], '#11:abd49cb1')] },
  '203': { effects: [strength(-2, '#24:7f262c59')] },
  '209': { effects: [{ kind: 'rollBranch', dice: 1, branches: [{ upTo: 3, link: '572' }, { upTo: 6, link: '141' }], source: '#18:3b16fe37' }] },
  '210': { effects: [{ kind: 'learnSpell', spell: 'luckSpell', source: '#18:6ab6fdd4' }], plainLinks: ['001'] },
  '219': { effects: [strength(6, '#28:6570c866'), optional('food', 1, 'Взять мяса с собой', '#26:7bae7c33')] },
  '223': { effects: [{ kind: 'loseItems', items: ['goldBelt'], source: '#26:16eefa16' }] },
  '246': { links: [need('390', 10, '#24:17fcaf19')] },
  '247': { links: ['542', '415', '114'].map(link => pay(link, 2, '#29:ff426f0e')) },
  '259': {
    links: [
      feed('428', 1, '#18:9e3e2645'), feed('091', 2, '#18:9e3e2645'),
      pay('392', 2, '#17:c9e78c26'), pay('544', 4, '#9:0b282ec9')
    ]
  },
  '260': { effects: [gain('goldShield', '#21:a1e06700')] },
  '279': { conditions: [has('458', ['sawFish'], '#25:bdfb3f7f'), hasNone('396', ['sawFish'], '#8:4061468c')] },
  '303': {
    conditions: [
      has('124', ['dish'], '#16:ff3a1cc4'),
      has('045', ['ring'], '#16:275423a3'),
      has('627', ['driedCrab'], '#14:d40a9efb')
    ]
  },
  '305': { effects: [strength(2, '#23:ef40d354')], links: [need('464', 10, '#24:f10ce904')] },
  '307': { effects: [gold(-2, '#20:8390fa2b'), { kind: 'change', stat: 'agility', amount: 1, aboveStart: true, source: '#27:a0056d10' }] },
  '319': { effects: [optional('strength', 10, 'Съесть устрицу', '#32:b07c7432')] },
  '323': { effects: [{ kind: 'rollBranch', dice: 1, branches: [{ upTo: 2, link: '132' }, { upTo: 4, link: '485' }, { upTo: 6, link: '573' }], source: '#17:f909b5b0' }] },
  '333': { effects: [change('luck', -1, '#17:334897e6')] },
  '351': { links: [need('051', 10, '#26:ddb75a54')] },
  '364': {
    effects: [{
      kind: 'retryRoll', dice: 2, hits: [2, 12], cost: { stat: 'strength', amount: 1 }, successLinks: ['283'], failureLinks: [],
      source: '#53:77190fd6'
    }]
  },
  '366': { effects: [strength(-3, '#24:a9871b5c')] },
  // The bottle: taken (200) or opened and kept (431); the post office (384, 568, 047)
  '200': { effects: [gain('bottle', '#25:b01f2eb5')] },
  '431': { effects: [gain('bottle', '#21:0419b161'), change('luck', -1, '#17:334897e6')] },
  '384': { conditions: [has('568', ['bottle'], '#35:31053d36'), hasNone('032', ['bottle'], '#11:81c89151')] },
  '568': {
    conditions: [
      { link: '333', section: '431', visited: true, source: '#29:6d3170e6' },
      { link: '047', section: '431', visited: false, source: '#8:89b0a6ec' }
    ]
  },
  '047': { effects: [lose(['bottle'], '#32:c24318f0')] },
  '377': { effects: [pickup('harpoon', '#46:b89387ec')] },
  '385': { effects: [change('food', 4, '#19:e6b096ac'), { kind: 'refill', stat: 'luck', source: '#51:ea88f0e2' }] },
  '390': { effects: [gold(-10, '#24:3cfc3e4e')] },
  '531': { links: [pay('280', 2, '#34:0b1077ff')] },
  '614': { conditions: [has('471', ['driedCrab'], '#12:ba0bb4d3'), hasNone('321', ['driedCrab'], '#11:81c89151')] },
  '471': { effects: [lose(['driedCrab'], '#34:df41063f')], conditions: [has('079', ['diadem'], '#20:f0a11b9e')] },
  '627': { effects: [lose(['driedCrab'], '#41:c1132f5e')] },
  // The Spirit of the current takes no money: what was offered comes back, and more (259)
  '392': { effects: [gold(4, '#23:32d24bb2')] },
  '544': { effects: [gold(4, '#25:487004a7')] },
  '620': { effects: [gold(4, '#34:24136ba4'), { kind: 'refill', stat: 'luck', plus: 1, source: '#70:f779fef8' }] },
  '408': { effects: [strength(-2, '#24:e0ad4179')] },
  '411': { effects: [strength(-2, '#24:7f262c59')] },
  '420': { effects: [strength(6, '#44:47ecb3ad'), optional('food', 1, 'Взять солонину с собой', '#36:b694d130')] },
  '434': { effects: [strength(-4, '#24:9f4dfa9b')] },
  '445': { effects: [strength(-2, '#34:681b29dd')] },
  // The Dwarf's fish, 2 gold each, only one (116)
  '450': { links: [need('116', 2, '#29:b8d74424')] },
  '116': { links: ['307', '452', '503', '040'].map(link => need(link, 2, '#45:88374fcc')) },
  '452': { effects: [gold(-2, '#20:042c0edc'), gain('sawFish', '#19:de7b7743')] },
  '503': { effects: [gold(-2, '#27:d03d2e47'), gain('moonFish', '#16:94745499')] },
  '463': { effects: [strength(-2, '#24:7f262c59')] },
  '098': { effects: [pickup('tridentRing', '#32:40f80f11')] },
  '477': { conditions: [has('092', ['tridentRing'], '#34:1ed2e77d'), hasNone('571', ['tridentRing'], '#11:abd49cb1')] },
  '485': { effects: [gold(10, '#21:36876d69')] },
  '506': { effects: [strength(-2, '#24:7f262c59')] },
  '518': { effects: [{ kind: 'agilityTest', dice: 2, strict: true, successLinks: ['323'], failureLinks: ['128'], source: '#44:79d04417' }] },
  '541': { effects: [gold(2, '#30:1d065672')] },
  '543': { effects: [change('luck', -1, '#17:4388cec6')] },
  '557': { effects: [gold(10, '#28:aa720568')] },
  '560': { effects: [strength(3, '#27:fd5977e5')] },
  '562': { effects: [strength(4, '#27:69c63e4a')] },
  '580': {
    effects: [strength(-1, '#24:dab920ce')],
    conditions: [has('219', ['trident'], '#24:5c243bc5'), hasNone('189', ['trident'], '#11:81c89151')]
  },
  '590': { effects: [gold(2, '#24:3d308cb3')] },
  '595': { effects: [strength(3, '#27:fd5977e5')] },
  '615': { effects: [pickup('harpoon', '#39:bacd87cf')] },
  '619': { effects: [gold(2, '#18:0d66fa60'), change('food', 2, '#17:df4d0bcd')] },
  '628': { effects: [strength(4, '#34:eb89969f'), optional('food', 1, 'Взять мясо с собой', '#12:53cf04f7')] },
  '120': { effects: [change('food', -1, '#19:82712a98')] },
  '105': {
    conditions: [
      has('502', ['medallion'], '#36:9c82f14a'),
      has('438', ['trident'], '#27:d494bf70'),
      hasNone('312', ['medallion', 'trident'], '#34:2bef1e4a')
    ]
  }
}

/** Generated and hand-written rules of a section together */
const merge = (a: Rules = {}, b: Rules = {}): Rules => ({
  ...(a.effects || b.effects ? { effects: [...(a.effects ?? []), ...(b.effects ?? [])] } : {}),
  ...(a.links || b.links ? { links: [...(a.links ?? []), ...(b.links ?? [])] } : {}),
  ...(a.conditions || b.conditions ? { conditions: [...(a.conditions ?? []), ...(b.conditions ?? [])] } : {}),
  ...(a.plainLinks || b.plainLinks ? { plainLinks: [...(a.plainLinks ?? []), ...(b.plainLinks ?? [])] } : {}),
  ...(a.fightersListed || b.fightersListed ? { fightersListed: true } : {})
})

// Generated, then hand-written, then the fights (combats.ts)
export const RULES: Readonly<Record<string, Rules>> = Object.fromEntries(
  [...new Set([...Object.keys(GENERATED), ...Object.keys(MANUAL), ...Object.keys(FIGHTS), ...LISTED])].sort()
    .map(id => [id, {
      ...merge(merge(GENERATED[id] as Rules | undefined, MANUAL[id]), FIGHTS[id] as Rules | undefined),
      ...(LISTED.includes(id) ? { fightersListed: true } : {})
    }])
)

export const ALL_ITEMS: Readonly<Record<ItemId, ItemDefinition>> = { ...GENERATED_ITEMS, ...ITEMS }
export const ALL_SPELLS: Readonly<Record<SpellId, SpellDefinition>> = { ...GENERATED_SPELLS, ...SPELLS }
