/** A book's manifest and rules (book.ts), for the app to play it */
export default defineEventHandler(async event => (await packFromEvent(event)).definition)
