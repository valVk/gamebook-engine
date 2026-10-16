import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { getBook } from '#shared/engine/library'
import { AUTOMATIC_EFFECTS, REQUIRED_EFFECTS, isOutcomeEffect } from '#shared/engine/rules'
import type { CombatEffect, LinkCondition, LinkRule, SectionEffect, StatCondition } from '#shared/engine/rules'
import { rollDice, useCharacter } from '~/composables/useCharacter'
import { parseSectionHref } from '~/utils/character'
import type { EffectOutcome } from '~/utils/character'

export interface EffectEntry {
  index: number
  effect: SectionEffect
  outcome?: EffectOutcome
  resolved: boolean
  automatic: boolean
  required: boolean
}

export type LinkState =
  | { status: 'open'; cost?: LinkRule }
  | { status: 'locked'; reason: 'dead' | 'required' | 'test' }
  | { status: 'unaffordable'; cost: LinkRule }
  | { status: 'unavailable'; condition: LinkCondition }
  | { status: 'testSuccess' | 'testFailure' | 'testDimmed' }
  | { status: 'plain' }
  | { status: 'peek' }

const EFFECT_LINK_CLASSES = ['effect-locked', 'effect-success', 'effect-failure', 'effect-dimmed', 'link-unaffordable']

/**
 * Outcomes resolved during this visit of the app (not restored from storage): their cards play
 * the reveal. Kept in memory only, so a reload shows the cards as they ended.
 */
const freshOutcomes = new Set<string>()

export const formatCost = (rule: LinkRule) => `${rule.charge ? '−' : 'нужно '}${rule.amount} ${getBook().statLabel(rule.stat).of}`

const OPERATORS = { '>=': '≥', '>': '>', '<=': '≤', '<': '<', '=': '=' } as const

export const formatCondition = (condition: LinkCondition) => {
  if ('visited' in condition) return condition.section ? 'не по вашему пути' : 'вы здесь уже были'
  if ('fights' in condition) return 'зависит от того, как идет бой'
  if ('items' in condition) {
    const names = condition.items.map(item => getBook().itemName(item)).join(' или ')
    return condition.has === 'any' ? `нужно: ${names}` : `только если у вас нет: ${names}`
  }
  const name = condition.stat === 'purchases' ? 'покупки у торговца' : getBook().statLabel(condition.stat).name
  return `нужно: ${name} ${OPERATORS[condition.op]} ${condition.value}`
}

const compare = (actual: number, { op, value }: StatCondition) => {
  switch (op) {
    case '>=': return actual >= value
    case '>': return actual > value
    case '<=': return actual <= value
    case '<': return actual < value
    case '=': return actual === value
  }
}

/** Prices of the items sold in the book's shop section, by the name in the backpack */
const shopPrices = () => {
  const book = getBook()
  if (!book.shop) return new Map<string, number>()
  return new Map((book.getSectionRules(book.shop).effects ?? [])
    .flatMap(effect => (effect.kind === 'purchase' ? [[book.itemName(effect.item), effect.price] as const] : [])))
}

/** Sum of an item property over the backpack (armour penalties, daily costs) */
const carried = (inventory: readonly string[], value: (name: string) => number | undefined) =>
  inventory.reduce((sum, name) => sum + (value(name) ?? 0), 0)

/**
 * Applies and tracks the mechanical instructions of a section (the book's rules, shared/engine/rules.ts):
 * automatic stat changes on arrival, required rolls/tests that lock links, optional actions,
 * link costs and reference (peek) links. State is stored per section in the character, so a
 * reload never applies an effect twice.
 */
