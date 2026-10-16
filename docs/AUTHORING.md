# Preparing a book for Gamebook Engine

Gamebook Engine is an engine for gamebooks in the style of Дмитрий Браславский's series (ЛОВКОСТЬ,
СИЛА, dice fights, luck squares, the Листок путешественника). A book is a **pack**: a folder with
the book's text and a description of its rules. The engine does the rest: dice, the sheet, fights,
locked choices, saves.

The demo pack `examples/books/demo` («Тропа Стеклянной долины») uses every feature on 18 sections;
read it next to this guide.

> **Copyright.** A pack of a published book contains that book's text. Keep such packs in a
> private repository or only on your server; never commit them to the engine repository.

## 1. Start a pack

```bash
npm run book:new shpaga                 # creates books/shpaga/
BOOKS_DIR=../my-books npm run book:new shpaga   # or in another folder
```

`BOOKS_DIR` tells the engine where packs live. It may list several folders, separated like `PATH`:
`BOOKS_DIR=books:examples/books`. Default: `./books`, or the demo when there is no `./books`.

```
shpaga/
  book.ts          the manifest: title, character, items, endings (section 3)
  rules.ts         the rules registry: every instruction of the text (section 4)
  sections/        preface.md, 001.md, 002.md ...
  public/          cover and illustrations, served at /books/shpaga/
  tests/           the pack's tests (book:check runs the same checks)
```

## 2. The sections

One markdown file per section, the number padded to three digits: `001.md` ... `400.md`, plus
`preface.md` for the rules and the introduction. Keep the text as printed.

| In the text | How it is written |
|---|---|
| A choice | `[**123**](#n_123)` (the number as printed, not padded) |
| An enemy | `##### ВОЛК` then `> ##### Ловкость 7 Сила 6` (`Сила мысли 3 Сила 6` for a duel of minds). The words are the book's stat names (`character.labels`): `> ##### Мастерство 10 Выносливость 8`; text after the numbers is allowed, and the numbers may be split over two quoted headings |
| A luck check | `<!-- DICE_ROLL_REQUIRED: luck -->`, `<!-- LUCK_SUCCESS_LINK: 13 -->`, `<!-- LUCK_FAILURE_LINK: 16 -->` at the top; an outcome with a choice of ways lists them: `<!-- LUCK_FAILURE_LINK: 43, 508 -->` |
| Luck restored | `<!-- LUCK_RESTORATION: true -->` and `<!-- DICE_ROLL_REQUIRED: luck_restoration -->` |
| An image | `![](/static/map.png)` with `map.png` in `public/` |
| The rules start | a heading matching the manifest's `rulesHeading` (`ПРАВИЛА ИГРЫ`); the title lines before it are replaced by the title page |

A section without links is an ending (section 3, `endings`) unless it is a reference page
(`peek`).

## 3. The manifest (`book.ts`)

`export default { ... } satisfies BookDefinition<Stat, Item, Spell, Attribute>` checks that every id
you use exists. Packs are loaded at runtime, so they import **only types** from the engine
(`import type`); the server compiles `book.ts` on the fly.

