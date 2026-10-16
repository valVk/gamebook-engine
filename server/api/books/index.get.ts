/** The installed books, for the shelf */
export default defineEventHandler(async () =>
  [...(await getPacks()).values()].map(({ definition: { id, title, author, year, cover } }) => ({ id, title, author, year, cover })))
