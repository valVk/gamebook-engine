# «Повелитель Безбрежной Пустыни» edition

Дмитрий Браславский, 1993. The rules of the book, for the text `npm run import:povelitel` writes from
its known FB2 (MD5 `6109bc522627ffda9f611b28402dd569`). The text is not here: bring your own
copy, import it into `$BOOKS_DIR/povelitel/` and the engine plays it with these rules.

- `book.ts` the manifest; `rules.ts` every instruction of the text (181 sections); `combats.ts` 43 fights
- Quotes are fingerprints (`shared/engine/quote.ts`): `npm run book:check povelitel -- --quotes` prints them from your copy
- `tests/` the regression suite, run when the text is installed: registry against the text, the book's mechanics, the audit pinned in `check.test.ts`

## Edition
- The text is the **1st edition (1993)**: section 590 does not exist and all links resolve. Do NOT apply the 2nd-edition errata ("add 1 to every section from 590"); it would break this text
- 056 and 370 are unreachable (no links point to them); 328 is reachable only via the Reduction spell (203 + 125)
- 067 <-> 199 is an intentional loop (repeat until lucky or dead)
- Misprint: 083 lists 448 (a death page) where its twin 274 lists 488; fixed in `misprints`. 448 stays a trap from 542/178/608
- 512's prices are false links in the digitized source (`plainLinks`)

## Mechanics worth knowing
- Сила мысли is the `mentalPower` attribute (`mindSkill`): telepathic duels use it and `reward` raises it; abilities by level are reference pages (488/010/519/100/244/350/404)
- ОБАЯНИЕ is the `charisma` attribute, tested by `charismaTest` (345/628/630); 12 always succeeds, 1 always fails
- The merchant (512): seven goods, the belt can be returned (059 → `refund`), purchases total > 8 opens 413 (250)
- Items: armour (278) −2 ЛОВКОСТЬ, enemy attack −1, 3 СИЛЫ a day (charged per meal: the book counts no days); the merchant's sword (376) and the guard's sword (613) wound for 3; 594 takes every purchase and leaves a rusty blade (−2 ЛОВКОСТЬ) until a real sword is found (436, 613); 406 drinks the antidote; the medallion and the belt are reusable
- 285 Gremlins: `attrition`; 423 two robbers attack at once (`simultaneous`); 566 the reader rolls for both guards (`npc`)

## Coverage
Audited on 2026-10-15: every section reachable from 001 scanned for stats, dice, gold, food, items
and spells, each hit checked against the registry. `npm run book:check povelitel` repeats the scan;
`tests/check.test.ts` pins the 22 sections read and confirmed as flavour (131 tiger fang,
421/580 pigeon, 325 eating on the way to the 147 ending, 262/404/350 cost notes whose rolls happen
in the next section, the medallion and belt scenes).

## Rebuilding from the FB2
The engine's `npm run import:povelitel -- "<path>.fb2" [--write]` (importers/povelitel) converts the
known FB2 into this pack's `sections/*.md` with luck markers and extracts the images. Checked
2026-10-15: all 631 sections identical (632.md only gains its final newline); `preface.md` is kept.

## Searching the sections (QMD)
The sections are indexed in QMD (collection `game-book-sections`, keyword + vector search):
```bash
qmd search "ЛОВКОСТЬ" -c game-book-sections
qmd vsearch "кидать кубик до тех пор, пока" -c game-book-sections
qmd query "потеря СИЛЫ за каждый раунд" -c game-book-sections
qmd update && qmd embed -c game-book-sections   # after moving or editing sections
```
Vector search complements, not replaces, `book:check`: it missed the even/odd rule in 159.
