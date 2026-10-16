import { describe, expect, it } from 'vitest'
import { KNOWN_FB2, addLuckMarkers, convertFb2, decodeFb2, imageSize, md5, verifyFb2 } from '../../importers/povelitel/fb2'

// An invented book in the shape of the known FB2 of «Повелитель» (no text of the real book)
const PNG_1X2 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAD0lEQVR4nGP4z8DAwMAAAAQAAf/xmA8AAAAASUVORK5CYII='
const FB2 = `<?xml version="1.0" encoding="windows-1251"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">
<description><title-info><author><first-name>Иван</first-name><last-name>Пробный</last-name></author>
<book-title>Пробная книга</book-title><coverpage><image l:href="#cover.png"/></coverpage></title-info>
<publish-info><year>1995</year></publish-info></description>
<body><myheader><p>Спасибо, что скачали книгу в <a l:href="http://example.org">библиотеке</a></p></myheader>
<title><p>Иван Пробный</p><p>Пробная книга</p></title>
<section><title><p>ПРАВИЛА ИГРЫ</p></title><p>Возьмите кубик &amp; карандаш.</p><subtitle>УДАЧА</subtitle><p>См. <a l:href="#Listok">Листок</a>.</p></section>
<section id="Listok"><title><p>ЛИСТОК</p></title><image l:href="#cover.png"/></section>
<section id="n_1"><title><p>1</p></title><p>Дорога. Налево — <a l:href="#n_2"><strong>2</strong></a>, направо — <a l:href="#n_3"><strong>3</strong></a>.</p></section>
<section id="n_2"><title><p>2</p></title><p>На вас нападает <emphasis>волк</emphasis>.</p><subtitle>ВОЛК</subtitle><cite><subtitle>Ловкость 7 Сила 6</subtitle></cite><p>Если вы победили, то <a l:href="#n_4"><strong>4</strong></a>.</p></section>
<section id="n_3"><title><p>3</p></title><p>ПРОВЕРЬТЕ СВОЮ УДАЧУ. Если Судьба за вас — то <a l:href="#n_4"><strong>4</strong></a>, если нет — <a l:href="#n_2"><strong>2</strong></a>.</p></section>
<section id="n_4"><title><p>4</p></title><p>Можете бросить кубик и почистить один из квадратов УДАЧИ.</p></section>
</body>
<binary id="cover.png" content-type="image/png">${PNG_1X2}</binary>
</FictionBook>`

describe('«Повелитель» FB2 importer', () => {
  const book = convertFb2(FB2)

  it('reads the title, the author, the year and the cover', () => {
    expect(book).toMatchObject({ title: 'Пробная книга', author: 'Иван Пробный', year: 1995, coverId: 'cover.png', warnings: [] })
    expect(imageSize(book.images['cover.png']!.data)).toEqual({ width: 1, height: 2 })
  })

  it('writes each numbered section in the pack\'s markdown, a blank line after every paragraph', () => {
    expect(Object.keys(book.sections)).toEqual(['001', '002', '003', '004'])
    expect(book.sections['001']).toBe('Дорога. Налево — [**2**](#n_2), направо — [**3**](#n_3).\n\n')
    expect(book.sections['002']).toBe([
      'На вас нападает *волк*.', '##### ВОЛК', '> ##### Ловкость 7 Сила 6', 'Если вы победили, то [**4**](#n_4).', ''
    ].join('\n\n'))
  })

  it('puts the rules and the Листок in the preface, without the library\'s banner', () => {
    expect(book.preface).toContain('# ПРАВИЛА ИГРЫ')
    expect(book.preface).toContain('Возьмите кубик & карандаш.')
    expect(book.preface).toContain('[Листок](#Listok)')
    expect(book.preface).toContain('<a id="Listok"></a>')
    expect(book.preface).toContain('![](/static/cover.png)')
    expect(book.preface).not.toContain('Спасибо')
  })

  it('marks luck checks and luck restoration', () => {
    const { sections, unclear } = addLuckMarkers(book.sections)
    expect(unclear).toEqual([])
    expect(sections['003']).toMatch(/^<!-- DICE_ROLL_REQUIRED: luck -->\n<!-- LUCK_SUCCESS_LINK: 4 -->\n<!-- LUCK_FAILURE_LINK: 2 -->\n\n/)
    expect(sections['004']).toMatch(/^<!-- LUCK_RESTORATION: true -->\n<!-- DICE_ROLL_REQUIRED: luck_restoration -->/)
    expect(sections['001']).not.toContain('<!--')
  })

  it('accepts only the known FB2 by its MD5', () => {
    expect(md5(new TextEncoder().encode('abc'))).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(verifyFb2(new TextEncoder().encode(FB2))).toMatchObject({ ok: false })
    expect(KNOWN_FB2.md5).toMatch(/^[0-9a-f]{32}$/)
  })

  it('reads UTF-8 even when the header declares windows-1251, and real windows-1251 too', () => {
    const utf8 = new TextEncoder().encode('<?xml version="1.0" encoding="windows-1251"?><p>Сила</p>')
    expect(decodeFb2(utf8)).toContain('Сила')
    const cp1251 = new Uint8Array([...new TextEncoder().encode('<?xml version="1.0" encoding="windows-1251"?><p>'), 0xD1, 0xE8, 0xEB, 0xE0, ...new TextEncoder().encode('</p>')])
    expect(decodeFb2(cp1251)).toContain('Сила')
  })
})
