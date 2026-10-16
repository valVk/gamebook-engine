export default defineEventHandler(async (event) => {
  const pack = await packFromEvent(event)
  const { book } = pack
  const slug = getRouterParam(event, 'slug')
  const fileName = resolveSectionFileName(slug)

  if (!fileName) {
    throw createError({
      statusCode: 400,
      message: 'Некорректный номер параграфа'
    })
  }

  const raw = await readSection(pack, fileName)
  if (raw === null) {
    throw createError({
      statusCode: 404,
      message: 'Файл не найден'
    })
  }

  const id = fileName.slice(0, -3)
  // Sections refer to their images as /static/<file>; the files are in the pack's public/ folder
  const content = book.correctMisprints(id, raw).replaceAll('](/static/', `](/books/${book.id}/`)
  const hasLinks = hasSectionLinks(content)

  return {
    content,
    // Reference pages have no links by design: the reader returns to the section they came from
    isGameOver: fileName !== 'preface.md' && !hasLinks && !book.isPeek(id),
    hasLinks,
    diceRoll: parseDiceRollMetadata(content, book.enemyWords)
  }
})
