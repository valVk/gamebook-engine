# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Gamebook Engine** is an engine for gamebooks in the style of Дмитрий Браславский's series (ЛОВКОСТЬ, СИЛА, dice fights, luck squares, the Листок путешественника), built with Nuxt 4 and Nuxt UI 4. Each book is a **pack** (text + rules registry + manifest) loaded at runtime from `BOOKS_DIR`; one deploy serves a library of books.

- Engine: this repository (no copyrighted text, no server-specific configuration)
- Editions: `editions/<id>/` holds the rules of a known book (book.ts, rules.ts, combats.ts...) with no book text; a `$BOOKS_DIR/<id>/` folder with only the text its importer writes (sections/, public/) plays with them. Rule quotes in editions are fingerprints (`shared/engine/quote.ts`, `#<length>:<fnv1a>`); `npm run book:fingerprint <id>` converts plain quotes, `npm run book:check <id> -- --quotes` prints them from the local text. Never commit book text (quotes, sentences) into editions/
- Packs: `$BOOKS_DIR/<id>/` (default `./books`, gitignored). Packs of published books live in a separate private repository; `examples/books/demo` («Тропа Стеклянной долины») is an original demo and the engine's test fixture
- How to prepare a book: [docs/AUTHORING.md](docs/AUTHORING.md). A pack's own notes live in its README

## Development Commands

### Local Development
```bash
npm run dev          # localhost:3000; / is the shelf (or the only book), /<id> a book
npm install          # Install dependencies
npm run typecheck    # vue-tsc type check (nuxt typecheck); packs are checked too
npm run lint         # ESLint (@nuxt/eslint flat config, eslint.config.mjs)
npm run test         # Vitest: engine tests (test/) + every installed pack's tests/
npm run book:check [id]   # Check packs against their text (links, quotes, fights, reachability); -- --quotes prints quotes
npm run book:fingerprint <id>   # Turn an edition's quotes into fingerprints (needs its text in BOOKS_DIR)
npm run book:new <id>     # Scaffold a pack in the first BOOKS_DIR folder
npm run import:povelitel -- "<file>.fb2" [--write]   # «Повелитель» sections and images from the FB2
npm run import:shelton -- "<file>.fb2" [--write]     # «Тайна капитана Шелтона» sections and images from the FB2
BOOKS_DIR=books:examples/books npm run dev   # several pack folders, separated like PATH
```