export const useSectionEffects = (pageId: MaybeRefOrGetter<string>) => {
  const character = useCharacter()
  const id = () => toValue(pageId)
  const book = getBook()
  const rules = computed(() => book.getSectionRules(id()))
  const itemProperty = (name: string) => book.item(book.itemId(name) ?? '')

  const entries = computed<EffectEntry[]>(() => {
    const resolved = character.getResolvedEffects(id())
    return (rules.value.effects ?? []).map((effect, index) => ({
      index,
      effect,
      outcome: resolved[index],
      // Repeated actions (attrition, combat) store progress before they are finished
      resolved: effect.kind === 'attrition' || effect.kind === 'combat' || effect.kind === 'retryRoll' ? resolved[index]?.done === true : index in resolved,
      automatic: AUTOMATIC_EFFECTS.has(effect.kind),
      required: REQUIRED_EFFECTS.has(effect.kind)
    }))
  })

  /** Unresolved roll/combat/attrition effects lock every link except their escape links. Tests lock only their own links */
  const pendingRequired = computed(() =>
    entries.value.filter(entry => entry.required && !entry.resolved && !isOutcomeEffect(entry.effect)))

  /** ЛОВКОСТЬ change that applies only during this section's sword fight (e.g. 145: −3), or null */
  const fightModifier = computed(() => {
    const fight = entries.value.find(entry => entry.effect.kind === 'combat' && !entry.resolved)
    return fight?.effect.kind === 'combat' && fight.effect.type === 'sword' && fight.effect.skillModifier
      ? fight.effect.skillModifier
      : null
  })

  const hasPendingRequired = computed(() =>
    entries.value.some(entry => entry.required && !entry.resolved))

  const resolve = (index: number, outcome: EffectOutcome = {}) => {
    freshOutcomes.add(`${id()}:${index}`)
    character.resolveEffect(id(), index, outcome)
  }

  /** True when the effect was resolved in this visit, so its card should be dealt with the reveal */
  const isFresh = (index: number) => freshOutcomes.has(`${id()}:${index}`)

  const entryOf = <K extends SectionEffect['kind']>(index: number, kind: K) => {
    const entry = entries.value[index]
    if (!entry || entry.resolved || entry.effect.kind !== kind) return null
    return entry as EffectEntry & { effect: Extract<SectionEffect, { kind: K }> }
  }

  /** Apply automatic effects that have not been applied in this visit yet */
  const applyArrival = () => {
    if (!character.isCharacterCreated.value || character.isDead.value) return

    for (const entry of entries.value) {
      if (!entry.automatic || entry.resolved) continue
      const { effect } = entry

      switch (effect.kind) {
        case 'change':
          resolve(entry.index, { value: character.applyChange(effect.stat, effect.amount, effect.aboveStart) })
          break
        case 'refill':
          resolve(entry.index, { value: character.refill(effect.stat, effect.plus) })
          break
        case 'loseAll':
          resolve(entry.index, { value: character.loseAll(effect.stat) })
          break
        case 'meal': {
          const hasFood = character.character.value.food > 0
          const value = hasFood ? character.applyChange('food', -1) : character.applyChange('strength', -effect.penalty)
          // A meal marks a day on the road: items with a daily cost (armour) take their СИЛА
          const daily = carried(character.character.value.inventory, name => itemProperty(name)?.dailyStrength)
          const burden = daily ? -character.applyChange('strength', -daily) : 0
          resolve(entry.index, { success: hasFood, value, ...(burden ? { damage: burden } : {}) })
          break
        }
        case 'luckPenalty':
          character.applyLuckPenalty()
          resolve(entry.index)
          break
        case 'learnSpell':
          character.learnSpell(effect.spell)
          resolve(entry.index)
          break
        case 'forgetSpell':
          resolve(entry.index, { value: character.forgetSpell(effect.spell) ? -1 : 0 })
          break
        case 'gainItem':
          if (!character.hasItem(book.itemName(effect.item))) character.addItem(book.itemName(effect.item))
          resolve(entry.index)
          break
        case 'loseItems': {
          const lost = effect.items.filter(item => character.removeItem(book.itemName(item)))
          resolve(entry.index, { value: -lost.length })
          break
        }
      }
    }
    settleCarriedFights()
  }

  // Required actions

  const roll = (index: number) => {
    const entry = entryOf(index, 'roll')
    if (!entry) return null
    const dice = rollDice(entry.effect.dice)
    const total = dice.reduce((sum, value) => sum + value, 0)
    character.applyChange('strength', -total)
    resolve(index, { value: total, dice })
    return { dice, total }
  }


  const testCharisma = (index: number) => {
    if (!entryOf(index, 'charismaTest')) return null
    const result = character.testCharisma()
    resolve(index, { success: result.success, value: result.roll })
    return result
  }

  const testAgility = (index: number) => {
    const entry = entryOf(index, 'agilityTest')
    if (!entry) return null
    const dice = rollDice(entry.effect.dice)
    const total = dice.reduce((sum, value) => sum + value, 0)
    const agility = character.character.value.agility
    const success = entry.effect.strict ? total < agility : total <= agility
    resolve(index, { success, value: total, dice })
    return { dice, total, success }
  }

  /** One more try: pay, throw, and stop at a hit */
  const retryRoll = (index: number) => {
    const entry = entryOf(index, 'retryRoll')
    if (!entry || character.isDead.value) return null
    const { effect } = entry
    character.applyChange(effect.cost.stat, -effect.cost.amount)
    const dice = rollDice(effect.dice)
    const total = dice.reduce((sum, value) => sum + value, 0)
    const hit = effect.hits.includes(total)
    const tries = (entry.outcome?.rounds ?? 0) + 1
    resolve(index, { value: total, dice, rounds: tries, damage: tries * effect.cost.amount, ...(hit ? { done: true, success: true } : {}) })
    return { dice, total, hit }
  }

  /** Dice pick one of several ways; the outcome's value is the index of the branch taken */
  const rollBranch = (index: number) => {
    const entry = entryOf(index, 'rollBranch')
    if (!entry) return null
    const dice = rollDice(entry.effect.dice)
    const total = dice.reduce((sum, value) => sum + value, 0)
    const branches = entry.effect.branches
    const taken = Math.max(0, branches.findIndex(branch => total <= branch.upTo))
    resolve(index, { value: total, dice, target: taken, success: true })
    return { dice, total, link: branches[taken]!.link }
  }

  const parityRoll = (index: number) => {
    const entry = entryOf(index, 'parityRoll')
    if (!entry) return null
    const dice = rollDice(entry.effect.dice)
    const total = dice.reduce((sum, value) => sum + value, 0)
    character.applyChange('strength', -total)
    resolve(index, { success: total % 2 === 0, value: total, dice })
    return { dice, total }
  }

  /** Returns null on a tie (roll again) */
  const duel = (index: number) => {
    if (!entryOf(index, 'duel')) return null
    const [player, opponent] = rollDice(2) as [number, number]
    if (player === opponent) return { player, opponent, tie: true }
    resolve(index, { success: player > opponent, value: player, dice: [player, opponent] })
    return { player, opponent, tie: false }
  }

  /** One round of a repeated fight: kills accumulate, every round costs СИЛА */
  const attritionRound = (index: number) => {
    const entry = entryOf(index, 'attrition')
    if (!entry || character.isDead.value) return null
    const [kills] = rollDice(1) as [number]
    const damageDice = rollDice(entry.effect.damageDice)
    const damage = damageDice.reduce((sum, value) => sum + value, 0)
    character.applyChange('strength', -damage)

    const previous = entry.outcome
    const totalKills = (previous?.value ?? 0) + kills
    const done = totalKills >= entry.effect.killTarget
    resolve(index, {
      value: totalKills,
      damage: (previous?.damage ?? 0) + damage,
      rounds: (previous?.rounds ?? 0) + 1,
      dice: [kills, ...damageDice],
      ...(done ? { done, success: true } : {})
    })
    return { kills, damage, totalKills }
  }

  /** СИЛА a wound by the player costs the enemy: the strongest weapon carried decides sword fights */
  const woundDamage = (type: 'sword' | 'mind') => type === 'sword'
    ? Math.max(2, ...character.character.value.inventory.map(name => itemProperty(name)?.damage ?? 0))
    : 2

  /** The mind skill is the book's own attribute (Сила мысли); a book without one fights by ЛОВКОСТЬ */
  const mindSkill = book.character.mindSkill
  const combatSkill = (type: 'sword' | 'mind', modifier = 0) =>
    (type === 'mind' && mindSkill
      ? character.getAttribute(mindSkill)
      // A weapon that helps only in a fight («в бою это оружие добавит вам 1 МАСТЕРСТВО»)
      : character.character.value.agility + carried(character.character.value.inventory, name => itemProperty(name)?.fightSkill))
    + modifier

  /** An attack roll, by the book: one die doubled, or two dice summed */
  const attackRoll = () => {
    if (book.combat?.attack === 'sum') {
      const dice = rollDice(2)
      return { dice, value: dice[0]! + dice[1]! }
    }
    const die = rollDice(1)[0]!
    return { dice: [die], value: die * 2 }
  }

  /** This section's fights, in order (FightCondition counts them this way) */
  const fightEntries = computed(() => entries.value.filter(entry => entry.effect.kind === 'combat'))

  const foes = () => character.character.value.foes
  const foeKey = (effect: CombatEffect, name: string | null) => (effect.persist && name ? `${effect.persist}:${name}` : null)
  const carriedStrength = (effect: CombatEffect, name: string | null, strength: number) => {
    const key = foeKey(effect, name)
    return key && key in foes() ? foes()[key]! : strength
  }

  /** Where a fight stands: enemies' and the champion's ВЫНОСЛИВОСТЬ (carried from earlier sections if `persist`) */
  const fightState = (index: number) => {
    const entry = entries.value[index]
    const effect = entry?.effect.kind === 'combat' ? entry.effect : null
    if (!entry || !effect) return { enemies: [] as number[], foesLeft: 0, champion: undefined as number | undefined, helpers: [] as number[] }
    const enemies = entry.outcome?.enemies ?? effect.enemies.map(enemy => carriedStrength(effect, enemy.name, enemy.strength))
    const champion = effect.champion
      ? entry.outcome?.champion ?? carriedStrength(effect, effect.champion.name, effect.champion.strength)
      : undefined
    const down = (strength: number) => strength <= (effect.targetStrength ?? 0)
    const helpers = (effect.helpers ?? []).map(helper => carriedStrength(effect, helper.name, helper.strength))
    return { enemies, foesLeft: enemies.filter(strength => !down(strength)).length, champion, helpers }
  }

  /** Remember everyone's ВЫНОСЛИВОСТЬ for the next section of the same battle («минус потери от ран») */
  const remember = (effect: CombatEffect, enemies: number[], champion?: number) => {
    if (!effect.persist) return
    const next = { ...foes() }
    effect.enemies.forEach((enemy, i) => {
      const key = foeKey(effect, enemy.name)
      if (key) next[key] = enemies[i]!
    })
    const championKey = effect.champion && foeKey(effect, effect.champion.name)
    if (championKey && champion !== undefined) next[championKey] = champion
    character.setFoes(next)
  }

  /** The reader's own fights here are all won: they may help an ally still fighting («можете помочь союзнику») */
  const canHelp = (index: number) => {
    const entry = entryOf(index, 'combat')
    if (!entry?.effect.champion || entry.outcome?.takenOver || entry.outcome?.helped) return false
    return fightEntries.value.some(other => other.index !== index && other.effect.kind === 'combat' && !other.effect.champion && other.resolved && other.outcome?.success)
  }

  const help = (index: number) => {
    const entry = entryOf(index, 'combat')
    if (!entry || !canHelp(index)) return
    const state = fightState(index)
    resolve(index, { ...entry.outcome, enemies: state.enemies, champion: state.champion, rounds: entry.outcome?.rounds ?? 0, damage: entry.outcome?.damage ?? 0, helped: true })
  }

  /**
   * One round of attack (the preface, «БОЙ»): both sides roll + skill, the higher total wounds the
   * other side, equal totals parry. `target` picks the enemy in a simultaneous fight. The one fighting
   * is the reader, or an ally (`champion`) the reader rolls for; whoever helps (`helpers`, or the
   * reader joining an ally) wounds the targeted enemy when out-hitting it, and is never struck.
   */
  /** A fight that waits for another of this section's fights to be over */
  const waiting = (index: number) => {
    const entry = entries.value[index]
    const after = entry?.effect.kind === 'combat' ? entry.effect.after : undefined
    return after !== undefined && fightEntries.value[after]?.resolved !== true
  }

  const combatRound = (index: number, target = 0) => {
    const entry = entryOf(index, 'combat')
    if (!entry || character.isDead.value || waiting(index)) return null
    const { effect } = entry
    const mode = effect.mode ?? 'sequential'
    const start = fightState(index)
    const enemies = [...start.enemies]
    let champion = start.champion
    let takenOver = entry.outcome?.takenOver === true
    const down = (strength: number) => strength <= (effect.targetStrength ?? 0)
    const wound = (i: number, amount: number) => { enemies[i] = Math.max(0, enemies[i]! - amount) }
    const rounds = (entry.outcome?.rounds ?? 0) + 1
    let damage = 0
    let dice: number[]
    let attacks: number[]
    let struck: number | undefined
    let allyRound = false

    if (mode === 'npc') {
      // The player rolls for both sides: enemies[0] (the side the player hopes wins) against enemies[1]
      const a = attackRoll()
      const b = attackRoll()
      const attackA = a.value + effect.enemies[0]!.skill
      const attackB = b.value + effect.enemies[1]!.skill
      if (attackA > attackB) wound(1, 2)
      else if (attackB > attackA) wound(0, 2)
      dice = [...a.dice, ...b.dice]
      attacks = [attackA, attackB]
    } else {
      const byChampion = effect.champion !== undefined && !takenOver
      allyRound = byChampion
      const sword = effect.type === 'sword'
      const inventory = character.character.value.inventory
      const mainRoll = attackRoll()
      const mainAttack = mainRoll.value + (byChampion ? effect.champion!.skill : combatSkill(effect.type, effect.skillModifier))
      const mainDamage = byChampion ? 2 : woundDamage(effect.type)
      // Armour: "Сила удара у противника станет на 1 меньше" (it protects only the reader)
      const armor = sword && !byChampion ? carried(inventory, name => itemProperty(name)?.enemyAttackPenalty) : 0
      const alive = enemies.map((strength, i) => (down(strength) ? -1 : i)).filter(i => i >= 0)
      const fighting = mode === 'simultaneous' ? alive : alive.slice(0, 1)
      const targeted = mode === 'simultaneous' && alive.includes(target) ? target : alive[0]!
      const enemyRolls = fighting.map(() => attackRoll())
      dice = [...mainRoll.dice, ...enemyRolls.flatMap(roll => roll.dice)]
      attacks = [mainAttack, ...enemies.map(() => -1)]
      struck = targeted

      const deflected = !byChampion && effect.doublesMiss === true && mainRoll.dice.length > 1 && mainRoll.dice.every(die => die === mainRoll.dice[0])
      fighting.forEach((i, n) => {
        const enemyAttack = enemyRolls[n]!.value + effect.enemies[i]!.skill - armor
        attacks[i + 1] = enemyAttack
        if (enemyAttack > mainAttack) {
          damage += byChampion ? 2 : effect.enemyDamage ?? 2
        } else if (mainAttack > enemyAttack && i === targeted && !deflected) {
          wound(i, mainDamage)
        }
        if (!byChampion && effect.enemyThrow && enemyRolls[n]!.value === effect.enemyThrow.total) {
          character.applyChange(effect.enemyThrow.stat, effect.enemyThrow.amount)
        }
      })

      // Helpers strike the targeted enemy too
      const targetAttack = attacks[targeted + 1]!
      const helpers = [
        ...(effect.helpers ?? []).filter(helper => carriedStrength(effect, helper.name, helper.strength) > 0).map(helper => ({ skill: helper.skill, damage: 2 })),
        ...(byChampion && entry.outcome?.helped ? [{ skill: combatSkill(effect.type), damage: woundDamage(effect.type) }] : [])
      ]
      for (const helper of helpers) {
        const roll = attackRoll()
        dice.push(...roll.dice)
        if (!down(enemies[targeted]!) && roll.value + helper.skill > targetAttack) wound(targeted, helper.damage)
      }

      if (byChampion) {
        champion = Math.max(0, (champion ?? 0) - damage)
        if (champion <= 0 && effect.takeOver) takenOver = true
        damage = 0
      } else if (damage) {
        character.applyChange('strength', -damage)
      }
    }

    const won = mode === 'npc' ? down(enemies[1]!) : enemies.every(down)
    const championFell = effect.champion !== undefined && !takenOver && (champion ?? 0) <= 0
    const lost = mode === 'npc'
      ? down(enemies[0]!)
      : character.isDead.value || championFell
        || (!won && effect.yieldAt !== undefined && (effect.champion === undefined || takenOver) && character.character.value.strength <= effect.yieldAt)
        || (!won && effect.roundLimit !== undefined && rounds >= effect.roundLimit)
    const done = won || lost

    if (won && effect.reward && mindSkill) character.applyChange(mindSkill, effect.reward)
    remember(effect, enemies, champion)

    resolve(index, {
      enemies,
      rounds,
      dice,
      attacks,
      ...(struck !== undefined ? { target: struck } : {}),
      ...(champion !== undefined ? { champion } : {}),
      ...(takenOver ? { takenOver } : {}),
      ...(entry.outcome?.helped ? { helped: true } : {}),
      ...(allyRound ? { allyRound } : {}),
      damage: (entry.outcome?.damage ?? 0) + damage,
      ...(done ? { done, success: won } : {})
    })
    return { dice, damage, enemies, done, won, champion, takenOver }
  }

  /** Fights of a battle whose enemies all fell in an earlier section are already won */
  const settleCarriedFights = () => {
    for (const entry of fightEntries.value) {
      if (entry.resolved || entry.effect.kind !== 'combat' || !entry.effect.persist) continue
      const state = fightState(entry.index)
      if (state.foesLeft === 0 && state.enemies.length) {
        resolve(entry.index, { enemies: state.enemies, rounds: 0, damage: 0, done: true, success: true })
      }
    }
  }

  /** Items that can be thrown once in this fight (a harpoon), by name */
  const strikes = computed(() => character.character.value.inventory.filter(name => itemProperty(name)?.strike))

  /** Throw a one-use weapon at the enemy fought (or targeted): it loses the item's `strike` at once */
  const strike = (index: number, item: string, target = 0) => {
    const entry = entryOf(index, 'combat')
    const damage = itemProperty(item)?.strike
    if (!entry || !damage || !character.hasItem(item)) return null
    const { effect } = entry
    const enemies = [...(entry.outcome?.enemies ?? effect.enemies.map(enemy => enemy.strength))]
    const down = (strength: number) => strength <= (effect.targetStrength ?? 0)
    const alive = enemies.map((strength, i) => (down(strength) ? -1 : i)).filter(i => i >= 0)
    const targeted = effect.mode === 'simultaneous' && alive.includes(target) ? target : alive[0]
    if (targeted === undefined) return null
    enemies[targeted] = Math.max(0, enemies[targeted]! - damage)
    character.removeItem(item)
    const won = enemies.every(down)
    resolve(index, {
      ...entry.outcome,
      enemies,
      rounds: entry.outcome?.rounds ?? 0,
      damage: entry.outcome?.damage ?? 0,
      target: targeted,
      ...(won ? { done: true, success: true } : {})
    })
    return { enemies, won }
  }

  // Optional actions

  const restoreLuck = (index: number) => {
    if (!entryOf(index, 'luckRestore')) return null
    const result = character.restoreLuck()
    resolve(index, { success: !result.wasAlreadyAvailable, value: result.roll ?? result.score })
    return result
  }

  const applyOptional = (index: number) => {
    const entry = entryOf(index, 'optional')
    if (!entry) return
    resolve(index, { value: character.applyChange(entry.effect.stat, entry.effect.amount) })
  }

  const canPurchase = (index: number) => {
    const entry = entryOf(index, 'purchase')
    return !!entry && character.character.value.gold >= entry.effect.price
  }

  const purchase = (index: number) => {
    const entry = entryOf(index, 'purchase')
    if (!entry || !canPurchase(index)) return false
    character.applyChange('gold', -entry.effect.price)
    character.addItem(book.itemName(entry.effect.item))
    resolve(index, { value: -entry.effect.price })
    return true
  }

  /** The merchant takes a purchase back (059) */
  const canRefund = (index: number) => {
    const entry = entryOf(index, 'refund')
    return !!entry && character.hasItem(book.itemName(entry.effect.item))
  }

  const refund = (index: number) => {
    const entry = entryOf(index, 'refund')
    if (!entry || !canRefund(index)) return false
    character.removeItem(book.itemName(entry.effect.item))
    character.applyChange('gold', entry.effect.price)
    resolve(index, { value: entry.effect.price })
    return true
  }

  const pickup = (index: number) => {
    const entry = entryOf(index, 'pickup')
    if (!entry) return
    character.addItem(book.itemName(entry.effect.item))
    resolve(index)
  }

  const canCast = (index: number) => {
    const entry = entryOf(index, 'castSpell')
    return !!entry && [entry.effect.spell, ...(entry.effect.with ?? [])].every(character.hasCode)
  }

  /** Returns the section to go to, or null if a code is not at hand */
  const castSpell = (index: number) => {
    const entry = entryOf(index, 'castSpell')
    if (!entry || !canCast(index)) return null
    resolve(index)
    return book.castTarget(id(), entry.effect) ?? null
  }

  /** The section a riddle's answer opens, or null for a wrong number (the reader may try again) */
  const answerRiddle = (index: number, answer: string) => {
    const entry = entryOf(index, 'riddle')
    const number = answer.trim().replace(/^0+(?=\d)/, '')
    if (!entry || !/^\d{1,3}$/.test(number)) return null
    const target = entry.effect.answers[number] ?? entry.effect.answers[number.padStart(3, '0')]
    if (!target) return null
    resolve(index, { value: Number(target) })
    return target
  }

  // Links

  const statValue = (stat: StatCondition['stat']) => stat === 'purchases'
    ? carried(character.character.value.inventory, name => shopPrices().get(name))
    : character.statValue(stat)

  const conditionMet = (condition: LinkCondition) => {
    if ('visited' in condition) return character.character.value.visitedPages.includes(condition.section ?? condition.link) === condition.visited
    if ('items' in condition) {
      const held = condition.items.some(item => character.hasItem(book.itemName(item)))
      return condition.has === 'any' ? held : !held
    }
    if ('fights' in condition) {
      return condition.fights.every(({ fight, won, foesLeft, takenOver }) => {
        const entry = fightEntries.value[fight]
        if (!entry) return false
        if (won !== undefined && (entry.resolved && entry.outcome?.success === true) !== won) return false
        if (takenOver !== undefined && (entry.outcome?.takenOver === true) !== takenOver) return false
        return foesLeft === undefined || fightState(entry.index).foesLeft === foesLeft
      })
    }
    return compare(statValue(condition.stat), condition)
  }

  // Money and food must be at hand; СИЛА or time is simply spent
  const canAfford = (rule: LinkRule) =>
    (rule.stat !== 'gold' && rule.stat !== 'food') || character.character.value[rule.stat] >= rule.amount

  /** A link's cost, lowered while a code is at hand (the Dolphin) */
  const costOf = (rule: LinkRule): LinkRule => {
    const cheaper = (rule.cheaper ?? []).filter(option => character.hasCode(option.spell)).map(option => option.amount)
    return cheaper.length ? { ...rule, amount: Math.min(rule.amount, ...cheaper) } : rule
  }

  /** The book's deadline that applies here, if its stat ran too low («время истекло») */
  const deadline = computed(() => (book.deadlines ?? []).find(rule =>
    rule.on.includes(id()) && character.statValue(rule.stat) < rule.below) ?? null)

  const linkState = (target: string): LinkState => {
    if (rules.value.plainLinks?.includes(target)) return { status: 'plain' }
    if (book.isPeek(target)) return { status: 'peek' }
    if (character.isDead.value) return { status: 'locked', reason: 'dead' }
    if (deadline.value) return { status: 'locked', reason: 'required' }

    // Dice picked one branch: it opens, the others fade
    for (const entry of entries.value) {
      if (entry.effect.kind !== 'rollBranch' || !entry.resolved) continue
      const branch = entry.effect.branches.findIndex(option => option.link === target)
      if (branch >= 0) return { status: branch === entry.outcome?.target ? 'testSuccess' : 'testDimmed' }
    }

    for (const entry of entries.value) {
      if (!isOutcomeEffect(entry.effect)) continue
      const { successLinks, failureLinks } = entry.effect
      const isSuccess = successLinks.includes(target)
      if (!isSuccess && !failureLinks.includes(target)) continue
      if (!entry.resolved) return { status: 'locked', reason: 'test' }
      if (entry.outcome?.success === isSuccess) return { status: isSuccess ? 'testSuccess' : 'testFailure' }
      return { status: 'testDimmed' }
    }

    const escapes = pendingRequired.value.flatMap(entry =>
      entry.effect.kind === 'roll' || entry.effect.kind === 'combat' ? entry.effect.escapeLinks ?? [] : [])
    if (pendingRequired.value.length > 0 && !escapes.includes(target)) {
      return { status: 'locked', reason: 'required' }
    }

    // A fight lost without dying (round limit, NPC side) opens only its lose links
    for (const entry of entries.value) {
      if (entry.effect.kind !== 'combat' || !entry.resolved || !entry.effect.loseLinks) continue
      const isLoseLink = entry.effect.loseLinks.includes(target)
      if (entry.outcome?.success) {
        if (isLoseLink) return { status: 'testDimmed' }
      } else {
        return isLoseLink ? { status: 'testFailure' } : { status: 'locked', reason: 'required' }
      }
    }

    const unmet = rules.value.conditions?.find(condition => condition.link === target && !conditionMet(condition))
    if (unmet) return { status: 'unavailable', condition: unmet }

    const rule = rules.value.links?.find(rule => rule.link === target)
    const cost = rule && costOf(rule)
    if (cost && !canAfford(cost)) return { status: 'unaffordable', cost }
    return { status: 'open', cost }
  }

  /** Pay the cost of a link before following it. Returns false if the link cannot be followed */
  const followLink = (target: string): boolean => {
    const state = linkState(target)
    if (state.status !== 'open' && state.status !== 'testSuccess' && state.status !== 'testFailure') return false
    if (state.status === 'open' && state.cost?.charge) {
      character.applyChange(state.cost.stat, -state.cost.amount)
    }
    return true
  }

  /** Reflect link states in the rendered section */
  const decorateLinks = (container: HTMLElement) => {
    for (const link of container.querySelectorAll<HTMLAnchorElement>('a')) {
      const target = parseSectionHref(link.getAttribute('href'))
      if (!target) continue
      const state = linkState(target)

      if (state.status === 'plain') {
        link.replaceWith(document.createTextNode(link.textContent ?? ''))
        continue
      }

      link.classList.remove(...EFFECT_LINK_CLASSES)
      link.removeAttribute('title')

      switch (state.status) {
        case 'locked':
          link.classList.add('effect-locked')
          break
        case 'unaffordable':
          link.classList.add('link-unaffordable')
          link.title = `Недостаточно: ${formatCost(state.cost)}`
          break
        case 'unavailable':
          link.classList.add('link-unaffordable')
          link.title = formatCondition(state.condition)
          break
        case 'testSuccess':
          link.classList.add('effect-success')
          break
        case 'testFailure':
          link.classList.add('effect-failure')
          break
        case 'testDimmed':
          link.classList.add('effect-dimmed')
          break
        case 'open':
          if (state.cost) link.title = formatCost(state.cost)
          break
      }
    }
  }

  return {
    rules,
    entries,
    hasPendingRequired,
    fightModifier,
    isFresh,
    applyArrival,
    roll,
    combatRound,
    fightState,
    waiting,
    canHelp,
    help,
    woundDamage,
    testCharisma,
    testAgility,
    parityRoll,
    rollBranch,
    retryRoll,
    strikes,
    strike,
    duel,
    attritionRound,
    restoreLuck,
    applyOptional,
    canPurchase,
    purchase,
    canRefund,
    refund,
    pickup,
    canCast,
    castSpell,
    answerRiddle,
    linkState,
    deadline,
    followLink,
    decorateLinks
  }
}
