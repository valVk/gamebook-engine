import { fileURLToPath } from 'node:url'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-10-14',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Книги-игры',
      // lang drives Russian hyphenation of the justified book text
      htmlAttrs: { lang: 'ru' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#efe8d6' }
      ],
      // The cover's red sun over a dune (public/favicon.svg); PNG and ICO sizes are rendered from it
      link: [
        // sizes 32x32 on the ICO lets browsers that understand SVG prefer the sharp SVG
        { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' }
      ]
    }
  },
  runtimeConfig: {
    public: {
      // Feedback / takedown form (e.g. a Google Form), linked from the imprint and the footer.
      // Set at runtime: NUXT_PUBLIC_FEEDBACK_URL=https://forms.gle/... (no link while empty)
      feedbackUrl: '',
      // The engine's home, credited in every imprint and footer ("built with"); a fork points to itself
      engineUrl: 'https://github.com/valVk/gamebook-engine'
    }
  },
  // Source maps are not shipped to production
  sourcemap: { server: false, client: false },
  nitro: {
    // Book packs (sections, covers) are added by modules/books.ts from BOOKS_DIR
    // Static files get .gz and .br siblings at build time; the node server picks them by Accept-Encoding.
    // Dynamic responses are compressed by server/plugins/compression.ts
    compressPublicAssets: { gzip: true, brotli: true },
    externals: {
      // Book packs are TypeScript compiled at runtime by jiti (server/utils/packs.ts); its compiler
      // is loaded lazily, so the tracer does not see it
      traceInclude: [fileURLToPath(new URL('./node_modules/jiti/dist/babel.cjs', import.meta.url))]
    },
    minify: true
  },
  vite: {
    $client: {
      build: {
        rolldownOptions: {
          output: {
            // Libraries change far less often than the app: separate chunks stay cached across deploys.
            // The dice roller carries mathjs (~0.9 MB raw), so it gets a chunk of its own
            codeSplitting: {
              groups: [
                { name: 'dice', test: /node_modules[\\/](@dice-roller|mathjs|decimal\.js|fraction\.js|complex\.js|typed-function|javascript-natural-sort|escape-latex|seedrandom|random-js)[\\/]/ },
                { name: 'vue', test: /node_modules[\\/](@vue|vue|vue-router|pinia|@pinia)[\\/]/ }
              ]
            }
          }
        }
      }
    }
  },
  hooks: {
    // The debug pages share the player's save and can overwrite it: development only
    'pages:extend'(pages) {
      if (process.env.NODE_ENV === 'production') {
        for (let i = pages.length - 1; i >= 0; i--) {
          if (pages[i]!.path.includes('/debug')) pages.splice(i, 1)
        }
      }
    }
  },
  routeRules: {
    // The book's text is not meant to be indexed or scraped (COPYRIGHT.md)
    '/**': { headers: { 'x-robots-tag': 'noindex, nofollow, noarchive' } },
    // The game lives at /; keep old bookmarks working
    '/game': { redirect: '/' },
    // Hashed build output and fonts never change under the same name
    '/_nuxt/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    '/_fonts/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    // Covers and illustrations of the book packs
    '/books/**': { headers: { 'cache-control': 'public, max-age=604800' } },
    // Sections change only with a deploy
    '/api/books/**': { headers: { 'cache-control': 'public, max-age=3600, stale-while-revalidate=86400' } },
    '/healthz': { headers: { 'cache-control': 'no-store' } }
  },
  ui: {
    // The parchment book theme is light-only
    colorMode: false,
    theme: {
      colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error']
    }
  },
  fonts: {
    defaults: {
      weights: [400, 500, 600, 700],
      styles: ['normal', 'italic'],
      subsets: ['cyrillic-ext', 'cyrillic', 'latin-ext', 'latin']
    }
  }
})
