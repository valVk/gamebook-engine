import { findBook, setBookResolver } from '#shared/engine/library'

/**
 * The book of a page comes from its route (/<book>/...). Reading it through the current Nuxt app
 * keeps concurrent server renders of different books apart.
 */
export default defineNuxtPlugin(() => {
  setBookResolver(() => {
    const id = tryUseNuxtApp()?.$router.currentRoute.value.params.book
    return typeof id === 'string' ? findBook(id) : undefined
  })
})
