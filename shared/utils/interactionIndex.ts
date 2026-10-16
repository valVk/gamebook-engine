import type { Book } from '../engine/book'
import type { SectionRules } from '../engine/rules'
import { hasSectionLinks, parseDiceRollMetadata } from './sectionContent'

export interface InteractionCategory {
  id: string
  name: string
  description: string
  sections: string[]
}

const touchesStat = (rules: SectionRules | undefined, stat: string) =>
  (rules?.effects ?? []).some(effect =>
    ((effect.kind === 'change' || effect.kind === 'optional') && effect.stat === stat)
    || (effect.kind === 'loseAll' && effect.stat === stat)
    || (stat === 'strength' && (effect.kind === 'roll' || effect.kind === 'meal'))
    || (stat === 'food' && effect.kind === 'meal')
    || (stat === 'gold' && effect.kind === 'purchase')
    || (stat === 'mentalPower' && effect.kind === 'combat' && !!effect.reward))
  || (rules?.links ?? []).some(link => link.stat === stat)

const hasKind = (rules: SectionRules | undefined, kind: string) => (rules?.effects ?? []).some(effect => effect.kind === kind)

/**
 * Group every section by the mechanics it contains, from the section text (markers, enemy
 * stat blocks, links) and the rules registry. Used by the debug pages.
 */
export function buildInteractionIndex(book: Book, sections: Record<string, string>): InteractionCategory[] {
  const ids = Object.keys(sections).filter(id => id !== 'preface').sort()
  const meta = Object.fromEntries(ids.map(id => [id, parseDiceRollMetadata(sections[id]!, book.enemyWords)]))
  const linked = new Set(
    Object.values(sections).flatMap(text => [...text.matchAll(/\(#n_(\d+)\)/g)].map(m => m[1]!.padStart(3, '0')))
  )
  const rules = (id: string) => book.sectionRules[id]
  const select = (predicate: (id: string) => boolean) => ids.filter(predicate)

  return [
    { id: 'luck', name: 'Проверка УДАЧИ', description: 'Ссылки заблокированы до броска на удачу', sections: select(id => meta[id]!.required === 'luck') },
    { id: 'luck-restore', name: 'Восстановление УДАЧИ', description: 'Можно бросить кубик и почистить квадрат УДАЧИ', sections: select(id => hasKind(rules(id), 'luckRestore')) },
    { id: 'luck-penalty', name: 'Штраф УДАЧИ', description: 'Следующая проверка УДАЧИ проваливается без броска', sections: select(id => hasKind(rules(id), 'luckPenalty')) },
    { id: 'charisma', name: 'Проверка ОБАЯНИЯ', description: '2d6 против ОБАЯНИЯ, ссылки по результату', sections: select(id => hasKind(rules(id), 'charismaTest')) },
    { id: 'combat-sword', name: 'Бой на мечах', description: `Блок противника «${book.enemyWords.sword} N ${book.enemyWords.strength} N»`, sections: select(id => meta[id]!.enemies.some(enemy => enemy.type === 'sword')) },
    { id: 'combat-mind', name: 'Телепатический поединок', description: `Блок противника «${book.enemyWords.mind ?? '—'} N ${book.enemyWords.strength} N»`, sections: select(id => meta[id]!.enemies.some(enemy => enemy.type === 'mind')) },
    { id: 'strength', name: `Изменение ${book.statLabel('strength').of}`, description: `Потери и восстановление ${book.statLabel('strength').of}, броски на урон, еда или голод`, sections: select(id => touchesStat(rules(id), 'strength')) },
    { id: 'agility', name: `Изменение ${book.statLabel('agility').of}`, description: `Постоянные потери ${book.statLabel('agility').of}`, sections: select(id => touchesStat(rules(id), 'agility')) },
    { id: 'mental', name: 'Сила мысли', description: 'Победы в поединках и другие прибавки Силы мысли', sections: select(id => touchesStat(rules(id), 'mentalPower')) },
    { id: 'food', name: 'ЕДА', description: 'Еда: находки, потери, траты', sections: select(id => touchesStat(rules(id), 'food')) },
    { id: 'gold', name: 'Золото и покупки', description: 'Доходы, расходы, ставки и покупки', sections: select(id => touchesStat(rules(id), 'gold')) },
    { id: 'items', name: 'Предметы', description: 'Получение, потеря предметов и ссылки, доступные только с предметом', sections: select(id => ['gainItem', 'loseItems', 'pickup', 'purchase'].some(kind => hasKind(rules(id), kind)) || (rules(id)?.conditions ?? []).some(condition => 'items' in condition)) },
    { id: 'conditions', name: 'Условия по характеристикам', description: 'Ссылки, доступные только при нужной Силе мысли, СИЛЕ или сумме покупок', sections: select(id => (rules(id)?.conditions ?? []).some(condition => 'stat' in condition)) },
    { id: 'spell', name: 'Заклятия', description: 'Изучение и использование заклятий', sections: select(id => hasKind(rules(id), 'learnSpell') || hasKind(rules(id), 'castSpell')) },
    { id: 'peek', name: 'Справочные параграфы', description: 'Открываются поверх текущего («не закрывая этого параграфа»)', sections: select(id => book.isPeek(id)) },
    { id: 'ending', name: 'Концовки', description: 'Параграфы без ссылок (кроме справочных)', sections: select(id => !hasSectionLinks(sections[id]!) && !book.isPeek(id)) },
    { id: 'unreachable', name: 'Недостижимые', description: 'На параграф не ведет ни одна ссылка (в т.ч. цели заклятий)', sections: select(id => id !== '001' && !linked.has(id)) }
  ]
}
