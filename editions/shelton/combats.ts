import type { CombatEffect, Fighter, FightCondition, ItemCondition, LinkRule, SectionRules } from '#shared/engine/rules'

/**
 * «Тайна капитана Шелтона»: the fights. Several enemies attack at once unless the text says otherwise
 * (the preface, «БИТВА С НЕСКОЛЬКИМИ ПРОТИВНИКАМИ»). Allies called with a code fight for the reader
 * (`champion`): in the two-pair sections the reader fights one pair and the ally the other, and the
 * way on depends on which pair finishes first (`fights` conditions). Wounds carry between the sections
 * of one battle (`persist`, «минус потери от ран»). Fleeing costs 2 ВЫНОСЛИВОСТИ (the preface).
 *
 * Where the book branches on whether an ally who helped the reader survived (334), both ways stay open:
 * a helper is never struck in this engine.
 */

/** The stat block each section's fights are proved by (a fingerprint of its first line) */
const SRC: Readonly<Record<string, string>> = {
  '011': '#36:2daccd4f',
  '015': '#35:d873a033',
  '029': '#36:f527953c',
  '032': '#35:fd4d3e49',
  '033': '#37:c2adbcb6',
  '060': '#37:c0adb990',
  '063': '#57:5fd20d10',
  '066': '#36:ab398eff',
  '071': '#36:cd1640be',
  '073': '#35:d7739ea0',
  '080': '#37:c6adc302',
  '086': '#37:8f4a8198',
  '088': '#36:f20ad0dd',
  '100': '#36:29acc703',
  '113': '#21:a2966c5a',
  '131': '#35:e273aff1',
  '133': '#36:ab398eff',
  '137': '#57:77c40f99',
  '140': '#57:8c4d312c',
  '146': '#36:cf1643e4',
  '147': '#37:964a8c9d',
  '148': '#36:ab398eff',
  '149': '#36:ab398eff',
  '152': '#36:29acc703',
  '155': '#37:904a832b',
  '159': '#37:c2adbcb6',
  '170': '#35:fd4d3e49',
  '171': '#37:904a832b',
  '180': '#36:ab398eff',
  '181': '#37:904a832b',
  '185': '#35:fc4d3cb6',
  '194': '#37:964a8c9d',
  '204': '#35:fc4d3cb6',
  '211': '#35:71b326d9',
  '217': '#37:d1df1fe5',
  '218': '#37:904a832b',
  '224': '#35:d873a033',
  '226': '#57:77c40f99',
  '238': '#37:5e9bd629',
  '244': '#36:cb163d98',
  '248': '#37:c4adbfdc',
  '262': '#35:d7739ea0',
  '268': '#57:5fd20d10',
  '284': '#36:ab398eff',
  '285': '#36:cb163d98',
  '290': '#36:aa398d6c',
  '293': '#37:8f4a8198',
  '312': '#36:cb163d98',
  '329': '#37:c4adbfdc',
  '330': '#35:d7739ea0',
  '334': '#57:8c4d312c',
  '337': '#36:aa398d6c',
  '339': '#35:fc4d3cb6',
  '350': '#37:c6adc302',
  '388': '#37:c4adbfdc',
  '389': '#35:074d4e07',
  '397': '#35:d7739ea0',
  '398': '#36:ab398eff',
  '409': '#37:c6adc302',
  '425': '#35:d873a033',
  '427': '#35:fc4d3cb6',
  '430': '#35:fd4d3e49',
  '443': '#36:cb163d98',
  '449': '#57:77c40f99',
  '451': '#35:d7739ea0',
  '470': '#35:d7739ea0',
  '480': '#36:aa398d6c',
  '486': '#37:c0adb990',
  '487': '#37:c6adc302',
  '490': '#37:c4adbfdc',
  '491': '#56:c616158f',
  '494': '#36:29acc703',
  '507': '#35:d873a033',
  '517': '#37:c0adb990',
  '519': '#35:fc4d3cb6',
  '533': '#35:fc4d3cb6',
  '534': '#37:c6adc302',
  '539': '#35:074d4e07',
  '545': '#37:8f4a8198',
  '564': '#37:c0adb990',
  '565': '#37:8f4a8198',
  '566': '#36:cc163f2b',
  '570': '#55:d8d37b7c',
  '574': '#36:ab398eff',
  '577': '#36:aa398d6c',
  '582': '#57:c8f5325a',
  '583': '#56:c616158f',
  '589': '#56:c616158f',
  '594': '#35:d873a033',
  '596': '#37:d1e15e7c',
  '598': '#56:c616158f',
  '600': '#36:ab398eff',
  '625': '#57:b5d4348e'
}

