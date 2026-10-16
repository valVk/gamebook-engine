/**
 * Build the sections of the «Повелитель Безбрежной Пустыни» pack from its known FB2.
 * The engine contains no book: you need your own copy of the FB2.
 *
 *   npm run import:povelitel -- "<path>.fb2"                     compare with the installed pack
 *   npm run import:povelitel -- "<path>.fb2" --write             write sections/ and public/
 *   npm run import:povelitel -- "<path>.fb2" --pack ../my-books/povelitel --write
 *
 * The file must be the known FB2 (its MD5 is checked first); `--force` converts
 * another file anyway, for a human to compare the result. Writes sections/001.md ... 632.md (with
 * luck markers) and public/<images> (importers/run.ts).
 */
import { runImport } from '../run'
import { KNOWN_FB2, addLuckMarkers, convertFb2, decodeFb2 } from './fb2'

runImport({
  id: 'povelitel',
  file: 'the known FB2 of «Повелитель Безбрежной Пустыни»',
  known: KNOWN_FB2,
  convert: (bytes) => {
    const book = convertFb2(decodeFb2(bytes))
    return { ...book, ...addLuckMarkers(book.sections) }
  }
})
