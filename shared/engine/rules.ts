/**
 * The rule vocabulary of the engine: what a book's sections can ask of the reader.
 *
 * A book pack (books/<id>/rules.ts) registers, per section, the mechanical instructions found in
 * its text. Every rule carries `source`: an exact quote from the section file, checked by the
 * pack's tests, so the registry cannot silently drift from the text.
 *
 * The types are generic over the book's own ids (stats, items, spells), so a pack gets
 * autocomplete and type errors for its names; the engine itself works with plain strings.
 */

export interface CombatEnemyStats {
  name: string | null
  /** The skill the fight uses (Ловкость for a sword fight, Сила мысли for a telepathic duel) */
  skill: number
  strength: number
}

export type SectionEffect<Stat extends string = string, Item extends string = string, Spell extends string = string> =
  // Applied automatically when the player arrives
  /** `aboveStart`: may exceed the initial value, which rises with it («даже если придется превысить изначальное») */
  | { kind: 'change'; stat: Stat; amount: number; aboveStart?: boolean; source: string }
  /** Back to the initial value, plus `plus` above it («восстановите УДАЧУ до изначального уровня и прибавьте еще 1») */
  | { kind: 'refill'; stat: 'luck' | 'strength' | 'agility'; plus?: number; source: string }
  | { kind: 'loseAll'; stat: 'gold' | 'food'; source: string }
  /** Eat 1 ЕДА if there is any, otherwise lose `penalty` СИЛЫ */
  | { kind: 'meal'; penalty: number; source: string }
  /** The next luck check fails without a roll */
  | { kind: 'luckPenalty'; source: string }
  | { kind: 'learnSpell'; spell: Spell; source: string }
  /** A code is gone: the ally died, the gift was used up */
  | { kind: 'forgetSpell'; spell: Spell; source: string }
  /** An item handed to the player (gift, chosen reward) */
  | { kind: 'gainItem'; item: Item; source: string }
  /** Items taken away (robbery) or used up */
  | { kind: 'loseItems'; items: Item[]; source: string }
  // Required: links stay locked until the player resolves them
  /** Roll `dice` d6 and lose that much СИЛА. `escapeLinks` stay usable instead of rolling */
  | { kind: 'roll'; dice: number; escapeLinks?: string[]; source: string }
  | CombatEffect
  /** 2d6 against a stat (ОБАЯНИЕ): success unlocks `successLinks`, failure unlocks `failureLinks` */
  | { kind: 'charismaTest'; successLinks: string[]; failureLinks: string[]; source: string }
  /** Success when the sum of `dice` d6 is not greater than the current ЛОВКОСТЬ */
  | { kind: 'agilityTest'; dice: number; strict?: boolean; successLinks: string[]; failureLinks: string[]; source: string }
  /** Lose the sum of `dice` d6 СИЛЫ; an even sum unlocks `successLinks`, an odd one `failureLinks` */
  | { kind: 'parityRoll'; dice: number; successLinks: string[]; failureLinks: string[]; source: string }
  /** Player d6 against opponent d6, higher wins; ties are rolled again */
  | { kind: 'duel'; successLinks: string[]; failureLinks: string[]; source: string }
  /**
   * Repeated rounds against a swarm (`enemy`, plural, e.g. «Летучие мыши»): each round kills 1d6
   * (accumulating) and costs `damageDice` d6 СИЛЫ. Resolved once `killTarget` are dead
   */
  | { kind: 'attrition'; enemy: string; killTarget: number; damageDice: number; source: string }
  // Optional actions offered as buttons
  | { kind: 'luckRestore'; source: string }
  | { kind: 'optional'; stat: Stat; amount: number; label: string; source: string }
  | { kind: 'purchase'; item: Item; price: number; source: string }
  /** Give a purchase back for its price; offered while the item is held */
  | { kind: 'refund'; item: Item; price: number; source: string }
  /** An item the player may take ("можете взять с собой") */
  | { kind: 'pickup'; item: Item; source: string }
  /**
   * Use a code: a spell, an ally, an item's power ("прибавьте 101 к номеру параграфа"). Offered when
   * it is known (or its item is carried); goes to `target`, or to this section plus the codes' numbers.
   * `with` names more codes added together ("сложите их между собой")
   */
  | { kind: 'castSpell'; spell: Spell; with?: readonly Spell[]; target?: string; source: string }
  /**
   * Try again and again, paying each time, until the dice show one of `hits` («кидайте кости до тех
   * пор, пока не выпадет 1:1 или 6:6, теряя за каждый бросок 1 ВЫНОСЛИВОСТЬ»); then `successLinks`
   * open. The other links stay open: the reader may give up at any time
   */
  | { kind: 'retryRoll'; dice: number; hits: readonly number[]; cost: { stat: Stat; amount: number }; successLinks: string[]; failureLinks: string[]; source: string }
  /**
   * Dice decide the way: the sum of `dice` d6 opens the first branch whose `upTo` it does not exceed
   * («1, 2 или 3 — 572, 4, 5 или 6 — 141»)
   */
  | { kind: 'rollBranch'; dice: number; branches: readonly { upTo: number; link: string }[]; source: string }
  /**
   * A puzzle whose answer is a section number («посмотрите параграф с соответствующим номером»):
   * the reader types a number; `answers` maps accepted numbers to the section they open
   */
  | { kind: 'riddle'; answers: Readonly<Record<string, string>>; prompt: string; source: string }

/**
 * A fight by the book rules: each round both sides roll 1d6 x 2 + skill (the book's sword or mind
 * skill); the higher total wounds the other side, a tie parries. Links stay locked until it is won
 * (except `escapeLinks`); losing all СИЛА is death.
 */
