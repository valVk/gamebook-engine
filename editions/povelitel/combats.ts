import type { CombatEffect } from '#shared/engine/rules'

/**
 * Fights described in the text (enemy stat blocks), with the per-section variations the text states:
 * stronger enemy hits (enemyDamage), in-fight ЛОВКОСТЬ penalties (skillModifier), fights won by
 * reducing the enemy to a given СИЛА (targetStrength), round limits, links usable mid-fight,
 * and +1 Сила мысли for duels won in the same section (reward).
 * Enemy stats are checked against the section text by the pack's tests.
 */
// 172 and 378 are both reached from 530, which says each of his wounds costs you 4 СИЛЫ
export const COMBATS: Readonly<Record<string, CombatEffect>> = {
  '016': { kind: 'combat', type: 'mind', enemies: [{ name: 'НЕВИДИМЫЙ СТРАЖ', skill: 7, strength: 12 }], reward: 1, source: '#28:1a1323c5' },
  '028': { kind: 'combat', type: 'sword', enemies: [{ name: 'КАКТУС', skill: 8, strength: 12 }], escapeLinks: ['380', '135'], source: '#26:8b86f167' },
  '038': { kind: 'combat', type: 'sword', enemies: [{ name: 'ТОРГОВЕЦ', skill: 10, strength: 12 }], source: '#27:ae546822' },
  '049': { kind: 'combat', type: 'mind', enemies: [{ name: 'РЫЦАРЬ', skill: 5, strength: 10 }], source: '#28:e4bfaaa9' },
  '068': { kind: 'combat', type: 'sword', enemies: [{ name: 'ЮНОША', skill: 10, strength: 14 }], source: '#27:a8545eb0' },
  '072': { kind: 'combat', type: 'sword', enemies: [{ name: 'ЮНОША', skill: 10, strength: 12 }], enemyDamage: 3, source: '#27:ae546822' },
  '083': { kind: 'combat', type: 'mind', enemies: [{ name: 'НЕИЗВЕСТНАЯ ТВАРЬ', skill: 4, strength: 16 }], reward: 1, source: '#28:bfc426c8' },
  '104': { kind: 'combat', type: 'sword', enemies: [{ name: 'ГОЛЕМ', skill: 12, strength: 10 }], source: '#27:380c0fa6' },
  '128': { kind: 'combat', type: 'sword', enemies: [{ name: 'ПРОВОДНИК', skill: 9, strength: 10 }], source: '#26:bfa2032e' },
  '145': { kind: 'combat', type: 'sword', enemies: [{ name: 'РЫЦАРЬ', skill: 10, strength: 10 }], skillModifier: -3, source: '#27:ac5464fc' },
  '146': { kind: 'combat', type: 'mind', enemies: [{ name: 'ПЕРВЫЙ КОЧЕВНИК', skill: 3, strength: 8 }], source: '#27:1f0a8b6e' },
  '172': { kind: 'combat', type: 'sword', enemies: [{ name: 'ЮНОША', skill: 12, strength: 14 }], targetStrength: 2, enemyDamage: 4, source: '#27:3c0c15f2' },
  '180': { kind: 'combat', type: 'sword', enemies: [{ name: 'ЮНОША', skill: 11, strength: 14 }], enemyDamage: 3, source: '#27:4f3959a7' },
  '186': { kind: 'combat', type: 'sword', enemies: [{ name: 'ЧУДОВИЩЕ', skill: 11, strength: 10 }], enemyDamage: 4, source: '#27:4b39535b' },
  '203': { kind: 'combat', type: 'sword', enemies: [{ name: 'ПОВЕЛИТЕЛЬ', skill: 12, strength: 14 }], enemyDamage: 4, source: '#27:3c0c15f2' },
  '234': { kind: 'combat', type: 'sword', enemies: [{ name: 'ВАРАН', skill: 8, strength: 8 }], source: '#25:c7979074' },
  '269': { kind: 'combat', type: 'mind', enemies: [{ name: 'ЮНОША', skill: 10, strength: 2 }], source: '#28:aa8ed526' },
  '274': { kind: 'combat', type: 'mind', enemies: [{ name: 'НЕИЗВЕСТНАЯ ТВАРЬ', skill: 4, strength: 16 }], reward: 1, source: '#28:bfc426c8' },
  '293': { kind: 'combat', type: 'sword', enemies: [{ name: 'СТРАЖНИК', skill: 11, strength: 12 }], enemyDamage: 3, source: '#27:4d395681' },
  '310': { kind: 'combat', type: 'mind', enemies: [{ name: 'БОЛОТНОЕ ЧУДОВИЩЕ', skill: 4, strength: 14 }], reward: 1, source: '#28:c1c429ee' },
  '328': { kind: 'combat', type: 'sword', enemies: [{ name: 'ПОВЕЛИТЕЛЬ', skill: 6, strength: 14 }], source: '#26:7c5fdcf3' },
  '343': { kind: 'combat', type: 'mind', enemies: [{ name: 'ВАРАН', skill: 2, strength: 8 }], reward: 1, source: '#27:0a36c5df' },
  '372': { kind: 'combat', type: 'sword', enemies: [{ name: 'КРЫЛАТЫЙ ЧЕЛОВЕК', skill: 10, strength: 10 }], enemyDamage: 3, skillModifier: -1, source: '#27:ac5464fc' },
  '378': { kind: 'combat', type: 'sword', enemies: [{ name: 'ЮНОША', skill: 12, strength: 14 }], targetStrength: 2, enemyDamage: 4, source: '#27:3c0c15f2' },
  '380': { kind: 'combat', type: 'sword', enemies: [{ name: 'КАКТУС', skill: 8, strength: 12 }], escapeLinks: ['135'], source: '#26:8b86f167' },
  '385': { kind: 'combat', type: 'mind', enemies: [{ name: 'ПУТНИК', skill: 5, strength: 10 }], source: '#28:e4bfaaa9' },
  '402': { kind: 'combat', type: 'sword', enemies: [{ name: 'ТИГР', skill: 9, strength: 10 }], enemyDamage: 3, source: '#26:bfa2032e' },
  '405': { kind: 'combat', type: 'sword', enemies: [{ name: 'СТРАЖ', skill: 11, strength: 12 }], source: '#27:4d395681' },
  '417': { kind: 'combat', type: 'sword', enemies: [{ name: 'ОХОТНИК', skill: 10, strength: 14 }], enemyDamage: 4, source: '#27:a8545eb0' },
  '423': { kind: 'combat', type: 'sword', enemies: [{ name: 'ПЕРВЫЙ РАЗБОЙНИК', skill: 8, strength: 8 }, { name: 'ВТОРОЙ РАЗБОЙНИК', skill: 9, strength: 10 }], mode: 'simultaneous', source: '#25:c7979074' },
  '429': { kind: 'combat', type: 'mind', enemies: [{ name: 'ЮНОША', skill: 10, strength: 14 }], targetStrength: 2, source: '#29:92d72fe5' },
  '472': { kind: 'combat', type: 'sword', enemies: [{ name: 'НЕИЗВЕСТНАЯ ТВАРЬ', skill: 10, strength: 16 }], enemyDamage: 3, source: '#27:aa5461d6' },
  '480': { kind: 'combat', type: 'sword', enemies: [{ name: 'КРЫЛАТЫЙ ЧЕЛОВЕК', skill: 9, strength: 10 }], enemyDamage: 3, skillModifier: -1, source: '#26:bfa2032e' },
  '515': { kind: 'combat', type: 'mind', enemies: [{ name: 'КРЫЛАТЫЙ ЧЕЛОВЕК', skill: 3, strength: 10 }], source: '#28:31880c1b' },
  '520': { kind: 'combat', type: 'sword', enemies: [{ name: 'ЮНОША', skill: 12, strength: 2 }], enemyDamage: 4, source: '#26:099d901f' },
  '528': { kind: 'combat', type: 'mind', enemies: [{ name: 'РАЗБОЙНИК', skill: 3, strength: 10 }], reward: 1, source: '#28:31880c1b' },
  '533': { kind: 'combat', type: 'mind', enemies: [{ name: 'ОХОТНИК', skill: 2, strength: 14 }], reward: 1, source: '#28:e94ab770' },
  '541': { kind: 'combat', type: 'sword', enemies: [{ name: 'ПЕРВЫЙ КОЧЕВНИК', skill: 8, strength: 8 }], skillModifier: -1, roundLimit: 4, loseLinks: ['155'], source: '#25:c7979074' },
  '555': { kind: 'combat', type: 'mind', enemies: [{ name: 'СТАРИК', skill: 10, strength: 10 }], targetStrength: 2, source: '#29:8ed72999' },
  '566': { kind: 'combat', type: 'sword', enemies: [{ name: '«ВАШ» ОХРАННИК', skill: 8, strength: 8 }, { name: 'ВТОРОЙ ОХРАННИК', skill: 8, strength: 8 }], mode: 'npc', loseLinks: ['304'], source: '#25:c7979074' },
  '595': { kind: 'combat', type: 'sword', enemies: [{ name: 'КРЫЛАТЫЙ ЧЕЛОВЕК', skill: 10, strength: 10 }], skillModifier: -1, roundLimit: 5, loseLinks: ['195'], source: '#27:ac5464fc' },
  '622': { kind: 'combat', type: 'sword', enemies: [{ name: 'ЮНОША', skill: 11, strength: 12 }], enemyDamage: 3, source: '#27:4d395681' },
  '623': { kind: 'combat', type: 'sword', enemies: [{ name: 'НЕИЗВЕСТНАЯ ТВАРЬ', skill: 10, strength: 16 }], enemyDamage: 3, skillModifier: -1, source: '#27:aa5461d6' },
}
