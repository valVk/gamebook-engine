/**
 * «Повелитель Безбрежной Пустыни»: every mechanical instruction in the story text, per section.
 *
 * Every rule carries `source`: an exact quote from the section file. The pack's tests check that
 * each quote still exists, so the registry cannot silently drift from the text.
 * Rule kinds and their meaning: shared/engine/rules.ts. Fights: ./combats.ts.
 */

import type { ItemCondition, LinkRule, SectionEffect, SectionRules, StatCondition } from '#shared/engine/rules'

/** Stats a rule can change; ОБАЯНИЕ only changes through its own test */
export type Stat = 'strength' | 'agility' | 'gold' | 'food' | 'mentalPower'

export type ItemId =
  | 'medallion' | 'bracelet' | 'belt' | 'cloak' | 'rope' | 'flask' | 'sword' | 'pigeon' | 'armor'
  | 'keys' | 'necklace' | 'ring' | 'scabbard' | 'guardSword' | 'nomadSword' | 'rustyBlade'

export type SpellId = 'reduction'

type Effect = SectionEffect<Stat, ItemId, SpellId>
type Rules = SectionRules<Stat, ItemId, SpellId>

const strength = (amount: number, source: string): Effect => ({ kind: 'change', stat: 'strength', amount, source })
const roll = (dice: number, source: string, escapeLinks?: string[]): Effect => ({ kind: 'roll', dice, source, escapeLinks })
const meal = (penalty: number, source: string): Effect => ({ kind: 'meal', penalty, source })
const mentalPower = (source: string): Effect => ({ kind: 'change', stat: 'mentalPower', amount: 1, source })
const luckRestore = (source = '#33:818ebff8'): Effect => ({ kind: 'luckRestore', source })
const bet = (link: string, source: string): LinkRule => ({ link, stat: 'gold', amount: 2, charge: false, source })
const mind = (link: string, op: StatCondition<Stat>['op'], value: number, source: string): StatCondition<Stat> =>
  ({ link, stat: 'mentalPower', op, value, source })
const has = (link: string, items: ItemId[], source: string): ItemCondition<ItemId> => ({ link, items, has: 'any', source })
const hasNone = (link: string, items: ItemId[], source: string): ItemCondition<ItemId> => ({ link, items, has: 'none', source })
// Abilities of a Сила мысли level stay available at higher levels
const abilities = (source: string) => [mind('490', '>=', 8, source), mind('262', '>=', 9, source), mind('134', '>=', 10, source)]