/** A named fighter on the reader's side */
export interface Fighter {
  name: string
  skill: number
  strength: number
}

export interface CombatEffect {
  kind: 'combat'
  type: 'sword' | 'mind'
  enemies: CombatEnemyStats[]
  /** An ally fights instead of the reader, who rolls for both sides; it falling loses the fight (`loseLinks`) */
  champion?: Fighter
  /** When the champion falls the reader takes its place and the fight goes on («в бой придется вступать вам») */
  takeOver?: boolean
  /** Allies beside the reader against the same enemy: they wound it when they out-hit it, and it strikes only the reader */
  helpers?: Fighter[]
  /** ВЫНОСЛИВОСТЬ carried by name across sections under this key («минус потери от ран»); the dead stay dead */
  persist?: string
  /** Starts only once this section's fight number `after` is over (counted among its fights) */
  after?: number
  /** СИЛА the player loses per wound (default 2) */
  enemyDamage?: number
  /** In-fight change to the player's skill, e.g. -1 when attacked from the air */
  skillModifier?: number
  /** The reader's throw of a double never wounds («чешуя отразила ваш удар») */
  doublesMiss?: boolean
  /** An enemy throw of `total` also costs the reader this («если на кубиках выпадает 12 ... потеряйте еще 1 МАСТЕРСТВО») */
  enemyThrow?: { total: number; stat: string; amount: number }
  /** The fight ends, lost but alive, when the reader is down to this СИЛА («если он уменьшил вашу ВЫНОСЛИВОСТЬ до 4»): `loseLinks` open */
  yieldAt?: number
  /** The fight is won when every enemy is down to this СИЛА (default 0) */
  targetStrength?: number
  /** Must be won within this many rounds, otherwise only `loseLinks` open */
  roundLimit?: number
  /** Links that open when the fight is lost without dying (round limit, or the NPC side losing) */
  loseLinks?: string[]
  /** Links usable while the fight is still on (flee, switch to telepathy) */
  escapeLinks?: string[]
  /** 'simultaneous': all enemies attack, the player picks a target. 'npc': enemies[0] fights enemies[1] */
  mode?: 'sequential' | 'simultaneous' | 'npc'
  /** Gained by the mind skill when the fight is won */
  reward?: number
  source: string
}

/** A cost or requirement attached to following a specific link */
export interface LinkRule {
  link: string
  /** gold and food must be at hand to follow the link; any other stat is simply spent (СИЛА, time) */
  stat: string
  amount: number
  /** A smaller cost while a code is at hand (the Dolphin carries you in 10 minutes instead of 30) */
  cheaper?: readonly { spell: string; amount: number }[]
  /** true: the amount is paid when the link is followed. false: it is only required (e.g. a bet) */
  charge: boolean
  source: string
}

/** A link available only when a stat meets a threshold ("если ваша Сила мысли больше 5") */
export interface StatCondition<Stat extends string = string> {
  link: string
  /** `purchases`: total price of the items bought in the book's shop section that the player holds */
  stat: Stat | 'purchases'
  op: '>=' | '>' | '<=' | '<' | '='
  value: number
  source: string
}

/** A link available only with (`any`) or without (`none`) one of the items ("если у вас есть золотой медальон") */
export interface ItemCondition<Item extends string = string> {
  link: string
  items: Item[]
  has: 'any' | 'none'
  source: string
}

/**
 * A link available only if a section has (not) been visited: the link's own («на какой остров из тех,
 * где вы еще не были»), or `section` («если вы уже открывали бутылку»)
 */
export interface VisitCondition {
  link: string
  visited: boolean
  section?: string
  source: string
}

/**
 * A link that depends on how this section's fights stand (counted among its fights, in order):
 * «если союзник победил, а оба ваши противника еще живы»
 */
export interface FightCondition {
  link: string
  fights: readonly { fight: number; won?: boolean; foesLeft?: number; takenOver?: boolean }[]
  source: string
}

export type LinkCondition<Stat extends string = string, Item extends string = string> = StatCondition<Stat> | ItemCondition<Item> | VisitCondition | FightCondition

export interface SectionRules<Stat extends string = string, Item extends string = string, Spell extends string = string> {
  effects?: SectionEffect<Stat, Item, Spell>[]
  links?: LinkRule[]
  conditions?: LinkCondition<Stat, Item>[]
  /** Numbers rendered as links by a digitization error; shown as plain text */
  plainLinks?: string[]
  /** The section's stat blocks only introduce fighters (an ally to call); nobody fights here */
  fightersListed?: boolean
}

/** How a section without links ends; sections not listed in a book's `endings` are deaths */
export type EndingKind = 'victory' | 'survived' | 'captured' | 'death'

/** Kinds applied automatically on arrival */
export const AUTOMATIC_EFFECTS: ReadonlySet<SectionEffect['kind']> = new Set([
  'change', 'refill', 'loseAll', 'meal', 'luckPenalty', 'learnSpell', 'forgetSpell', 'gainItem', 'loseItems'
])

/** Kinds that lock the section's links until resolved */
export const REQUIRED_EFFECTS: ReadonlySet<SectionEffect['kind']> = new Set([
  'roll', 'combat', 'charismaTest', 'agilityTest', 'parityRoll', 'duel', 'attrition', 'rollBranch'
])

/** Kinds whose result unlocks either their success or their failure links */
export type OutcomeEffect = Extract<SectionEffect, { successLinks: string[] }>

export const isOutcomeEffect = (effect: SectionEffect): effect is OutcomeEffect => 'successLinks' in effect