| Field | Meaning |
|---|---|
| `id`, `title`, `author`, `year`, `lede` | The shelf and the title page |
| `cover` | `{ file, width, height }` in `public/` |
| `start` | The first section, usually `'001'` |
| `rulesHeading` | Where the rules begin in `preface.md` |
| `character.table` | 2d6 sum → `{ agility, strength, ...rolled attributes }`. Give either `table` or `roll` |
| `character.roll` | Each stat by its own dice formula instead of a table: `{ agility: '1d6+6', strength: '2d6+12' }` (`NdM`, `NdM+K`, `NdM-K`) |
| `character.labels` | The book's names for the core stats when they differ: `{ agility: { name: 'МАСТЕРСТВО', of: 'МАСТЕРСТВА', short: 'МАСТ.' }, strength: { name: 'ВЫНОСЛИВОСТЬ', of: 'ВЫНОСЛИВОСТИ' } }`. The ids stay `agility`/`strength` in rules; only what the reader sees changes (`of` is the form after a number: "−2 ВЫНОСЛИВОСТИ", `short` the status bar's abbreviation) |
| `character.attributes` | The book's own stats beyond СИЛА/ЛОВКОСТЬ/gold/food: label, bounds, place on the sheet (`circle` or `cell`), `tested: true` for the stat a `charismaTest` checks, a card for outcome cards |
| `character.mindSkill` | The attribute a duel of minds uses and its `reward` raises |
| `character.gold`, `food`, `foodRestores`, `kit` | Starting money and food, СИЛА per portion, the starting-kit sentence |
| `combat` | `{ attack: 'sum' }`: an attack is two dice summed + skill; the default `doubled` is one die ×2 («Повелитель») |
| `luck` | `evenLucky: '<code>'` (score only): while that code is at hand, an even throw is lucky and costs nothing. How УДАЧА works (`shared/engine/luck.ts`). `{ system: 'squares' }` (default): six squares, two crossed out at the start, a check throws one die and is lucky on a free square. `{ system: 'score', start: '1d6+6' }`: УДАЧА is a number, a check throws two dice (`checkDice`) and is lucky when not above it, each check costs 1 (`checkCost`); rules may `change` the stat `luck` (never above the start) |
| `items` | Every item the reader can get, with its properties (below) |
| `spells` | Codes the reader carries: spells, allies, item powers ("прибавьте 101 к номеру параграфа"). Id → name, or `{ name, add, item?, action? }`: `add` is the number added to the section, `item` makes it usable only while that item is carried, `action` is the button («Позвать Филина»). `book:check` verifies every `castSpell` lands on an existing section and that an explicit `target` equals section + `add` |
| `endings` | Sections without links that are not deaths: `'victory'`, `'survived'`, `'captured'` |
| `peek` | Reference pages read "не закрывая этого параграфа": they open in a modal |
| `deadlines` | `[{ stat, below, on, section, title }]`: arriving at one of `on` with the stat below `below` locks the section's links and offers only `section` («время истекло ... отправиться на параграф 220»). A clock is an attribute with `format: 'clock'` (minutes, shown 3:40) and `visibleAfter` (the section where it starts) |
| `misprints` | `{ '083': [{ from: '[**448**](#n_448)', to: '[**488**](#n_488)' }] }`, fixed when served |
| `shop` | The section whose purchases count for `purchases` conditions |
| `victoryLine`, `imprint` | Text of the victory card; your own imprint for a book that is not someone else's copyright |

### Items

| Property | Effect |
|---|---|
| `agility: -2` | ЛОВКОСТЬ while carried; given back when the item leaves |
| `weapon: true` | A real weapon: taking one throws away `replacedByWeapon` items |
| `damage: 3` | A sword wound with it costs the enemy 3 СИЛЫ instead of 2 |
| `replacedByWeapon: true` | A makeshift weapon, dropped when a real one is taken |
| `kept: true` | The reader cannot drop it from the sheet |
| `enemyAttackPenalty: 1` | The enemy's attack is 1 lower in sword fights (armour) |
| `dailyStrength: 3` | СИЛА lost per day carried, charged with each meal |
| `fightSkill: 1` | Added to the skill in sword fights while carried («в бою это оружие добавит вам 1 МАСТЕРСТВО») |
| `strike: 12` | A one-use weapon thrown in a fight: the enemy loses 12 at once and the item is gone (a harpoon) |

## 4. The rules (`rules.ts`)

The golden rule: **every rule quotes its section exactly** in `source`. The check fails when a
quote is not in the text, so the registry can never drift from the book.

```ts
'002': { effects: [{ kind: 'meal', penalty: 2, source: 'иначе потеряйте 2 СИЛЫ' }] }
```

### Applied on arrival

| Kind | Example in the text |
|---|---|
| `change` (`stat`, `amount`) | «потеряйте 2 СИЛЫ», «прибавьте 1 к Силе мысли», «кошель с 15 золотыми» |
| `loseAll` (`gold` / `food`) | «забирает все ваши монеты» |
| `meal` (`penalty`) | «если у вас есть ЕДА, поешьте, иначе потеряйте 4 СИЛЫ» |
| `luckPenalty` | «считайте, что Удача отвернулась от вас» |
| `change` with `aboveStart: true`, `refill` | a gain above the initial value («даже если придется превысить изначальное»); back to the start, `plus` above it («восстановите УДАЧУ до изначального уровня и прибавьте еще 1») |
| `learnSpell`, `forgetSpell`, `gainItem`, `loseItems` | a code learnt or lost (an ally dies), a gift, a robbery or an item used up |

### Required: the section's links stay locked until done

