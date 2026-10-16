# «Тайна капитана Шелтона» edition

Дмитрий Браславский. The rules of the book, for the text `npm run import:shelton` writes from its
known FB2 (MD5 `eaf182fbf0d6a79ffc5e77e9a3f06060`). The text is not here: bring your own copy,
import it into `$BOOKS_DIR/shelton/` and the engine plays it with these rules.

Status: **rules complete, playtest pending**. Every section is reachable and `book:check` reports no
errors. Known approximations:
- An ally who helps the reader is never struck (the book doesn't say whom the enemy strikes), so at
  334 both ways stay open after the fight
- At 330 the Гриф fights the Кондор and the Филин strikes beside it (the book has them fight at once)
- 248's stay of 30 or 45 minutes (by the rounds the fight took) is charged as 30
- Island neighbours are a reading of the map; 187 (Джон at 162) is the least certain code

- `book.ts` the manifest: МАСТЕРСТВО 1d6+6, ВЫНОСЛИВОСТЬ 2d6+12, УДАЧА a score (1d6+6, two dice, each
  check costs 1; the Заклятие Удачи makes even throws lucky), attacks of two dice, the island clock
- `generated.ts` the codes («прибавьте N к номеру параграфа», «вычтите N из номера»): 37 codes, 65
  places of use, matched by what each target section names; riddles 233 and 532; the islands
  (travel 20/30 minutes by the map, the Dolphin 10, 220 when time runs out). Island neighbours are a
  reading of the map; 187 (Джон at 162) is the least certain code
- `rules.ts` money, wounds, food, finds, item conditions, dice branches and retries, by hand
- `combats.ts` the fights of 94 sections, by hand: battles whose wounds carry between sections (the pirates, the warriors, the Кондор, the sharks, the treasure-hall guards), allies fighting their own pair, flights costing 2, wound-downs and round limits
- Quotes are fingerprints (`shared/engine/quote.ts`): `npm run book:check shelton -- --quotes` prints them from your copy