Run `typecheck`, `lint` and `test` before finishing any change; all three are expected to pass with zero errors. `BOOKS_DIR=/nonexistent npm run test` runs the engine tests alone (what the public engine's CI sees).

### Build & Deploy
```bash
npm run build        # Build for production (.output/, run with node .output/server/index.mjs)
npm run preview      # Preview production build locally
docker build -t gamebook-engine .                    # Production image (Dockerfile)
docker run --rm --read-only -p 3000:3000 gamebook-engine
docker compose --profile production up -d --build   # Settings in .env (.env.example)
```
- `docker-compose.yml` (profile `production`): settings from `.env` (`.env.example`): `GAMEBOOK_BOOKS` (packs folder, the `books` build context), `GAMEBOOK_BIND` / `GAMEBOOK_PORT` (default 127.0.0.1:3000, behind a reverse proxy). Read-only root, all capabilities dropped, no-new-privileges, 256 MB limit (~70 MB used), rotated logs, no volumes. The built server reads `HOST`/`PORT` (or `NITRO_*`), not `NUXT_HOST`/`NUXT_PORT`. No server-specific config (proxy, addresses) belongs in this repository
- Needs a Node server (the section API); `nuxt generate` alone is not enough. Node `^22.22.3 || ^24.15.0` (Nuxt 4.6 engines)
- Book packs are a volume: the image sets `BOOKS_DIR=/books` and ships the demo there; compose mounts `${GAMEBOOK_BOOKS:-./examples/books}:/books:ro`. A restart picks up added or changed books
- Docker: build stage `node:24-alpine3.24` (`npm ci` + build; fonts are downloaded, so the build needs network), runtime is plain `alpine:3.24` with only Node's binary copied in (no npm/yarn), tini as PID 1, non-root `node` user, root-owned read-only `.output`, `HEALTHCHECK` on `/healthz`. Keep `ALPINE_VERSION` equal for both stages. `npm ci` needs `package-lock.json` in sync: run `npm install` after editing dependencies
- Compression: static files are precompressed at build (`nitro.compressPublicAssets`, `.br` + `.gz`); SSR HTML and API JSON are compressed per request by `server/plugins/compression.ts` (brotli q5 or gzip 6, over 1 KB, always `Vary: Accept-Encoding`; off in dev)
- Caching (`routeRules`): `/_nuxt/**` and `/_fonts/**` immutable for a year, `/books/**` (pack images) a week, `/api/books/**` an hour plus stale-while-revalidate
- Client chunks: the dice roller (with mathjs, ~160 KB brotli) and Vue get their own chunks (`vite.$client...codeSplitting`) so they stay cached across deploys. No source maps in production
- Packs load at runtime (`server/utils/packs.ts`): jiti compiles each `book.ts` (no fs cache: the container is read-only; `nitro.externals.traceInclude` ships jiti's lazily loaded compiler), sections are read from disk, `public/` is served by `server/routes/books/[book]/[...file].get.ts`
- `/<book>/debug` pages exist only in development (`pages:extend` hook in `nuxt.config.ts`): they share the player's save
- `npm audit`: braces and node-forge (Nitro build/dev tooling via globby and listhen) have no fixed release; npm's only fix is downgrading Nuxt to 4.1.3. Neither ships in `.output`
- Unknown URLs show the book-styled `app/error.vue`

## Project Structure
```
app/
  app.vue, app.config.ts, assets/css/main.css   # UApp root, Nuxt UI theme, book design tokens
  components/             # GameContent, SectionViewer, SectionEffects, TravellerSheet, OutcomeCard, TitlePage...
  composables/            # useCharacter (state, saves per book), useSectionEffects (rules engine), useLuckCheck
  utils/                  # character.ts (model, defaults, save validation), outcomes.ts (outcome cards)
  middleware/book.global.ts, plugins/book.ts    # /<book> selects the book; per-request book on the server
  pages/index.vue         # The shelf (redirects when one book is installed)
  pages/[book]/           # index.vue (the book), debug/ (dev only)
shared/engine/            # rules.ts (rule vocabulary), book.ts (manifest, createBook), library.ts (runtime registry: registerBook, findBook, getBook), check.ts (pack checks)
shared/utils/             # Section id/file resolution, metadata parsing, interaction index
server/api/books/         # /api/books, /api/books/<id>/content/<section>, /api/books/<id>/interactions
server/plugins, routes/   # Response compression, /healthz
server/utils/packs.ts     # Loads packs from BOOKS_DIR at runtime (jiti); books.ts reads sections
scripts/                  # packs.ts (discovery), book-check.ts, book-new.mjs
importers/                # fb2.ts (shared FB2 → markdown), run.ts (shared CLI: MD5 check, compare, --write)
  povelitel/, shelton/    # One importer per known FB2 file (npm run import:<id>); each checks its MD5
examples/books/demo/      # The demo pack (engine fixture)
books/<id>/               # Installed packs: book.ts, rules.ts, combats.ts, sections/, public/, tests/
test/engine/              # Engine tests on the demo pack
docs/AUTHORING.md         # How to prepare a pack
```

## Architecture

### Engine and packs
- A pack's `book.ts` exports `{...} satisfies BookDefinition<Stat, Item, Spell, Attribute>` (types only from the engine: packs are compiled at runtime): metadata, `character` (2d6 `table` or per-stat dice `roll` formulas, `labels` renaming the core stats, attributes such as ОБАЯНИЕ/Сила мысли/ЧЕСТЬ, starting kit), `rules` + `combats`, `items` with properties, `spells`, `endings`, `peek`, `misprints`, `shop`. `createBook` (shared/engine/book.ts) derives the lookups the engine uses (`getSectionRules`, `itemName`, `item`, `endingKind`, `isPeek`, `correctMisprints`, `statLabel`, `testedAttribute`)
- Core stats are shared by every book: СИЛА/ЛОВКОСТЬ (with their maxima), gold, food, luck squares. A book may rename them (`character.labels`: МАСТЕРСТВО/ВЫНОСЛИВОСТЬ, with a soft-hyphenated `sheet` form for narrow cells); the engine never prints their names itself, it asks `book.statLabel(id)`. Book-specific stats live in `character.attributes` (record by attribute id); `charismaTest` tests the attribute marked `tested`, duels of minds use `character.mindSkill`
- Item behaviour is data, not code: `agility` (while carried), `weapon` / `replacedByWeapon`, `damage`, `kept`, `enemyAttackPenalty`, `dailyStrength` (charged per `meal`)
- The server loads packs (`getPacks`); the app gets a book's manifest from `/api/books/<id>/manifest` in `app/middleware/book.global.ts` (via `useState`, so it travels in the SSR payload) and registers it. Tests and scripts register `#books` (a Vitest plugin + `test/setup.ts`, always including the demo)
- `getBook()` returns the current book: from the route via `app/plugins/book.ts` (safe for concurrent SSR of different books), else the last one opened (`setBook`, set by `app/middleware/book.global.ts`). Server API code gets the book from the route (`bookFromEvent`) and never uses the global
- Saves: `localStorage['gamebook:<id>']`, one traveller per book; `legacySaveKey` in the manifest moves an old save once. `reloadCharacter()` forgets the loaded book (tests)
- Sections refer to images as `/static/<file>`; the content API rewrites that to `/books/<id>/<file>` (the pack's `public/`)

### Rules engine (shared/engine/rules.ts, app/composables/useSectionEffects.ts)
- **Automatic on arrival** (once per visit, stored in `resolvedEffects`): `change`, `loseAll`, `meal`, `luckPenalty`, `learnSpell`, `forgetSpell`, `gainItem`, `loseItems`
- **Required** (lock the section's links until resolved): `roll` (optional `escapeLinks`), `combat` (1d6 x 2 + skill each round; higher total wounds, tie parries; options `enemyDamage`, `skillModifier`, `targetStrength`, `roundLimit` + `loseLinks`, `escapeLinks`, `mode: 'simultaneous' | 'npc'`, `reward`), `attrition`
- **Outcome tests** (lock only their own success/failure links): `charismaTest`, `agilityTest`, `parityRoll`, `duel`
- **Optional buttons**: `luckRestore`, `optional`, `purchase`, `refund` (shown only while held), `pickup`, `riddle` (type a section number), `castSpell` (codes: `spells` entries may carry `add` — the number added to the section — and an `item` they need; `book.castTarget` computes where a code leads)
- **Links**: `conditions` (stat thresholds incl. `purchases` in the `shop`, items `has: 'any' | 'none'`) dim unmet links with a tooltip; `links` costs (`charge: true` pays, `false` only requires); `plainLinks` render as text; `peek` sections open in a modal
- Every rule quotes its section exactly (`source`); `checkBook` (shared/engine/check.ts) fails on quotes not in the text, broken links, rule links the section lacks, fights not matching stat blocks, endings with links, stale misprints; it lists unreachable sections and mechanical wording without rules (to review)
- СИЛА 0 means death: all links lock and the player is offered a restart. Manual СИЛА +/- exists only on the debug page
- УДАЧА is a strategy chosen by the manifest's `luck` (`createLuck` in shared/engine/luck.ts, `book.luckSystem`): `squares` (six squares, one die) or `score` (a number, two dice not above it, each check costs 1). Everything that touches luck (creation, checks, curses, restoration, `change` of `luck`, the sheet, cards, save validation) goes through the system; never read `character.luck` squares directly in new code
- Luck checks are driven by section markers: `<!-- DICE_ROLL_REQUIRED: luck -->` + `LUCK_SUCCESS_LINK` / `LUCK_FAILURE_LINK` (a comma list offers a choice: `LUCK_FAILURE_LINK: 43, 508`); `<!-- DICE_ROLL_REQUIRED: luck_restoration -->` + `<!-- LUCK_RESTORATION: true -->`. Roll results are kept per section in `pendingRolls` so a reload cannot re-roll
- Combat is detected from enemy stat blocks in the book's own words (`book.enemyWords`, from its stat labels): `> ##### Ловкость N Сила N` (sword) or `> ##### Сила мысли N Сила N` (duel of minds) in «Повелитель», `> ##### Мастерство N Выносливость N` in a book that renames them. Anything may follow the numbers, and the two may sit in two quoted headings

### Technology Stack
- **Framework**: Nuxt 4 with Vue 3.5 Composition API
- **UI Library**: Nuxt UI 4 (Reka UI + Tailwind CSS 4 + Tailwind Variants)
- **Icons**: Lucide via `@iconify-json/lucide` (`i-lucide-*` names)
- **Fonts**: Loaded by `@nuxt/fonts` (auto-registered by Nuxt UI) with Cyrillic subsets
- **Content Rendering**: `marked`. Section files are trusted bundled content, so output is not sanitized; never render user-supplied markdown through `SectionViewer`
- **Dice Rolling**: `@dice-roller/rpg-dice-roller`
- **TypeScript**: Pinned to 6.x. TypeScript 7 (native) lacks the JS API that vue-tsc needs; do not upgrade until vue-tsc supports it

## Code Style Guidelines
- Use TypeScript for all new files
- Follow Vue 3 Composition API pattern with `<script setup>`
- Prefix all game-related composables with `use` (e.g., `useCharacter`, `useGameState`)
- Component files use PascalCase (`CharacterSheet.vue`), matching existing files
- Use `import.meta.client` / `import.meta.server` instead of `process.client` / `process.server`
- All dice rolls must use the @dice-roller/rpg-dice-roller library
- The engine never names a book's sections, items or stats: those belong in the pack's manifest and rules

## Game Content Rules
- Section files are 3-digit padded (001.md), links `[**123**](#n_123)`; keep the text as printed (fix misprints with the manifest's `misprints`, never in the file)
- Game over sections have no navigation links; classify non-deaths in `endings`
- Pack tests pin the reviewed `book:check` list, so new unregistered mechanics are noticed

## Common Issues & Debugging
- Character not loading: check `gamebook:<id>` in localStorage
- A book is missing: `npm run dev` logs `[books]` when BOOKS_DIR has no packs; `/api/books` lists what was found
- Section text styles live under `.book-page .book-content` in main.css
- Component slot names / default classes: read `.nuxt/ui/<component>.ts`

## Security Considerations
- Never log character data to console in production
- Validate all section IDs before file system access
- Sanitize user input in character creation
- localStorage data should be validated on load
- Ensure dice rolls are truly random (not predictable)

## UI/UX Design Guidelines

### Book Design ("Листок путешественника")
The page is the printed 1993 book; everything the **reader writes** (stats, rolls, notes, the ledger of what happened) is graphite pencil in a hand font, the way the original Листок путешественника (`public/static/_1.png`) was filled in.

#### Palette (tokens in `app/assets/css/main.css`)
- `paper` `#efe8d6` page; `ink` `#221c16` print, rules of the form; `graphite` `#4a4a52` pencil (reader's values)
- `cinnabar` palette, shade 600 `#a3311f`: the single accent (section references, primary actions, damage). Nuxt UI `primary` and `error`
- Green only for "this branch was chosen" outcomes. No decorative icon colours

#### Typography
- Body: EB Garamond; headings: Cormorant Garamond; pencil values: Neucha (`pencil` utility); sheet title and section folio: Ruslan Display (`--font-ornament`). All have Cyrillic; never use Crimson Text or Cinzel (no Cyrillic)
- Book text: justified with hyphenation (`<html lang="ru">`), 1.5em indent, ~64ch column
- Enemy names (caps in the book) render as small caps; enemy stat blocks as an inked plate

#### Layout
- From `md` (768px) the Листок sits **beside** the text as a sticky column (`TravellerSheet.vue`); the user prefers side by side, never over or under the text
- Below `md`: a status bar (`StatusBar.vue`) opens the same sheet in a drawer
- Each section opens with its number (folio). Under the text, `SectionEffects.vue` deals outcome cards for what happened, then the pending step: one instruction and one button (one solid primary per view); fights as a ruled encounter table
- No manual stat controls for the player (manual СИЛА +/- only on the debug page)

#### Title page and dialogs
- `/` without a character is the book's title page (`TitlePage.vue`: cover, title, one "Начать путешествие"), then the rules; the side column shows the rules' contents (`PrefaceContents.vue`), navigation only. The second start button sits at the end of the preface ("переверните страницу"), never on screen together with the first
- Dialogs: one sheet of paper edged in ink (`app.config.ts`: modal `fullscreen: false` variant), no internal dividers, ink-tinted backdrop; summaries as a ruled row of the Листок; destructive dialogs focus the safe action first
- `SectionViewer` repairs the digitized preface at render time (headings split from their `=====`, paragraphs indented with non-breaking spaces); the files stay as they are

#### Interaction and motion
- Buttons are handwritten words (`pencil-action` in main.css, set globally in `app.config.ts`, Neucha lettering): at rest only the word with a barely-visible tilt; on hover the pencil underline is drawn left to right while the word lifts 1px, grows to 1.04 and leans its own way. Each action's tilt comes from its label (+ occurrence) in `app/plugins/handwriting.client.ts`, so it is stable between visits. Primary = red lettering + double red line, ordinary (`neutral` outline) = ink + graphite line, secondary (`ghost`) = muted + light line, destructive secondary (`error` ghost, e.g. «Закончить путешествие») = red + one thin red line. Touch screens always show the underline; reduced motion drops tilt/lift. Icon-only buttons stay bare. Actions and their instructions are centered; dialog footers are centered. Keyboard focus draws the underline plus a dashed red-pencil frame, never after a mouse click
- Section references in the text are handwritten too: red pencil numbers (Neucha, slightly larger), each with its own tilt (same plugin), the pencil line drawn on hover. States: locked = graphite with a dotted pencil line, not this way = faded graphite, chosen by a roll = green or red with the line already drawn
- Every gain or loss is a card dealt onto the page (the user's reference: skill cards in Heroes III): luck checks, arrival effects (one card for all of them, titled by the weightiest), wounds from dice, fights won or lost, tests, luck restored, items picked up or gained, items lost, death and every ending (victory / survived / captured / death, `ENDINGS` in the registry). Paper card with shadow and tilt, double ink frame, a medallion breaking the top edge (the thrown die or an emblem), the title in the ornament face coloured by tone (reward green, penalty cinnabar, neutral ink), lines in pencil. Card models are pure functions in `app/utils/outcomes.ts`; `OutcomeCard.vue` renders them (`.outcome-card` in main.css); the luck card is built in DOM by `useLuckCheck.ts` with the same classes. A card plays once (dealt, medallion lands, pencil marks, words) only when resolved in this session (`useSectionEffects().isFresh`, end cards after a reader action); after a reload it is shown as it ended. Purchases, spells cast and changes already at their limit stay pencil notes, no card
- Temporary modifiers (e.g. ЛОВКОСТЬ −3 for one fight) appear on the Листок as a red-pencil tag (`pencil-tag`), never by changing the stored stat
- Fights render as a separate sheet of paper lying on the page: paper a hair lighter than the page, no border, contact + ambient shadows and lifted lower corners (ornament title, large pencil figures); the action area under the text opens with a short centered rule
- Buttons scale to 0.97 on press; hover styles only under `(hover: hover) and (pointer: fine)`; values changed by the last action flash once in cinnabar; `prefers-reduced-motion` respected
- Mobile baseline: `viewport-fit=cover`, safe-area padding on the status bar, no tap highlight, 16px inputs
- Layout that depends on the saved character is decided after mount (`showSheet`), never during SSR (hydration keeps server classes)

### Styling Implementation Rules (Nuxt UI)
Follow the Nuxt UI skill in `.claude/skills/nuxt-ui/` and docs at https://ui.nuxt.com/llms.txt (full: https://ui.nuxt.com/llms-full.txt).
1. **Always keep `<UApp>`** as the root in `app/app.vue` (toasts, tooltips, overlays)
2. **Semantic colors only** - `text-default`, `bg-elevated`, `border-default`, `color="primary"`; never raw palette classes like `text-gray-500` or hex values in templates
3. **Override priority** - `ui` / `class` prop on an instance, then `app.config.ts` globally, then theme defaults. Prefer `app.config.ts` for app-wide looks
4. **Tailwind utilities first** - scoped `<style>` only for repeated component-local classes, using `@reference "../assets/css/main.css";` + `@apply`
5. **No `:deep()` overrides of library internals and no `!important`**
6. **Icons** - `i-lucide-*` via `UIcon` or the `icon` prop
7. **Feedback** - `useToast()` for transient messages, `UAlert` for persistent inline warnings
8. **Color mode** - disabled (`ui.colorMode: false`); the parchment theme is light-only

## Performance Guidelines
- Lazy load sections to avoid loading all 600+ markdown files
- Use Vue's `<ClientOnly>` for localStorage-dependent components
- Minimize watchers in useCharacter composable
- Cache frequently accessed sections
- Optimize character sheet updates to prevent excessive re-renders

## Testing Guidelines
- Engine tests live in `test/engine/` and run on the demo pack (`setBook('demo')`); they must never need a copyrighted book
- A pack's own tests live in `<pack>/tests/` and select their book (`setBook('<id>')`); they check the registry against the text and play the book's mechanics
- Mock dice rolls for predictable testing (`vi.mock('@dice-roller/rpg-dice-roller')`, see test/engine/effects.test.ts)
- Arriving again at the same section is a reload (effects are not re-applied): leave and come back to replay arrival effects
- Tests run in plain Vitest (node, or `// @vitest-environment happy-dom` for DOM/localStorage). Composables used in tests import their dependencies explicitly (`vue`, `~/utils/...`) instead of relying on Nuxt auto-imports
- `@nuxt/test-utils` was dropped: its `environment: 'nuxt'` failed to resolve its own app entry with Nuxt 4.6

## Copyright and Legal Compliance
- **Book packs** (`books/<id>/`: sections, covers, RULES.md) are the authors' and publishers' copyright. Keep them private; never commit them to the public engine repository
- **The engine** (everything else) is © valVK under PolyForm Noncommercial 1.0.0 (LICENSE): no commercial use
- **The demo pack** (`examples/books/demo`) is original and free to copy
- Disclaimer, fair-use statement and takedown policy: COPYRIGHT.md