/** Sections that go on with a battle print no stat block: a sentence of their own proves them */
const GOING_ON: Readonly<Record<string, string>> = {
  227: '#42:0c5c1e0a',
  498: '#25:8085f2eb',
  499: '#24:de0e3c43',
  607: '#20:adebc6a9'
}

const f = (name: string, skill: number, strength: number): Fighter => ({ name, skill, strength })
const P1 = f('ПЕРВЫЙ ПИРАТ', 10, 8)
const P2 = f('ВТОРОЙ ПИРАТ', 9, 8)
const P3 = f('ТРЕТИЙ ПИРАТ', 10, 8)
const W1 = f('ПЕРВЫЙ ВОИН', 10, 10)
const W2 = f('ВТОРОЙ ВОИН', 10, 10)
const SPOTTED_SHARK = f('ПЯТНИСТАЯ АКУЛА', 10, 10)
const SHARK = f('АКУЛА', 10, 16)
const CONDOR = f('КОНДОР', 9, 9)

type Options = Partial<Omit<CombatEffect, 'kind' | 'type' | 'enemies' | 'source'>>

/** A fight proved by its section's stat block; several enemies attack at once */
const fight = (id: string, enemies: Fighter[], options: Options = {}): CombatEffect => ({
  kind: 'combat',
  type: 'sword',
  enemies,
  ...(enemies.length > 1 ? { mode: 'simultaneous' } : {}),
  ...options,
  source: SRC[id] ?? GOING_ON[id]!
})

const flee = (link: string, source: string): LinkRule => ({ link, stat: 'strength', amount: 2, charge: true, source })
const has = (link: string, item: string, source: string): ItemCondition => ({ link, items: [item], has: 'any', source })
const when = (link: string, fights: FightCondition['fights'], source: string): FightCondition => ({ link, fights, source })

type Rules = SectionRules<string, string, string>

/** The pirates of the Великан (429): an ally fights pirate 1, the reader pirates 2 and 3 */
const twoPairs = (
  id: string,
  ally: Fighter,
  allyFirst: boolean,
  next: { bothLeft: string; oneLeft: string },
  source: string
): Rules => {
  const allyFight = fight(id, [P1], { champion: ally, takeOver: true, persist: 'pirates' })
  const ownFight = fight(id, [P2, P3], { persist: 'pirates', escapeLinks: [next.bothLeft, next.oneLeft] })
  const effects = allyFirst ? [allyFight, ownFight] : [ownFight, allyFight]
  const [ally_, own] = allyFirst ? [0, 1] : [1, 0]
  return {
    effects,
    conditions: [
      when(next.bothLeft, [{ fight: ally_, won: true, takenOver: false }, { fight: own, foesLeft: 2 }], source),
      when(next.oneLeft, [{ fight: ally_, won: true, takenOver: false }, { fight: own, foesLeft: 1 }], source)
    ]
  }
}

/** The battle goes on in pairs: the reader against pirate 3, the ally against pirate 2 (both carried) */
const pairsGoOn = (id: string, ally: Fighter): Rules => ({
  effects: [
    fight(id, [P3], { persist: 'pirates' }),
    fight(id, [P2], { champion: ally, takeOver: true, persist: 'pirates' })
  ]
})