| Kind | Example |
|---|---|
| `roll` (`dice`, `escapeLinks`) | «Киньте кубик и вычтите выпавшее из своей СИЛЫ» |
| `combat` | added to `COMBATS` from the stat block: `enemyDamage`, `skillModifier`, `targetStrength`, `yieldAt` (the reader down to N ends it, lost but alive), `doublesMiss` (a double never wounds), `enemyThrow: { total: 12, stat, amount }` (an enemy throw of 12 costs more), `roundLimit` + `loseLinks`, `escapeLinks`, `mode` (`simultaneous`, `npc`), `reward` |
| `combat` with allies | `champion` (an ally fights instead of the reader, who rolls for it; it falling loses the fight, or with `takeOver` the reader takes its place), `helpers` (allies beside the reader: they wound the enemy when out-hitting it and are never struck), `persist: '<battle>'` (ВЫНОСЛИВОСТЬ carried by name between sections, «минус потери от ран»; a fight whose enemies all fell earlier is already won). Having won their own pair, the reader may help an ally in the same section. Links can depend on the fights: `conditions: [{ link, fights: [{ fight: 0, won: true }, { fight: 1, foesLeft: 2 }] }]` (fights counted in order; `takenOver: true` asks whether the reader stepped in for a fallen ally). `after: 0` makes a fight wait for the section's first one. A section whose blocks only introduce an ally to call sets `fightersListed: true`; a battle continued from an earlier section (`persist`) needs no blocks |
| `attrition` (`enemy`, `killTarget`, `damageDice`) | «Кидайте, пока не отгоните 4 мыши»: `enemy: 'Летучие мыши'` |

### Tests: only their own success and failure links lock

`charismaTest` (the `tested` attribute), `agilityTest` (`strict: true`: less than, not equal), `parityRoll` (even/odd), `retryRoll` (pay and throw until a hit: `hits`, `cost`, `successLinks`; the reader may give up), `rollBranch` (dice pick a link: `branches: [{ upTo: 3, link }, { upTo: 6, link }]`), `duel`
(reader against opponent), each with `successLinks` and `failureLinks`.

### Optional actions (buttons)

`luckRestore`, `optional` (a stat change the reader may accept), `purchase` / `refund`,
`pickup`, `castSpell` (use a code: the section plus the code's `add`, or an explicit `target`;
`with: [...]` adds more codes together, "сложите их между собой").
`riddle` (a puzzle answered with a section number: `answers` maps accepted numbers to the
section they open, `prompt` is the instruction; a wrong number does nothing).

### On links

| Rule | Example |
|---|---|
| `links: [{ link, stat, amount, charge }]` | `charge: true` pays when followed («стоит 2 золотых»); `false` only requires it (a bet) |
| `links: [{ link, stat: 'timeLeft', amount: 30, charge: true, cheaper: [{ spell: 'dolphin', amount: 10 }] }]` | Any stat can be spent on a link (time on the way); only gold and food must be at hand. `cheaper` lowers the cost while a code is at hand |
| `conditions: [{ link, visited: false }]` | «из тех, где вы еще не были»: the link closes once its section was visited; with `section` it asks about another section («если вы уже открывали бутылку»: `{ link: '333', section: '431', visited: true }`) |
| `conditions: [{ link, items, has }]` | «Если у вас есть веревка» (`has: 'any'`), «Если нет» (`has: 'none'`) |
| `conditions: [{ link, stat, op, value }]` | «Если ваша Сила мысли 4 и больше»; `stat: 'purchases'` for money spent in the `shop` |
| `plainLinks` | numbers the digitization wrongly turned into links (prices) |

## 5. Check the pack

```bash
npm run book:check shpaga
```

- **Errors** (the command fails): links to missing sections, quotes not in the text, rules that
  name links the section does not have, fights that do not match their stat block, enemy blocks
  without a fight, endings with links, stale misprints.
- **Unreachable**: sections no link or spell leads to. Often a misprint; sometimes a real
  quirk of the edition.
- **To review**: sections whose text mentions СИЛА, dice, money, items or the book's own stats but
  have no rule. Read each one: register the rule, or confirm it is flavour. Then pin the reviewed
  list in the pack's `tests/check.test.ts`, so a new one is noticed.

`npm run test` runs the engine's tests plus every installed pack's `tests/`. `npm run dev` and
open `/<id>` to play.
