import type { BookDefinition } from '#shared/engine/book'
import { findBook, registerBook, setBook } from '#shared/engine/library'

/**
 * /<book>/... opens that book; an unknown id is a 404. Books are loaded at runtime on the server
 * (BOOKS_DIR): the manifest is fetched once and travels to the browser in the page payload.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const id = to.params.book
  if (typeof id !== 'string') return

  if (!findBook(id)) {
    const manifest = useState<BookDefinition | null>(`book:${id}`, () => null)
    if (!manifest.value) {
      try {
        manifest.value = await $fetch<BookDefinition>(`/api/books/${id}/manifest`)
      } catch {
        return abortNavigation(createError({ statusCode: 404, statusMessage: 'Такой книги нет' }))
      }
    }
    registerBook(manifest.value)
  }
  setBook(id)
})
