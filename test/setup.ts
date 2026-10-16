// Tests run without the Nuxt server: register the packs Vitest resolves as #books (vitest.config.ts)
import installed from '#books'
import type { BookDefinition } from '#shared/engine/book'
import { registerBooks } from '#shared/engine/library'

registerBooks(installed as BookDefinition[])
