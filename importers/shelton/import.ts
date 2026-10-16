/**
 * Build the sections of the «Тайна капитана Шелтона» pack from its known FB2.
 * The engine contains no book: you need your own copy of the FB2.
 *
 *   npm run import:shelton -- "<path>.fb2"                       compare with the installed pack
 *   npm run import:shelton -- "<path>.fb2" --pack ../my-books/shelton --write
 *
 * The file's MD5 is checked first; `--force` converts another file anyway (importers/run.ts).
 */
import { runImport } from '../run'
import { KNOWN_FB2, convertShelton } from './fb2'

runImport({
  id: 'shelton',
  file: 'the known FB2 of «Тайна капитана Шелтона»',
  known: KNOWN_FB2,
  convert: convertShelton
})