export const RULES: Readonly<Record<string, Rules>> = {
  '002': { effects: [strength(4, '#26:5a184c29')] },
  '004': { effects: [{ kind: 'loseAll', stat: 'food', source: '#13:61f3d4dd' }] },
  '005': { effects: [{ kind: 'optional', stat: 'food', amount: -1, label: 'Шуликуны украли 1 ЕДУ (если в мешке не было ничего, кроме еды)', source: '#8:a1e4fe20' }] },
  '012': { effects: [strength(-4, '#30:dfed2a1b')] },
  '015': { effects: [{ kind: 'change', stat: 'gold', amount: 3, source: '#23:f320c3f3' }] },
  '016': { conditions: [...abilities('#47:b229e3fa'), has('609', ['scabbard'], '#38:5fd4b921')] },
  '017': { effects: [strength(2, '#26:e3424993')] },
  '019': { effects: [strength(-2, '#16:c9cd167f')], conditions: [has('405', ['bracelet'], '#36:3370c866'), hasNone('398', ['bracelet'], '#36:3370c866')] },
  '020': { effects: [strength(2, '#26:e3424993')] },
  '021': { conditions: [mind('503', '>=', 8, '#34:7688a09e')] },
  '024': { effects: [meal(4, '#70:af949cb0')] },
  '026': { conditions: [mind('117', '>=', 5, '#32:318498c7')] },
  '027': { conditions: [has('406', ['flask'], '#41:e1dedce9'), hasNone('381', ['flask'], '#41:e1dedce9')] },
  '029': { effects: [roll(2, '#51:405d4b17')] },
  '033': { effects: [strength(-2, '#16:c9cd167f')] },
  '034': { effects: [strength(2, '#28:8a1d450a')] },
  '035': { conditions: [has('546', ['bracelet'], '#36:3370c866'), hasNone('430', ['bracelet'], '#8:89b0a6ec')] },
  '041': { effects: [strength(2, '#26:e3424993')] },
  '042': { effects: [strength(-2, '#21:02b1f6b2')], conditions: [mind('138', '>', 5, '#33:ff9769b9'), mind('595', '<=', 5, '#33:ff9769b9')] },
  '046': {
    effects: [
      mentalPower('#32:b98f687c'),
      { kind: 'change', stat: 'gold', amount: 3, source: '#54:49ddb341' }
    ]
  },
  '060': { effects: [roll(1, '#44:dc3b35e5', ['567'])] },
  '062': { effects: [roll(1, '#41:1226d46b')] },
  '063': { effects: [luckRestore()] },
  '067': { effects: [roll(2, '#53:8107ef4a')] },
  '070': { effects: [meal(4, '#52:f95c12b3')] },
  '077': { effects: [strength(-2, '#16:c9cd167f')] },
  '094': {
    effects: [
      luckRestore(),
      { kind: 'learnSpell', spell: 'reduction', source: '#64:c0aa658f' }
    ],
    links: [bet('217', '#33:143d150f')]
  },
  '099': { effects: [{ kind: 'gainItem', item: 'scabbard', source: '#20:a26cd673' }] },
  '102': { effects: [strength(-2, '#16:c9cd167f')] },
  '105': { effects: [{ kind: 'change', stat: 'agility', amount: -1, source: '#20:cd95c155' }] },
  '106': { effects: [strength(2, '#40:edd99c7c')] },
  '112': { conditions: [mind('418', '>=', 8, '#43:0a727ec6')] },
  '113': { conditions: [has('548', ['ring'], '#32:249f784a'), hasNone('163', ['ring'], '#32:249f784a')] },
  '114': { effects: [strength(-3, '#16:a00e25ee'), meal(2, '#20:04b1e5b8')] },
  '119': {
    effects: [
      roll(2, '#61:ffb897a3'),
      { kind: 'change', stat: 'food', amount: 2, source: '#31:224ae6e8' }
    ]
  },
  '125': { effects: [{ kind: 'agilityTest', dice: 2, successLinks: ['550'], failureLinks: ['316'], source: '#61:857687b9' }] },
  '127': { links: [{ link: '023', stat: 'strength', amount: 2, charge: true, source: '#24:411367a0' }], conditions: [has('589', ['cloak'], '#40:eb3fc793')] },
  '135': { effects: [strength(-2, '#33:0f3e4281')] },
  '146': { effects: [strength(-2, '#14:9e58459b')] },
  '154': { conditions: [has('599', ['medallion'], '#16:dfc8965d'), has('063', ['belt'], '#13:88596888'), hasNone('129', ['medallion', 'belt'], '#36:6539b3df')] },
  '157': { conditions: [has('456', ['medallion'], '#18:218cdf47'), has('208', ['belt'], '#15:b6bf866d')] },
  '159': { effects: [{ kind: 'parityRoll', dice: 2, successLinks: ['580'], failureLinks: ['457'], source: '#37:ab1b6d87' }] },
  '168': { conditions: [has('475', ['medallion'], '#18:218cdf47'), has('078', ['belt'], '#15:b6bf866d')] },
  '171': { effects: [roll(2, '#53:8107ef4a')] },
  '174': { effects: [strength(-4, '#16:917da94d')] },
  '178': { effects: [roll(2, '#54:807789b3')] },
  '184': { conditions: [has('225', ['medallion', 'belt'], '#50:9e777ffc'), hasNone('468', ['medallion', 'belt'], '#31:44996ab3')] },
  '185': { effects: [strength(-2, '#16:c9cd167f')] },
  '191': { effects: [strength(-2, '#16:c9cd167f')] },
  '193': { effects: [strength(-2, '#16:c9cd167f')] },
  '194': { effects: [roll(1, '#51:20340614', ['567'])] },
  '203': { effects: [{ kind: 'castSpell', spell: 'reduction', target: '328', source: '#35:69ce8a0f' }] },
  '212': {
    effects: [luckRestore()],
    links: [bet('330', '#51:9a786e67')]
  },
  '213': { effects: [{ kind: 'luckPenalty', source: '#38:9c517a36' }] },
  '216': { effects: [strength(-2, '#22:dcfd0c94')] },
  '217': { effects: [{ kind: 'duel', successLinks: ['584'], failureLinks: ['336'], source: '#51:bfc0aff1' }] },
  '222': {
    effects: [
      { kind: 'change', stat: 'gold', amount: 15, source: '#20:44432703' },
      { kind: 'change', stat: 'food', amount: 6, source: '#49:ff4f9a8f' }
    ]
  },
  '228': { effects: [{ kind: 'gainItem', item: 'medallion', source: '#31:046f7946' }] },
  '232': { conditions: [mind('103', '>=', 5, '#32:318498c7')] },
  '235': { conditions: [mind('018', '>', 5, '#29:97b5884d'), mind('492', '>', 6, '#12:28618d9d'), mind('108', '<=', 5, '#11:81c89151')] },
  '237': { conditions: [mind('355', '>', 5, '#29:97b5884d'), mind('509', '<=', 5, '#29:97b5884d')] },
  '238': { effects: [mentalPower('#47:4f151d72')] },
  '239': { effects: [strength(-6, '#15:8a52d22a')] },
  '243': { effects: [strength(2, '#23:3b9f1e28')] },
  '248': { effects: [strength(4, '#23:e5f6645a')] },
  '250': { conditions: [{ link: '413', stat: 'purchases', op: '>', value: 8, source: '#50:41361feb' }, { link: '540', stat: 'purchases', op: '<=', value: 8, source: '#43:a65c4cd3' }] },
  '251': { links: [{ link: '544', stat: 'strength', amount: 1, charge: true, source: '#22:2b0a587b' }] },
  '253': { conditions: [mind('140', '<=', 7, '#21:89ccd55e'), mind('439', '=', 8, '#6:092dd8d8'), mind('562', '=', 9, '#6:0a2dda6b'), mind('424', '>=', 10, '#7:511b1c59')] },
  '254': { effects: [{ kind: 'change', stat: 'agility', amount: -1, source: '#20:cd95c155' }] },
  '256': { effects: [roll(1, '#46:2d4aa3aa')] },
  '260': { conditions: [has('125', ['rope'], '#29:3bcfccca'), hasNone('425', ['rope'], '#29:3bcfccca')] },
  '273': { effects: [strength(2, '#26:e3424993')] },
  '275': { conditions: [has('166', ['medallion'], '#34:3ed0dd75'), has('610', ['belt'], '#29:c9819b6c')] },
  '276': { effects: [roll(2, '#44:69f1b6be')] },
  '280': { effects: [{ kind: 'gainItem', item: 'ring', source: '#30:85c47723' }] },
  '283': { effects: [roll(3, '#45:a5f6a8bc')] },
  '285': { effects: [{ kind: 'attrition', enemy: 'Гремлины', killTarget: 6, damageDice: 2, source: '#55:7b3f7f8c' }] },
  '291': { conditions: [mind('060', '>=', 7, '#31:970b5fa5'), mind('567', '<', 7, '#11:abd49cb1')] },
  '301': { conditions: [has('624', ['medallion'], '#32:48b73c40'), has('341', ['belt'], '#39:da6189c5'), hasNone('468', ['medallion', 'belt'], '#31:62d95c93')] },
  '317': { conditions: [has('063', ['belt'], '#30:706111cb'), has('599', ['medallion'], '#18:40a6ca71'), has('586', ['ring'], '#18:05003ca3')] },
  '322': { conditions: [has('616', ['medallion'], '#32:48b73c40'), has('462', ['belt'], '#23:678e7563'), hasNone('468', ['medallion', 'belt'], '#31:62d95c93')] },
  '330': { links: [bet('217', '#21:4ffbef78'), bet('229', '#21:4ffbef78')] },
  '336': {
    effects: [{ kind: 'change', stat: 'gold', amount: -2, source: '#29:2e1ee53d' }],
    links: [bet('217', '#22:23cd0ffe'), bet('229', '#25:3c257413')]
  },
  '340': { effects: [luckRestore()] },
  '341': { effects: [luckRestore()] },
  '345': { effects: [{ kind: 'charismaTest', successLinks: ['629'], failureLinks: ['245'], source: '#22:3958fce6' }] },
  '347': { links: [{ link: '523', stat: 'gold', amount: 3, charge: true, source: '#25:f86cbcb2' }] },
  '348': { effects: [mentalPower('#37:06ff7a0f')] },
  '353': { effects: [strength(2, '#26:e3424993')] },
  '357': { effects: [meal(4, '#27:df5dd094')] },
  '358': { links: [{ link: '002', stat: 'gold', amount: 2, charge: true, source: '#19:666057fb' }] },
  '361': { effects: [strength(-4, '#16:ef95a42d')] },
  '363': { effects: [meal(3, '#55:be8531b8')] },
  '366': { effects: [strength(4, '#26:364a57c9')] },
  '368': { links: [{ link: '268', stat: 'food', amount: 1, charge: true, source: '#14:2af3b16f' }] },
  '371': { conditions: [has('211', ['medallion', 'belt'], '#50:9e777ffc'), hasNone('468', ['medallion', 'belt'], '#50:9e777ffc')] },
  '374': {
    effects: [
      roll(2, '#45:93037b28'),
      { kind: 'change', stat: 'gold', amount: 10, source: '#20:936f75ce' }
    ]
  },
  '378': { effects: [strength(-4, '#21:15630c40')] },
  '380': { effects: [strength(-4, '#16:ef95a42d')] },
  '386': { conditions: [has('443', ['cloak', 'sword'], '#86:94ab07a6'), hasNone('279', ['cloak', 'sword'], '#11:81c89151')] },
  '392': { effects: [strength(-3, '#21:2d47c4fc')] },
  '400': { effects: [roll(2, '#71:aff993bd')] },
  '406': { effects: [{ kind: 'loseItems', items: ['flask'], source: '#20:98320b98' }, strength(-2, '#31:c78f9130')] },
  // СИЛА never exceeds its initial value, so adding the largest starting СИЛА (24) restores it fully
  '414': { effects: [strength(24, '#52:f1888df3')] },
  '418': { effects: [roll(2, '#51:405d4b17')] },
  '423': { effects: [{ kind: 'change', stat: 'gold', amount: 5, source: '#12:0c4a689b' }, { kind: 'pickup', item: 'necklace', source: '#18:fcbf4860' }, { kind: 'pickup', item: 'keys', source: '#13:bb6c128c' }] },
  '430': { conditions: [...abilities('#48:9e39f005')] },
  '436': { effects: [{ kind: 'change', stat: 'gold', amount: 1, source: '#18:cdc8c38a' }, { kind: 'pickup', item: 'nomadSword', source: '#36:bfd3fbac' }] },
  '457': { effects: [meal(4, '#55:c54daa8f')] },
  '473': { effects: [strength(-2, '#16:a9deb90b')] },
  '479': { effects: [strength(-4, '#16:917da94d')] },
  '482': { effects: [strength(-4, '#16:ef95a42d')] },
  '486': { conditions: [mind('360', '>=', 5, '#28:6f4128b3')] },
  '490': { effects: [roll(1, '#42:d319d4c0')] },
  '492': { effects: [strength(-1, '#16:38cb66d8')] },
  '496': { effects: [strength(-4, '#16:917da94d')] },
  '499': { effects: [meal(4, '#64:3b78a16e')] },
  '512': {
    effects: [
      { kind: 'purchase', item: 'rope', price: 2, source: '#13:69133489' },
      { kind: 'purchase', item: 'pigeon', price: 5, source: '#15:fcb20591' },
      { kind: 'purchase', item: 'cloak', price: 3, source: '#24:b04b316a' },
      { kind: 'purchase', item: 'sword', price: 5, source: '#24:d153d735' },
      { kind: 'purchase', item: 'belt', price: 5, source: '#13:88596888' },
      { kind: 'purchase', item: 'flask', price: 6, source: '#30:a898999a' },
      { kind: 'purchase', item: 'armor', price: 2, source: '#17:14690302' },
      // 059 (read from here): a purchase may be given back to the caravan merchant for its price
      { kind: 'refund', item: 'belt', price: 5, source: '#13:88596888' }
    ],
    plainLinks: ['002', '003', '005', '006']
  },
  '518': { effects: [{ kind: 'change', stat: 'food', amount: 1, source: '#15:0c0aafad' }] },
  '521': { effects: [strength(-2, '#16:c9cd167f')] },
  '527': { conditions: [has('609', ['scabbard'], '#33:b155b6cf')] },
  '537': { conditions: [mind('292', '<', 6, '#29:3e77e3ba'), mind('154', '>=', 6, '#19:441ffb13')] },
  '540': { effects: [strength(3, '#26:68e0c412')] },
  '548': { effects: [luckRestore()] },
  '554': { effects: [strength(-2, '#16:c9cd167f')] },
  '558': { effects: [strength(2, '#22:cbcdfc49'), meal(4, '#20:63bc7cc7')] },
  '560': { effects: [meal(4, '#27:69db4a87')] },
  '561': { effects: [roll(3, '#43:6de2eaf5')] },
  '570': { effects: [mentalPower('#42:1f4d366f')] },
  '573': { effects: [roll(2, '#45:93037b28')] },
  '574': { effects: [mentalPower('#42:8b9e900f')] },
  '575': { links: [{ link: '193', stat: 'food', amount: 1, charge: true, source: '#33:673d3771' }] },
  '576': { conditions: [{ link: '308', stat: 'strength', op: '>=', value: 4, source: '#33:366380f7' }, { link: '080', stat: 'strength', op: '<', value: 4, source: '#33:366380f7' }] },
  '587': { effects: [{ kind: 'gainItem', item: 'bracelet', source: '#12:7e20b49a' }] },
  '593': { conditions: [mind('194', '>=', 7, '#39:5ceab87b'), mind('567', '<', 7, '#39:5ceab87b')] },
  '594': {
    effects: [
      { kind: 'loseAll', stat: 'gold', source: '#38:6cdc5a79' },
      { kind: 'loseAll', stat: 'food', source: '#38:6cdc5a79' },
      { kind: 'loseItems', items: ['rope', 'pigeon', 'cloak', 'sword', 'belt', 'flask', 'armor', 'guardSword', 'nomadSword'], source: '#24:280f5f23' },
      // −2 ЛОВКОСТЬ while it is the only weapon (its `agility` in book.ts); a real sword found later replaces it
      { kind: 'gainItem', item: 'rustyBlade', source: '#35:8de38524' }
    ]
  },
  '605': { conditions: [has('215', ['medallion', 'belt'], '#50:9e777ffc'), hasNone('468', ['medallion', 'belt'], '#11:81c89151')] },
  '613': { effects: [{ kind: 'pickup', item: 'guardSword', source: '#20:0e38b433' }] },
  '614': { effects: [roll(1, '#42:d319d4c0')] },
  '619': { conditions: [has('204', ['keys'], '#21:765d33a8')] },
  '625': { effects: [mentalPower('#28:1fd44d15')] },
  '626': {
    effects: [{ kind: 'change', stat: 'gold', amount: -2, source: '#30:f90cb5aa' }],
    links: [bet('229', '#13:b724cfc4'), bet('217', '#16:1d697bfc')]
  },
  '628': { effects: [{ kind: 'charismaTest', successLinks: ['375'], failureLinks: ['270'], source: '#22:3958fce6' }] },
  '630': { effects: [{ kind: 'charismaTest', successLinks: ['265'], failureLinks: ['408', '555', '547'], source: '#22:3958fce6' }] }
}