/** The ally has won its pair and joins the reader against whoever is left */
const together = (id: string, ally: Fighter): Rules => ({
  effects: [fight(id, [P2, P3], { helpers: [ally], persist: 'pirates' })]
})

const CAPTAIN = f('КАПИТАН', 10, 14)
const RHINO = f('НОСОРОГ', 10, 8)
const LION = f('КРЫЛАТЫЙ ЛЕВ', 10, 8)
const WATER_KNIGHT = f('РЫЦАРЬ-ВОДЯНОЙ', 10, 9)
const SEA_KNIGHT = f('МОРСКОЙ РЫЦАРЬ', 11, 12)
const SAILOR = f('МОРЯК', 10, 12)
const PRINCE_WARRIOR = f('ВОИН', 11, 14)

/** An ally against all three pirates; if it falls, the reader fights on at 583 */
const allyAlone = (id: string, ally: Fighter, help?: string): Rules => ({
  effects: [fight(id, [P1, P2, P3], { champion: ally, persist: 'pirates', loseLinks: ['583'], ...(help ? { escapeLinks: [help] } : {}) })]
})

/** An ally against the two warriors (476); if it falls, the reader fights on at 063 */
const allyAgainstWarriors = (id: string, ally: Fighter): Rules => ({
  effects: [fight(id, [W1, W2], { champion: ally, persist: 'warriors', loseLinks: ['063'] })]
})

