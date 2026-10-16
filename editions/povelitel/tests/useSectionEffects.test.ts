// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setBook } from '#shared/engine/library'
import { ref } from 'vue'
import { useCharacter } from '~/composables/useCharacter'
import { useSectionEffects } from '~/composables/useSectionEffects'

// The registry holds every installed book; these tests read «Повелитель»
setBook('povelitel')

const dice = vi.hoisted(() => ({ queue: [] as number[] }))

vi.mock('@dice-roller/rpg-dice-roller', () => ({
  DiceRoll: class {
    total: number
    output = ''
    constructor() {
      const value = dice.queue.shift()
      if (value === undefined) throw new Error('No queued roll')
      this.total = value
    }
  }
}))

const queue = (...values: number[]) => dice.queue.push(...values)

/** Start a game (agility 9, strength 20/20, charisma 7, gold 15, food 3) and arrive at `page` */
const setup = (page: string) => {
  const api = useCharacter()
  queue(3, 4, 2, 5)
  api.rollStats()
  api.startJourney()
  const current = ref(page)
  const effects = useSectionEffects(current)
  const go = (next: string) => {
    api.navigateToPage(next)
    current.value = next
    effects.applyArrival()
  }
  go(page)
  return { api, effects, go, character: api.character }
}

describe('useSectionEffects', () => {
  beforeEach(() => {
    dice.queue.length = 0
    useCharacter().endGameSession()
  })

  describe('automatic effects', () => {
    it('section 105: loses 1 ЛОВКОСТЬ once, even if applied again (reload)', () => {
      const { effects, character } = setup('105')
      effects.applyArrival()

      expect(character.value.agility).toBe(8)
      expect(effects.entries.value[0]).toMatchObject({ resolved: true, outcome: { value: -1 } })
    })

    it('section 002: restoring СИЛА is capped at the initial value', () => {
      const { api, go, character } = setup('001')
      api.applyChange('strength', -2)
      go('002')

      expect(character.value.strength).toBe(20)
    })

    it('section 594: robbed of gold and food, rusty sword costs 2 ЛОВКОСТИ', () => {
      const { character } = setup('594')

      expect(character.value).toMatchObject({ gold: 0, food: 0, agility: 7 })
    })

    it('section 414: the song of the bird restores СИЛА to its initial value', () => {
      const { api, go, character } = setup('001')
      api.applyChange('strength', -9)
      go('414')

      expect(character.value.strength).toBe(20)
    })

    it('section 222: receives gold and food', () => {
      const { character } = setup('222')

      expect(character.value).toMatchObject({ gold: 30, food: 9 })
    })

    it('meal (024): eats when there is food, otherwise loses СИЛА', () => {
      const { api, go, character } = setup('024')
      expect(character.value).toMatchObject({ food: 2, strength: 20 })

      api.setFood(0)
      go('001')
      go('024')
      expect(character.value).toMatchObject({ food: 0, strength: 16 })
    })

    it('section 213: the next luck check fails without a roll', () => {
      const { character } = setup('213')

      expect(character.value.nextLuckCheckFails).toBe(true)
    })

    it('re-entering a section applies its effects again (67 -> 199 -> 67 loop)', () => {
      const { effects, go } = setup('067')
      queue(1, 1)
      effects.roll(0)
      go('199')
      go('067')

      expect(effects.entries.value[0]?.resolved).toBe(false)
      expect(effects.linkState('603').status).toBe('locked')
    })
  })

  describe('required actions', () => {
    it('dice damage (029): links stay locked until the roll', () => {
      const { effects, character } = setup('029')
      expect(effects.linkState('532')).toEqual({ status: 'locked', reason: 'required' })

      queue(3, 4)
      expect(effects.roll(0)).toEqual({ dice: [3, 4], total: 7 })
      expect(character.value.strength).toBe(13)
      expect(effects.linkState('532').status).toBe('open')
    })

    it('escape links stay usable while a roll is pending (060 -> 567)', () => {
      const { effects } = setup('060')

      expect(effects.linkState('567').status).toBe('open')
      expect(effects.linkState('576').status).toBe('locked')
    })


    it('charisma test (630): success opens 265, failure opens all failure links', () => {
      const { effects, go } = setup('630')
      expect(effects.linkState('265').status).toBe('locked')

      queue(3, 3) // 6 <= 7: success
      effects.testCharisma(0)
      expect(effects.linkState('265').status).toBe('testSuccess')
      expect(effects.linkState('408').status).toBe('testDimmed')

      go('001')
      go('630')
      queue(6, 6) // 12 > 8: failure
      effects.testCharisma(0)
      for (const link of ['408', '555', '547']) {
        expect(effects.linkState(link).status).toBe('testFailure')
      }
      expect(effects.linkState('265').status).toBe('testDimmed')
    })
  })

  describe('dice mechanics', () => {
    it('Gremlins (285): rounds repeat until 6 are killed, 603 stays locked until then', () => {
      const { effects, character } = setup('285')
      expect(effects.linkState('603').status).toBe('locked')

      queue(2, 3, 3) // 2 killed, 6 СИЛЫ lost
      expect(effects.attritionRound(0)).toEqual({ kills: 2, damage: 6, totalKills: 2 })
      expect(effects.entries.value[0]?.resolved).toBe(false)
      expect(effects.linkState('603').status).toBe('locked')

      queue(4, 1, 2) // 6 killed in total, 3 more СИЛЫ lost
      effects.attritionRound(0)
      expect(effects.entries.value[0]).toMatchObject({ resolved: true, outcome: { value: 6, damage: 9, rounds: 2 } })
      expect(character.value.strength).toBe(11)
      expect(effects.linkState('603').status).toBe('open')
    })

    it('Gremlins (285): running out of СИЛА before 6 kills means death', () => {
      const { api, effects } = setup('285')
      api.setStrength(5)
      queue(1, 3, 3)
      effects.attritionRound(0)

      expect(api.isDead.value).toBe(true)
      expect(effects.attritionRound(0)).toBeNull()
      expect(effects.linkState('603')).toEqual({ status: 'locked', reason: 'dead' })
    })

    it('agility test (125): 2d6 <= ЛОВКОСТЬ opens 550, otherwise 316', () => {
      const { effects, go } = setup('125')
      expect(effects.linkState('550').status).toBe('locked')

      queue(4, 5) // 9 <= 9
      expect(effects.testAgility(0)).toMatchObject({ total: 9, success: true })
      expect(effects.linkState('550').status).toBe('testSuccess')
      expect(effects.linkState('316').status).toBe('testDimmed')

      go('001')
      go('125')
      queue(5, 5) // 10 > 9
      effects.testAgility(0)
      expect(effects.linkState('316').status).toBe('testFailure')
    })

    it('parity roll (159): loses СИЛУ, even sum opens 580, odd 457', () => {
      const { effects, character } = setup('159')
      queue(2, 5) // 7, odd

      effects.parityRoll(0)
      expect(character.value.strength).toBe(13)
      expect(effects.linkState('457').status).toBe('testFailure')
      expect(effects.linkState('580').status).toBe('testDimmed')
    })

    it('duel (217): a tie is rolled again, the higher die wins', () => {
      const { effects } = setup('217')
      queue(3, 3)
      expect(effects.duel(0)).toMatchObject({ tie: true })
      expect(effects.linkState('584').status).toBe('locked')

      queue(5, 2)
      expect(effects.duel(0)).toMatchObject({ tie: false })
      expect(effects.linkState('584').status).toBe('testSuccess')
      expect(effects.linkState('336').status).toBe('testDimmed')
    })
  })

  describe('combat', () => {
    /** Play rounds where the player rolls `player` and every enemy rolls `enemy`, until done */
    const fight = (effects: ReturnType<typeof setup>['effects'], index: number, player: number, enemy: number, enemies = 1, max = 30) => {
      for (let round = 0; round < max; round++) {
        queue(player, ...Array(enemies).fill(enemy))
        const result = effects.combatRound(index)
        if (!result || result.done) return result
      }
      return null
    }

    it('locks the win link until the enemy is dead (038)', () => {
      const { effects, character } = setup('038')
      expect(effects.linkState('137').status).toBe('locked')

      // 6*2+9=21 vs 1*2+10=12: enemy loses 2 each round, 12 СИЛЫ -> 6 rounds
      expect(fight(effects, 0, 6, 1)).toMatchObject({ done: true, won: true })
      expect(effects.entries.value[0]?.outcome).toMatchObject({ rounds: 6, enemies: [0], success: true })
      expect(character.value.strength).toBe(20)
      expect(effects.linkState('137').status).toBe('open')
    })

    it('the youth\'s blade wounds for 4 after 530 (172)', () => {
      const { effects, character } = setup('172')
      queue(1, 6)
      effects.combatRound(0)

      expect(character.value.strength).toBe(16)
    })

    it('a tie parries, the higher total wounds the player (186 hits for 4)', () => {
      const { effects, character } = setup('186') // enemy Ловкость 11
      queue(5, 4) // 10+9=19 vs 8+11=19: tie
      effects.combatRound(0)
      expect(character.value.strength).toBe(20)

      queue(1, 6) // 11 vs 23
      effects.combatRound(0)
      expect(character.value.strength).toBe(16)
    })

    it('in-fight ЛОВКОСТЬ penalty applies only to the attack (145: -3)', () => {
      const { effects, character } = setup('145') // enemy Ловкость 10
      queue(6, 4) // 12+9-3=18 vs 8+10=18: tie
      effects.combatRound(0)
      expect(effects.entries.value[0]?.outcome?.enemies).toEqual([10])
      expect(character.value.agility).toBe(9)
      expect(effects.fightModifier.value).toBe(-3)
    })

    it('dying in a fight ends it and locks everything', () => {
      const { api, effects } = setup('038')
      api.setStrength(2)

      expect(fight(effects, 0, 1, 6)).toMatchObject({ done: true, won: false })
      expect(api.isDead.value).toBe(true)
      expect(effects.linkState('137')).toEqual({ status: 'locked', reason: 'dead' })
    })

    it('telepathic duel uses Сила мысли and rewards +1 when won in the section (016)', () => {
      const { effects, character } = setup('016') // Сила мысли 3 vs 7
      fight(effects, 0, 6, 1) // 15 vs 9

      expect(character.value.attributes.mentalPower).toBe(4)
      expect(effects.linkState('141').status).toBe('open')
    })

    it('stops when the enemy is reduced to 2 (172)', () => {
      const { effects } = setup('172') // enemy Сила 14
      fight(effects, 0, 6, 1)

      expect(effects.entries.value[0]?.outcome).toMatchObject({ enemies: [2], success: true, rounds: 6 })
      expect(effects.linkState('269').status).toBe('open')
    })

    it('round limit (541): not killed in 4 rounds opens only 155', () => {
      const { effects } = setup('541') // enemy Ловкость 8 Сила 8, player 9-1 = 8
      expect(fight(effects, 0, 3, 3)).toMatchObject({ won: false }) // 14 vs 14: four parried rounds

      expect(effects.entries.value[0]?.outcome).toMatchObject({ rounds: 4, enemies: [8], success: false })
      expect(effects.linkState('155').status).toBe('testFailure')
      expect(effects.linkState('397').status).toBe('locked')
    })

    it('round limit (541): killed in time opens 397', () => {
      const { api, effects } = setup('541')
      api.setDebugStats(12, 20, 7)
      fight(effects, 0, 6, 1) // still 2 per wound: 8 СИЛЫ takes 4 rounds

      expect(effects.linkState('397').status).toBe('open')
      expect(effects.linkState('155').status).toBe('testDimmed')
    })

    it('simultaneous fight (423): both attack, only the chosen target is wounded', () => {
      const { effects, character } = setup('423') // 8/8 and 9/10, after the loot effects
      const combat = effects.entries.value.findIndex(entry => entry.effect.kind === 'combat')
      queue(5, 1, 6) // 19 vs 10 and 21: first wounded, second hits
      effects.combatRound(combat, 0)

      expect(effects.entries.value[combat]?.outcome?.enemies).toEqual([6, 10])
      expect(character.value.strength).toBe(18)
    })

    it('NPC fight (566): the player rolls for both guards', () => {
      const { effects, character } = setup('566')
      fight(effects, 0, 1, 6)

      expect(character.value.strength).toBe(20)
      expect(effects.linkState('304').status).toBe('testFailure')
      expect(effects.linkState('465').status).toBe('locked')
    })

    it('escape links stay usable during the fight (028)', () => {
      const { effects } = setup('028')

      expect(effects.linkState('135').status).toBe('open')
      expect(effects.linkState('415').status).toBe('locked')
    })
  })

  describe('link conditions', () => {
    it('Сила мысли threshold picks the branch (042: > 5 -> 138, otherwise 595)', () => {
      const { api, effects } = setup('042') // Сила мысли 3
      expect(effects.linkState('138')).toMatchObject({ status: 'unavailable', condition: { op: '>', value: 5 } })
      expect(effects.linkState('595').status).toBe('open')

      api.applyChange('mentalPower', 3)
      expect(effects.linkState('138').status).toBe('open')
      expect(effects.linkState('595').status).toBe('unavailable')
    })

    it('abilities stay available at higher levels (430: 8 -> 490, 9 -> 262)', () => {
      const { api, effects } = setup('430')
      api.applyChange('mentalPower', 6) // 9

      expect(effects.linkState('490').status).toBe('open')
      expect(effects.linkState('262').status).toBe('open')
      expect(effects.linkState('134').status).toBe('unavailable')
      expect(effects.linkState('141').status).toBe('open')
    })

    it('СИЛА threshold (576)', () => {
      const { api, effects } = setup('576')
      api.setStrength(3)

      expect(effects.linkState('080').status).toBe('open')
      expect(effects.linkState('308').status).toBe('unavailable')
    })

    it('merchant purchases total (250: more than 8 gold -> 413)', () => {
      const { effects, go } = setup('512')
      effects.purchase(4) // belt, 5
      go('250')
      expect(effects.linkState('413').status).toBe('unavailable')

      go('512')
      effects.purchase(5) // flask, 6
      go('250')
      expect(effects.linkState('413').status).toBe('open')
      expect(effects.linkState('540').status).toBe('unavailable')
    })
  })

  describe('items', () => {
    it('the bracelet from 587 opens 405 in section 019 and closes the "no bracelet" branch', () => {
      const { effects, go, character } = setup('019')
      expect(effects.linkState('405')).toMatchObject({ status: 'unavailable', condition: { items: ['bracelet'], has: 'any' } })
      expect(effects.linkState('398').status).toBe('open')

      go('587')
      expect(character.value.inventory).toEqual(['Браслет с изумрудами'])
      go('019')
      expect(effects.linkState('405').status).toBe('open')
      expect(effects.linkState('398').status).toBe('unavailable')
    })

    it('"neither medallion nor belt" (301 -> 468)', () => {
      const { api, effects } = setup('301')
      expect(effects.linkState('468').status).toBe('open')

      api.addItem('Шелковый пояс')
      expect(effects.linkState('341').status).toBe('open')
      expect(effects.linkState('624').status).toBe('unavailable')
      expect(effects.linkState('468').status).toBe('unavailable')
    })

    it('optional pickup: keys from 423 open the locks in 619', () => {
      const { effects, go } = setup('423')
      const keys = effects.entries.value.findIndex(entry => entry.effect.kind === 'pickup' && entry.effect.item === 'keys')
      effects.pickup(keys)

      go('619')
      expect(effects.linkState('204').status).toBe('open')
    })

    it('robbery (594) takes the purchases but not gifts', () => {
      const { effects, go, character } = setup('512')
      effects.purchase(2) // cloak
      go('587') // bracelet
      go('594')

      expect(character.value.inventory).toEqual(['Браслет с изумрудами', 'Ржавый клинок'])
    })

    it('a sword found after 594 replaces the rusty blade and gives ЛОВКОСТЬ back (613)', () => {
      const { effects, go, character } = setup('594')
      expect(character.value.agility).toBe(7)
      go('613')
      effects.pickup(0)

      expect(character.value.inventory).toEqual(['Меч стражника'])
      expect(character.value.agility).toBe(9)
    })

    it('the guard\'s sword wounds for 3 (613)', () => {
      const { effects, go, character } = setup('613')
      effects.pickup(0)
      go('038')
      queue(6, 1)
      effects.combatRound(0)

      expect(effects.entries.value[0]?.outcome?.enemies).toEqual([9])
      expect(character.value.inventory).toContain('Меч стражника')
    })

    it('armour (278): −2 ЛОВКОСТЬ while carried, enemy attack −1, 3 СИЛЫ a day', () => {
      const { effects, go, api, character } = setup('512')
      const armor = effects.entries.value.findIndex(entry => entry.effect.kind === 'purchase' && entry.effect.item === 'armor')
      effects.purchase(armor)
      expect(character.value.agility).toBe(7)

      go('186') // enemy Ловкость 11, СИЛА 10: 6*2+7 = 19 vs 4*2+11 = 19 would parry, armour makes it 18
      queue(6, 4)
      effects.combatRound(0)
      expect(effects.entries.value[0]?.outcome?.enemies).toEqual([8])

      go('024') // meal: eat 1 ЕДА, armour costs 3 СИЛЫ
      expect(character.value).toMatchObject({ food: 2, strength: 17 })

      api.removeItem('Рыцарские доспехи')
      expect(character.value.agility).toBe(9)
    })

    it('the antidote is drunk in 406', () => {
      const { effects, go, character } = setup('512')
      const flask = effects.entries.value.findIndex(entry => entry.effect.kind === 'purchase' && entry.effect.item === 'flask')
      effects.purchase(flask)
      go('406')

      expect(character.value.inventory).toEqual([])
    })

    it('the merchant takes the belt back for its price (059)', () => {
      const { effects, character } = setup('512')
      const belt = effects.entries.value.findIndex(entry => entry.effect.kind === 'purchase' && entry.effect.item === 'belt')
      const back = effects.entries.value.findIndex(entry => entry.effect.kind === 'refund')
      expect(effects.canRefund(back)).toBe(false)
      effects.purchase(belt)
      expect(character.value.gold).toBe(10)

      expect(effects.refund(back)).toBe(true)
      expect(character.value).toMatchObject({ gold: 15, inventory: [] })
    })
  })

  describe('links', () => {
    it('Сила мысли 7 opens 60, less sends to 567 (291)', () => {
      const { effects, api, go } = setup('291')
      expect(effects.linkState('060').status).not.toBe('open')
      expect(effects.linkState('567').status).toBe('open')

      api.applyChange('mentalPower', 4)
      go('291')
      expect(effects.linkState('060').status).toBe('open')
      expect(effects.linkState('567').status).not.toBe('open')
    })

    it('the bracelet finds the guard\'s body (035)', () => {
      const { effects, go } = setup('035')
      expect(effects.linkState('546').status).not.toBe('open')
      expect(effects.linkState('430').status).toBe('open')

      go('587')
      go('035')
      expect(effects.linkState('546').status).toBe('open')
    })

    it('charges link costs when followed (347 -> 523 costs 3 gold)', () => {
      const { effects, character } = setup('347')

      expect(effects.linkState('523')).toMatchObject({ status: 'open', cost: { amount: 3 } })
      expect(effects.followLink('523')).toBe(true)
      expect(character.value.gold).toBe(12)
    })

    it('disables links the player cannot afford', () => {
      const { api, effects } = setup('358')
      api.setGold(1)

      expect(effects.linkState('002').status).toBe('unaffordable')
      expect(effects.followLink('002')).toBe(false)
      expect(effects.linkState('106').status).toBe('open')
    })

    it('bets only require money (330)', () => {
      const { effects, character } = setup('330')

      expect(effects.followLink('217')).toBe(true)
      expect(character.value.gold).toBe(15)
    })

    it('reference pages open as peeks', () => {
      const { effects } = setup('016')

      expect(effects.linkState('488').status).toBe('peek')
    })

    it('death locks every link', () => {
      const { api, effects } = setup('017')
      api.setStrength(0)

      expect(effects.linkState('114')).toEqual({ status: 'locked', reason: 'dead' })
    })
  })

  describe('optional actions', () => {
    it('shop (512): buys an item when there is enough gold', () => {
      const { api, effects, character } = setup('512')

      expect(effects.purchase(2)).toBe(true) // cloak, 3 gold
      expect(character.value.gold).toBe(12)
      expect(character.value.inventory).toEqual(['Накидка от песчаной бури'])

      api.setGold(1)
      expect(effects.canPurchase(0)).toBe(false)
      expect(effects.purchase(0)).toBe(false)
    })

    it('luck restoration (063) clears a rolled square', () => {
      const { effects, character } = setup('063')
      queue(2)

      expect(effects.restoreLuck(0)).toEqual({ roll: 2, wasAlreadyAvailable: false })
      expect(character.value.luck[1]).toBe(true)
    })

    it('Reduction spell: learned in 094, cast in 203 to go to 328', () => {
      const { effects, go } = setup('203')
      expect(effects.canCast(0)).toBe(false)
      expect(effects.castSpell(0)).toBeNull()

      go('094')
      go('203')
      expect(effects.castSpell(0)).toBe('328')
    })
  })

  describe('decorateLinks', () => {
    const render = (html: string) => {
      const container = document.createElement('div')
      container.innerHTML = html
      return container
    }

    it('marks locked links and costs', () => {
      const { effects } = setup('029')
      const locked = render('<a href="#n_532">532</a>')
      effects.decorateLinks(locked)
      expect(locked.querySelector('a')?.className).toBe('effect-locked')
    })

    it('turns the shop price numbers (512) into plain text', () => {
      const { effects } = setup('512')
      const container = render('моток веревки (<a href="#n_2">2</a>); веревка — <a href="#n_259">259</a>')
      effects.decorateLinks(container)

      expect([...container.querySelectorAll('a')].map(a => a.getAttribute('href'))).toEqual(['#n_259'])
      expect(container.textContent).toContain('моток веревки (2)')
    })
  })
})
