import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vitest/config'
import { booksDirs, definitionFile, demoDir, findPacks, testsDir } from './scripts/packs'

const root = fileURLToPath(new URL('.', import.meta.url))
// The demo book is the engine's own fixture, always installed in tests
const packs = [...findPacks([...booksDirs(root), demoDir(root)], root)]

/** The same registry modules/books.ts generates for Nuxt: every pack in BOOKS_DIR, plus the demo */
const books = (): Plugin => ({
  name: 'books',
  resolveId: id => (id === '#books' ? '\0books' : null),
  load(id) {
    if (id !== '\0books') return null
    return [
      ...packs.map(([id, dir], i) => `import book${i} from ${JSON.stringify(definitionFile(root, id, dir))}`),
      `export default [${packs.map((_, i) => `book${i}`).join(', ')}]`
    ].join('\n')
  }
})

/** Where each installed pack's text is, for tests that read it: `import packDirs from '#pack-dirs'` */
const packDirs = (): Plugin => ({
  name: 'pack-dirs',
  resolveId: id => (id === '#pack-dirs' ? '\0pack-dirs' : null),
  load: id => (id === '\0pack-dirs' ? `export default ${JSON.stringify(Object.fromEntries(packs))}` : null)
})

export default defineConfig({
  plugins: [books(), packDirs()],
  // Packs may live outside the project; DOM-environment tests load them through Vite's file server
  server: { fs: { allow: [root, ...packs.map(([, dir]) => dir)] } },
  // Composables run as client code, as they do in the browser
  define: {
    'import.meta.client': true,
    'import.meta.server': false
  },
  resolve: {
    // Pack tests outside the project import these by name: resolve them from the engine's
    // node_modules, so a pack's vi.mock targets the same module the engine uses
    dedupe: ['vue', '@dice-roller/rpg-dice-roller'],
    alias: {
      '~': join(root, 'app'),
      '#shared': join(root, 'shared')
    }
  },
  test: {
    // Engine tests, plus each installed pack's own tests (its rules checked against its text)
    setupFiles: ['test/setup.ts'],
    include: ['test/**/*.test.ts', ...packs.map(([id, dir]) => `${relative(root, testsDir(root, id, dir))}/**/*.test.ts`)],
    environment: 'node'
  }
})
