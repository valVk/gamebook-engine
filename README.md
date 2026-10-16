[![Stand With Ukraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/banner2-direct.svg)](https://vshymanskyy.github.io/StandWithUkraine/)

# Gamebook Engine

[О чем проект](#о-чем-проект) · [Инструкция](#инструкция)

A game engine for **Дмитрий Браславский**'s gamebooks («Книга-игра»): give it the text of a book
it knows and it plays that book as a game. Every rule of the book is built in: character creation,
dice fights, УДАЧА, items, money and food, codes («прибавьте N к номеру параграфа»), puzzles,
allies, the clock. The reader only makes the choices.

The engine contains **no book text**. You bring your own copy of the book; the engine's importer
turns it into the text the engine reads, and the engine supplies the rules.

> **Non-commercial project.** If you enjoy an adventure, buy the book. Details: [COPYRIGHT.md](COPYRIGHT.md).

## How it works

```
your copy of the book (FB2) ──importer──▶ books/<id>/sections, public   (the text, stays with you)
                                                    │
editions/<id>/ in this repository (the rules) ──────┴──▶ the game at http://localhost:3000/<id>
```

1. **Get the book file.** Each supported book is matched to one exact file (below). The importer
   checks its MD5 first, because the rules are written against that file's text: another edition or
   another digitization may number or word things differently.
2. **Import it.** `npm run import:<id> -- "<file>.fb2" --write` writes the book's sections and
   illustrations into `books/<id>/`.
3. **Play.** `npm run dev` and open http://localhost:3000. The engine finds `books/<id>/`, pairs it
   with its built-in edition, and checks every rule against your text (`npm run book:check <id>`).

## Supported books

| Book | Id | Importer | Status |
|---|---|---|---|
| «Повелитель Безбрежной Пустыни» | `povelitel` | `npm run import:povelitel` | complete |
| «Тайна капитана Шелтона» | `shelton` | `npm run import:shelton` | complete, playtested to the victory |

The files the importers accept (the FB2 of each book):

| Id | Book | Size | MD5 | SHA-256 |
|---|---|---|---|---|
| `povelitel` | «Повелитель Безбрежной Пустыни» | 503 416 bytes | `6109bc522627ffda9f611b28402dd569` | `f0805ce8240f143e06c129feaad1f478ceacfcd21394a227b746d8db05cd36ef` |
| `shelton` | «Тайна капитана Шелтона» | 2 221 775 bytes | `eaf182fbf0d6a79ffc5e77e9a3f06060` | `0de7846cc2e7c590e38f20baf2346d04826d4d8c82ef8b10f8d723c63105a223` |

Check a file before importing: `md5 -q <file>` (macOS) or `md5sum <file>` (Linux). A different
file is refused; `--force` converts it anyway, for comparison only: its rules may not line up.

What each edition knows:

- **«Повелитель Безбрежной Пустыни»** (1st edition text, 631 sections): ЛОВКОСТЬ, СИЛА and ОБАЯНИЕ
  from the book's table, Сила мысли and duels of minds, six luck squares, the merchant, armour and
  weapons, the Заклятие Уменьшения, 43 fights, every ending
- **«Тайна капитана Шелтона»** (629 sections): МАСТЕРСТВО, ВЫНОСЛИВОСТЬ and УДАЧА rolled by
  formula, УДАЧА as a score (each check costs 1; the Заклятие Удачи makes even throws lucky), 37
  codes for allies and items, two puzzles, the islands with a four-hour clock and the Dolphin, allies
  fighting beside you with wounds carried between sections, fights in 94 sections, every ending

## What the engine does

- **A library**: one site serves every installed book (a shelf at `/`, each book at `/<id>`), one
  saved traveller per book in the browser
- **The book's own rules**: its stats and their names, its character creation (a table or dice
  formulas), its luck system (squares or a score), its combat roll
- **Every instruction of the text** is a rule: stat changes, rolls, tests, fights, items, codes,
  link conditions and costs, each proved against its section
- **Fights** by the series' rules: several enemies at once, allies fighting their own pair, wounds
  carried between sections, round limits, flight
- **Locked choices**: links open only after the section's roll, fight or test; links that need an
  item, a stat or money are dimmed with the reason
- **The look of the printed book**, the reader's notes in pencil, and a card for every gain or loss

## Try it

Requires Node `^22.22.3 || ^24.15.0`.

```bash
npm install
npm run dev          # http://localhost:3000
```

With no books installed it opens the demo, «Тропа Стеклянной долины» (`examples/books/demo`), a
short original adventure that uses every feature of the engine.

## Install a supported book

```bash
npm run import:povelitel -- "<path>.fb2"            # compare with what is installed
npm run import:povelitel -- "<path>.fb2" --write    # write books/povelitel/sections and public
npm run book:check povelitel                        # every rule against your text
```

`--pack <folder>` writes elsewhere. `BOOKS_DIR` tells the engine where the book folders are (default
`./books`); it may list several, like PATH (`BOOKS_DIR=../my-books:books`). A folder named after an
edition and holding only `sections/` and `public/` plays with that edition's rules.

## Your own book

A folder with its own `book.ts` is a book of your own: you write its rules. The guide,
[docs/AUTHORING.md](docs/AUTHORING.md), covers the section format, the manifest, every rule kind and
the checks.

```bash
npm run book:new shpaga        # scaffold books/shpaga/
npm run book:check shpaga      # check the book against its text
```

### Editions and fingerprints

`editions/<id>/` holds a supported book's rules: manifest, rules, fights. Every rule proves itself by
quoting its section; in an edition the quote is a fingerprint (its length and a hash), so the
repository holds no book text while `book:check` still verifies every rule against your copy.

```bash
npm run book:check shelton -- --quotes   # print every rule's quote, read from your text
npm run book:fingerprint shelton         # turn plain quotes into fingerprints before committing
```

## Checks

```bash
npm run typecheck
npm run lint
npm run test         # engine tests, plus the tests of every installed book
```

## Production

```bash
npm run build
BOOKS_DIR=../my-books node .output/server/index.mjs
```

Books are read when the server starts: adding a book or changing its text needs a restart, not a
rebuild (an edition's rules are part of the build). Static files are precompressed (brotli and
gzip); pages and API responses are compressed per request.

### Docker

```bash
docker build -t gamebook-engine .
docker run --rm --read-only -p 3000:3000 -v "$PWD/books:/books:ro" gamebook-engine
docker compose --profile production up -d --build    # settings in .env
```

The image reads books from `/books` (`BOOKS_DIR`); without a volume it shows the demo. Compose reads
`.env` (see `.env.example`): `GAMEBOOK_BOOKS` is the folder mounted at `/books`, `GAMEBOOK_BIND` /
`GAMEBOOK_PORT` where the port is published (127.0.0.1:3000 by default; put a reverse proxy in
front). `NUXT_PUBLIC_FEEDBACK_URL` adds a feedback link to every book's imprint and footer.

## Project layout

```
app/              The application: shelf, book page, sheet, cards, styles
shared/engine/    Rule vocabulary, book manifest, luck systems, quote fingerprints, checks
server/           Book and section API, pack loading (BOOKS_DIR), compression, health check
editions/         The rules of the supported books (no book text)
importers/        One importer per supported book file (FB2 → sections), MD5-checked
scripts/          book:check, book:fingerprint, book:new, pack discovery
examples/books/   The demo book
test/engine/      Engine tests (on the demo)
docs/             AUTHORING.md
```

Developer notes and design decisions: [CLAUDE.md](CLAUDE.md).

## Built with

Nuxt 4, Vue 3, Nuxt UI 4, Tailwind CSS 4, TypeScript, `marked`, `@dice-roller/rpg-dice-roller`,
Vitest.

## License

- **Engine and editions**: © 2024-2026 valVK, [PolyForm Noncommercial License 1.0.0](LICENSE). Use,
  study and modify for any non-commercial purpose; commercial use is not permitted.
- **The demo book** (`examples/books/demo`): original, free to copy and adapt.
- **The books themselves** (their text and illustrations) belong to their authors and publishers and
  are not part of this repository. See [COPYRIGHT.md](COPYRIGHT.md).

## О чем проект

**Gamebook Engine** — игровой движок для книг-игр Дмитрия Браславского. Дайте ему текст книги,
которую он знает, и он превратит ее в игру. Все правила книги уже встроены: создание персонажа, бои
на кубиках, УДАЧА, предметы, деньги и еда, коды («прибавьте N к номеру параграфа»), загадки,
союзники, время. Читателю остается только выбирать путь.

**В движке нет текста книг.** Нужен свой экземпляр книги: импортер движка превращает его в текст,
который читает движок, а правила движок берет из себя. Проект некоммерческий: если приключение
понравилось, купите книгу ([COPYRIGHT.md](COPYRIGHT.md)).

## Инструкция

### Как это устроено

```
ваш файл книги (FB2) ──импортер──▶ books/<id>/sections, public   (текст, остается у вас)
                                              │
editions/<id>/ в этом репозитории (правила) ──┴──▶ игра на http://localhost:3000/<id>
```

1. **Найдите файл книги.** Каждая поддерживаемая книга привязана к одному конкретному файлу (см.
   таблицу ниже). Импортер сначала сверяет его MD5: правила написаны по тексту именно этого файла,
   а в другом издании или другой оцифровке нумерация и формулировки могут отличаться.
2. **Импортируйте.** `npm run import:<id> -- "<файл>.fb2" --write` записывает параграфы и
   иллюстрации книги в `books/<id>/`.
3. **Играйте.** `npm run dev` и откройте http://localhost:3000. Движок находит `books/<id>/`,
   подключает к нему свои правила этой книги и сверяет каждое правило с вашим текстом
   (`npm run book:check <id>`).

### Поддерживаемые книги

| Книга | Id | Импортер | Состояние |
|---|---|---|---|
| «Повелитель Безбрежной Пустыни» | `povelitel` | `npm run import:povelitel` | готова |
| «Тайна капитана Шелтона» | `shelton` | `npm run import:shelton` | готова, пройдена до победы |

Импортеры принимают такие файлы FB2:

| Id | Книга | Размер | MD5 | SHA-256 |
|---|---|---|---|---|
| `povelitel` | «Повелитель Безбрежной Пустыни» | 503 416 байт | `6109bc522627ffda9f611b28402dd569` | `f0805ce8240f143e06c129feaad1f478ceacfcd21394a227b746d8db05cd36ef` |
| `shelton` | «Тайна капитана Шелтона» | 2 221 775 байт | `eaf182fbf0d6a79ffc5e77e9a3f06060` | `0de7846cc2e7c590e38f20baf2346d04826d4d8c82ef8b10f8d723c63105a223` |

Проверить файл перед импортом: `md5 -q <файл>` (macOS) или `md5sum <файл>` (Linux). Другой файл
импортер не примет; с `--force` он сконвертирует его все равно, но только для сравнения: правила
могут не совпасть с текстом.

Что умеет каждая книга:

- **«Повелитель Безбрежной Пустыни»** (текст 1-го издания, 631 параграф): ЛОВКОСТЬ, СИЛА и ОБАЯНИЕ
  по таблице книги, Сила мысли и телепатические поединки, шесть квадратов УДАЧИ, торговец, доспехи
  и оружие, Заклятие Уменьшения, 43 боя, все концовки
- **«Тайна капитана Шелтона»** (629 параграфов): МАСТЕРСТВО, ВЫНОСЛИВОСТЬ и УДАЧА по формулам,
  УДАЧА — число (каждая проверка отнимает 1; Заклятие Удачи делает четный бросок удачным), 37 кодов
  союзников и предметов, две загадки, острова с часами на четыре часа и Дельфином, союзники,
  сражающиеся рядом, раны, переходящие из параграфа в параграф, бои в 94 параграфах, все концовки

### Запуск

Нужен Node `^22.22.3 || ^24.15.0`.

```bash
npm install
npm run dev                      # http://localhost:3000; без книг открывается демо
```

Демо «Тропа Стеклянной долины» (`examples/books/demo`) — короткое оригинальное приключение, в
котором есть все возможности движка.

### Установка поддерживаемой книги

```bash
npm run import:shelton -- "<файл>.fb2"           # сравнить с установленным
npm run import:shelton -- "<файл>.fb2" --write   # записать books/shelton/
npm run book:check shelton                       # сверить все правила с вашим текстом
```

`--pack <папка>` пишет в другую папку. `BOOKS_DIR` указывает движку, где лежат книги (по умолчанию
`./books`); можно перечислить несколько папок, как в PATH (`BOOKS_DIR=../my-books:books`). Папка с
именем книги, в которой только `sections/` и `public/`, играется по встроенным правилам этой книги.

### Своя книга

Папка со своим `book.ts` — ваша собственная книга: правила для нее пишете вы. Как это сделать —
в [docs/AUTHORING.md](docs/AUTHORING.md) (на английском): формат параграфов, манифест, все виды
правил и проверки.

```bash
npm run book:new shpaga          # заготовка books/shpaga/
npm run book:check shpaga        # проверка книги по ее тексту
```

Правило доказывает себя цитатой из своего параграфа. В правилах поддерживаемых книг цитата хранится
как отпечаток (длина и хеш): в репозитории нет текста книги, а `book:check` все равно сверяет каждое
правило с вашим экземпляром. `npm run book:check <id> -- --quotes` покажет цитаты из вашего текста,
`npm run book:fingerprint <id>` превратит цитаты в отпечатки перед коммитом.

### На сервере

```bash
npm run build
BOOKS_DIR=../my-books node .output/server/index.mjs

docker build -t gamebook-engine .
docker run --rm --read-only -p 3000:3000 -v "$PWD/books:/books:ro" gamebook-engine
```

Книги читаются при старте сервера: новая книга или исправленный текст требуют перезапуска, но не
пересборки (правила поддерживаемых книг входят в сборку). Настройки `docker compose` — в `.env`
(см. `.env.example`): `GAMEBOOK_BOOKS` — папка с книгами, `GAMEBOOK_BIND` / `GAMEBOOK_PORT` — адрес и порт
(по умолчанию 127.0.0.1:3000, за обратным прокси), `NUXT_PUBLIC_FEEDBACK_URL` — ссылка для отзывов.

### Лицензия

Движок и правила книг — © 2024-2026 valVK, PolyForm Noncommercial 1.0.0: использовать, изучать и
менять можно, продавать и зарабатывать нельзя ([LICENSE](LICENSE)). Демо-книга — оригинальная,
ее можно свободно копировать. Тексты и иллюстрации книг принадлежат авторам и издателям и в
репозиторий не входят ([COPYRIGHT.md](COPYRIGHT.md)).