export const FIGHTS: Readonly<Record<string, Rules>> = {
  // One enemy
  '032': { effects: [fight('032', [f('БРЫЗГУН', 8, 9)])] },
  '071': { effects: [fight('071', [f('РЫЦАРЬ-ВОДЯНОЙ', 9, 12)], { escapeLinks: ['616'] })], conditions: [has('616', 'goldShield', '#23:2d1476e1')] },
  '073': { effects: [fight('073', [CONDOR], { persist: 'condor' })] },
  '086': { effects: [fight('086', [f('СПРУТ', 11, 15)])] },
  '088': { effects: [fight('088', [f('СТАРИК-ЛОДОЧНИК', 6, 10)])] },
  '100': { effects: [fight('100', [f('ГРИФ', 8, 10)])] },
  '131': { effects: [fight('131', [f('МОРСКОЙ ЧЕРТ', 9, 2)])] },
  '146': { effects: [fight('146', [f('ГИГАНТСКИЙ КРАБ', 9, 14)], { yieldAt: 4, loseLinks: ['078'] })] },
  '149': { effects: [fight('149', [LION], { skillModifier: -2 })], plainLinks: ['002'] },
  '152': { effects: [fight('152', [f('РЫБА-ХАМЕЛЕОН', 8, 10)])] },
  '155': { effects: [fight('155', [f('МОРСКАЯ ЗМЕЯ', 11, 14)], { enemyDamage: 3, enemyThrow: { total: 12, stat: 'agility', amount: -1 } })] },
  '170': { effects: [fight('170', [f('РЫБА', 8, 9)])] },
  '181': { effects: [fight('181', [f('ГИГАНТСКИЙ КАЛЬМАР', 11, 14)])] },
  '204': { effects: [fight('204', [f('ЭЛЕКТРИЧЕСКИЙ СКАТ', 8, 8)], { escapeLinks: ['153'] })], links: [flee('153', '#38:51ff3bf8')] },
  '211': { effects: [fight('211', [f('РЫБА-ВОРЧУН', 6, 7)])] },
  '217': { effects: [fight('217', [f('ВЕЛИКАН', 12, 24)], { targetStrength: 12, escapeLinks: ['331'] })], conditions: [has('331', 'amulet', '#22:65a717d1')] },
  '248': { effects: [fight('248', [f('НОСОРОГ', 10, 10)])] },
  '262': { effects: [fight('262', [CONDOR], { persist: 'condor' })] },
  '285': { effects: [fight('285', [f('МОРСКОЙ ЧЕРТ', 9, 10)], { targetStrength: 2, escapeLinks: ['121'] })], links: [flee('121', '#44:2c672111')] },
  '293': { effects: [fight('293', [f('ДРАКОН', 11, 15)])], plainLinks: ['005'] },
  '312': { effects: [fight('312', [f('ВОДЯНОЙ', 9, 10)], { roundLimit: 5, loseLinks: ['130'] })] },
  '339': { effects: [fight('339', [f('ПОВАР-ВОДЯНОЙ', 8, 8)], { roundLimit: 4, loseLinks: ['601'] })] },
  '388': { effects: [fight('388', [SPOTTED_SHARK])] },
  '389': { effects: [fight('389', [f('РЫБА-СОБАКА', 8, 7)])] },
  '397': { effects: [fight('397', [f('МОРСКОЙ ПАУК', 9, 9)])] },
  '398': { effects: [fight('398', [f('РЫБА-ЕДИНОРОГ', 10, 8)], { escapeLinks: ['119'] })], links: [flee('119', '#24:ffe69ec4')] },
  '409': { effects: [fight('409', [f('ДВОРЯНИН', 10, 12)])] },
  '427': { effects: [fight('427', [f('РЫЦАРЬ-ВОДЯНОЙ', 8, 8)])] },
  '430': { effects: [fight('430', [f('ЭЛЕКТРИЧЕСКИЙ УГОРЬ', 8, 9)], { enemyDamage: 4 })] },
  '451': { effects: [fight('451', [f('МОРСКОЙ ПАУК', 9, 9)])] },
  '507': { effects: [fight('507', [f('РЫБА-МОЛОТ', 9, 8)])] },
  '519': { effects: [fight('519', [f('ЭЛЕКТРИЧЕСКИЙ СКАТ', 8, 8)], { escapeLinks: ['153'] })], links: [flee('153', '#33:16fd55dd')] },
  '539': { effects: [fight('539', [f('МОРСКАЯ ИГЛА', 8, 7)])] },
  '566': { effects: [fight('566', [f('АКУЛА-ЛЮДОЕД', 9, 11)], { escapeLinks: ['134'] })], links: [flee('134', '#33:5a13f535')] },
  '574': { effects: [fight('574', [LION])] },
  '596': { effects: [fight('596', [f('ВЕЛИКАН', 12, 12)], { targetStrength: 2 })] },
  // The plant: every lost round costs 4; leaving the fight is 184
  '011': { effects: [fight('011', [f('РАСТЕНИЕ-УБИЙЦА', 8, 14)], { enemyDamage: 4, escapeLinks: ['184'] })] },
  // Scales turn aside a double
  '015': { effects: [fight('015', [f('МОРСКОЙ ДРАКОНЧИК', 9, 8)], { doublesMiss: true })] },
  // The shark that turns on the Dolphin: down to 8, either side
  '033': { effects: [fight('033', [SHARK], { targetStrength: 8, yieldAt: 8, loseLinks: ['362'], persist: 'shark' })] },
  '159': { effects: [fight('159', [SHARK], { targetStrength: 8, yieldAt: 8, loseLinks: ['362'], persist: 'shark' })] },
  '582': { effects: [fight('582', [SHARK], { persist: 'shark' })] },
  // A fish ally against the spotted shark; if it dies, the reader goes on at 268
  '029': { effects: [fight('029', [SPOTTED_SHARK], { champion: f('РЫБА-ЕЖ', 7, 12), persist: 'spottedShark', loseLinks: ['268'] })] },
  '425': { effects: [fight('425', [SPOTTED_SHARK], { champion: f('РЫБА-МОЛОТ', 9, 8), persist: 'spottedShark', loseLinks: ['268'] })] },
  '268': { effects: [fight('268', [SPOTTED_SHARK], { persist: 'spottedShark' })] },
  // The Кондор (369): an ally first, then the reader at 570
  '470': { effects: [fight('470', [CONDOR], { champion: f('ФИЛИН', 9, 9), persist: 'condor', loseLinks: ['570'] })] },
  '494': { effects: [fight('494', [CONDOR], { champion: f('ГРИФ', 8, 10), persist: 'condor', loseLinks: ['570'] })] },
  // Both birds at once: the Гриф fights, the Филин strikes beside it
  '330': { effects: [fight('330', [CONDOR], { champion: f('ГРИФ', 8, 10), helpers: [f('ФИЛИН', 9, 9)], persist: 'condor', loseLinks: ['570'] })] },
  '570': { effects: [fight('570', [CONDOR], { persist: 'condor' })] },
  // The Великан's warriors (476)
  '113': allyAgainstWarriors('113', RHINO),
  '194': allyAgainstWarriors('194', SEA_KNIGHT),
  '218': allyAgainstWarriors('218', f('ВОИН ПРИНЦА', 11, 14)),
  '337': allyAgainstWarriors('337', WATER_KNIGHT),
  '534': allyAgainstWarriors('534', SAILOR),
  // Мейстон: if he falls, back to 476 for another ally, or the reader fights (329); wounds stay
  '564': { effects: [fight('564', [W1, W2], { champion: CAPTAIN, persist: 'warriors', loseLinks: ['476', '329'] })] },
  '329': { effects: [fight('329', [W1, W2], { persist: 'warriors' })] },
  '063': { effects: [fight('063', [W1, W2], { persist: 'warriors' })] },
  // The Lion: one warrior flees, it fights the other; the reader steps in if it falls
  '180': { effects: [fight('180', [f('ВОИН', 10, 10)], { champion: LION, takeOver: true })] },
  // Treasure-hall guards: the first alone for five rounds, then the others join (or the reader flees)
  '244': {
    effects: [
      fight('244', [f('СТАРШИЙ РЫЦАРЬ-ВОДЯНОЙ', 9, 10)], { roundLimit: 5, persist: 'hall244' }),
      fight('244', [f('СТАРШИЙ РЫЦАРЬ-ВОДЯНОЙ', 9, 10), f('ПЕРВЫЙ РЫЦАРЬ-ВОДЯНОЙ', 8, 8), f('ВТОРОЙ РЫЦАРЬ-ВОДЯНОЙ', 7, 9)], { after: 0, persist: 'hall244', escapeLinks: ['158'] })
    ],
    conditions: [when('158', [{ fight: 0, won: true }], '#55:c10250bc')]
  },
  '533': { effects: [fight('533', [f('ПЕРВЫЙ РЫЦАРЬ-ВОДЯНОЙ', 8, 8), f('ВТОРОЙ РЫЦАРЬ-ВОДЯНОЙ', 7, 9)], { persist: 'hall244' })] },
  '443': {
    effects: [
      fight('443', [f('ПЕРВЫЙ РЫЦАРЬ-ВОДЯНОЙ', 9, 10)], { roundLimit: 5, persist: 'hall443' }),
      fight('443', [f('ПЕРВЫЙ РЫЦАРЬ-ВОДЯНОЙ', 9, 10), f('ВТОРОЙ РЫЦАРЬ-ВОДЯНОЙ', 8, 8), f('ТРЕТИЙ РЫЦАРЬ-ВОДЯНОЙ', 7, 9)], { after: 0, persist: 'hall443', escapeLinks: ['201'] })
    ],
    conditions: [when('201', [{ fight: 0, won: true }], '#48:e9041182')]
  },
  '185': { effects: [fight('185', [f('ПЕРВЫЙ ВОДЯНОЙ', 8, 8), f('ВТОРОЙ ВОДЯНОЙ', 7, 9)])] },
  '490': { effects: [fight('490', [f('ПЕРВАЯ ПИРАНЬЯ', 10, 10), f('ВТОРАЯ ПИРАНЬЯ', 10, 10)], { escapeLinks: ['591'] })], conditions: [has('591', 'amulet', '#22:65a717d1')] },
  '545': { effects: [fight('545', [f('ПЕРВАЯ БАРРАКУДА', 11, 15), f('ВТОРАЯ БАРРАКУДА', 11, 15)])] },
  '565': { effects: [fight('565', [f('ПЕРВАЯ БАРРАКУДА', 11, 15), f('ВТОРАЯ БАРРАКУДА', 11, 15)], { yieldAt: 4, loseLinks: ['062'] })] },
  // The pirates (429)
  '284': { effects: [fight('284', [P1, P2, P3], { persist: 'pirates', escapeLinks: ['229'] })] },
  '583': { effects: [fight('583', [P1, P2, P3], { persist: 'pirates' })] },
  '066': allyAlone('066', RHINO, '148'),
  '133': allyAlone('133', LION, '600'),
  '147': allyAlone('147', SEA_KNIGHT, '594'),
  '171': allyAlone('171', PRINCE_WARRIOR, '224'),
  '350': allyAlone('350', SAILOR),
  '480': allyAlone('480', WATER_KNIGHT),
  '486': allyAlone('486', CAPTAIN),
  '148': twoPairs('148', RHINO, true, { bothLeft: '598', oneLeft: '491' }, '#48:f004008b'),
  '600': twoPairs('600', LION, true, { bothLeft: '238', oneLeft: '227' }, '#34:0918a766'),
  '577': twoPairs('577', WATER_KNIGHT, true, { bothLeft: '137', oneLeft: '498' }, '#19:6b2123e0'),
  '080': twoPairs('080', SAILOR, true, { bothLeft: '589', oneLeft: '625' }, '#18:0f93d317'),
  '594': twoPairs('594', SEA_KNIGHT, false, { bothLeft: '226', oneLeft: '499' }, '#31:aaf7677c'),
  '224': twoPairs('224', PRINCE_WARRIOR, false, { bothLeft: '449', oneLeft: '607' }, '#29:0963decf'),
  // Мейстон's pair: 488 if he wins and the reader's pirates are dead, 198 if he fell
  '060': {
    ...twoPairs('060', CAPTAIN, true, { bothLeft: '140', oneLeft: '334' }, '#36:73b7767c'),
    conditions: [
      ...twoPairs('060', CAPTAIN, true, { bothLeft: '140', oneLeft: '334' }, '#36:73b7767c').conditions!,
      when('488', [{ fight: 0, won: true, takenOver: false }, { fight: 1, foesLeft: 0 }], '#15:97b4e96b'),
      when('198', [{ fight: 0, takenOver: true }], '#19:f258cb74')
    ]
  },
  '140': {
    effects: [
      fight('140', [P2], { champion: CAPTAIN, takeOver: true, persist: 'pirates' }),
      fight('140', [P3], { persist: 'pirates' })
    ],
    conditions: [
      when('488', [{ fight: 0, takenOver: false }], '#36:48d78001'),
      when('198', [{ fight: 0, takenOver: true }], '#21:8194ee63')
    ]
  },
  '137': pairsGoOn('137', WATER_KNIGHT),
  '226': pairsGoOn('226', SEA_KNIGHT),
  '238': pairsGoOn('238', LION),
  '449': pairsGoOn('449', PRINCE_WARRIOR),
  '589': pairsGoOn('589', SAILOR),
  '598': pairsGoOn('598', RHINO),
  '491': together('491', RHINO),
  '625': together('625', SAILOR),
  '334': together('334', CAPTAIN),
  '227': together('227', LION),
  '607': together('607', PRINCE_WARRIOR),
  '498': together('498', WATER_KNIGHT),
  '499': together('499', SEA_KNIGHT)
}

/** Sections whose stat blocks only introduce an ally to call: nobody fights there */
export const LISTED: readonly string[] = ['290', '487', '517']
