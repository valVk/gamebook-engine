import { buildInteractionIndex } from '#shared/utils/interactionIndex'
import type { InteractionCategory } from '#shared/utils/interactionIndex'

const cache = new Map<string, InteractionCategory[]>()

export default defineEventHandler(async (event) => {
  const pack = await packFromEvent(event)
  const cached = cache.get(pack.dir)
  if (cached) return cached

  const sections = await readAllSections(pack)
  const corrected = Object.fromEntries(Object.entries(sections).map(([id, text]) => [id, pack.book.correctMisprints(id, text)]))
  const index = buildInteractionIndex(pack.book, corrected)
  if (!import.meta.dev) cache.set(pack.dir, index)
  return index
})
