<script setup lang="ts">
import type { BookDefinition } from '#shared/engine/book'
import { saveKey } from '~/composables/useCharacter'

type ShelfBook = Pick<BookDefinition, 'id' | 'title' | 'author' | 'year' | 'cover'>

// The books are loaded at runtime by the server (BOOKS_DIR)
const { data } = await useFetch<ShelfBook[]>('/api/books', { default: () => [] })
const books = data.value

// With a single book installed the shelf is skipped
if (books.length === 1) {
  await navigateTo(`/${books[0]!.id}`, { redirectCode: 302 })
}

useHead({ title: 'Книги-игры' })

const { engineUrl } = useRuntimeConfig().public

// Books with a traveller on the road; read after mount, saves live in the browser
const started = ref(new Set<string>())
onMounted(() => {
  try {
    started.value = new Set(books.filter(book => localStorage.getItem(saveKey(book.id)) !== null).map(book => book.id))
  } catch {
    // Storage unavailable (private mode): every book opens from its title page
  }
})
</script>

<template>
  <div class="mx-auto max-w-[68rem] px-5 sm:px-8 pt-10 sm:pt-16 pb-16">
    <header class="shelf-header">
      <h1 class="shelf-title">Книги-игры</h1>
      <p class="shelf-lede">Выберите книгу. Кубик, Листок путешественника и все расчеты возьмет на себя приложение.</p>
    </header>

    <p v-if="!books.length" class="pencil text-xl text-center mt-12">
      Книги не установлены. Укажите папку с книгами в BOOKS_DIR.
    </p>

    <ul class="shelf">
      <li v-for="book in books" :key="book.id" class="shelf-book">
        <NuxtLink :to="`/${book.id}`" class="cover-link" :aria-label="`${book.title}, ${book.author}`">
          <img
            v-if="book.cover"
            :src="`/books/${book.id}/${book.cover.file}`"
            :width="book.cover.width"
            :height="book.cover.height"
            :alt="`Обложка: ${book.author}, «${book.title}»`"
            class="cover"
            loading="lazy"
          >
          <span v-else class="cover cover--blank" aria-hidden="true">{{ book.title }}</span>
        </NuxtLink>
        <p class="author">{{ book.author }}, {{ book.year }}</p>
        <h2 class="title">{{ book.title }}</h2>
        <UButton
          class="mt-2"
          size="md"
          :to="`/${book.id}`"
          :label="started.has(book.id) ? 'Продолжить путешествие' : 'Открыть книгу'"
        />
      </li>
    </ul>

    <footer class="colophon mt-16 pt-5 border-t border-default">
      Некоммерческий любительский проект. Права на книги принадлежат их авторам и издателям. Не для продажи.
      Сделано на движке <a :href="engineUrl" target="_blank" rel="noopener">Gamebook Engine</a>.
    </footer>
  </div>
</template>

<style scoped>
@reference "../assets/css/main.css";

.shelf-header {
  @apply text-center mb-12;
}

.shelf-title {
  font-family: var(--font-ornament);
  font-size: clamp(2.1rem, 1.4rem + 2.6vw, 3.1rem);
  font-weight: 400;
  line-height: 1.08;
}

.shelf-lede {
  @apply mt-3 text-[1.1875rem] leading-relaxed text-toned mx-auto max-w-[34rem];
  text-wrap: pretty;
}

.shelf {
  @apply grid gap-x-10 gap-y-14 justify-center;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 15rem));
}

.shelf-book {
  @apply flex flex-col items-center text-center;
}

.cover-link {
  @apply block rounded-[2px];
}

.cover-link:focus-visible {
  @apply outline-2 outline-offset-4 outline-primary;
}

/* A printed paperback on the desk, each at its own slight angle */
.cover {
  @apply block w-44 rounded-[2px];
  aspect-ratio: 300 / 372;
  object-fit: cover;
  box-shadow:
    inset 6px 0 8px -6px rgb(0 0 0 / 0.35),
    0 1px 1px rgb(34 28 22 / 0.2),
    0 18px 30px -14px rgb(34 28 22 / 0.55);
  rotate: -1.5deg;
  transition: rotate 200ms var(--ease-out), translate 200ms var(--ease-out);
}

.shelf-book:nth-child(even) .cover {
  rotate: 1.2deg;
}

.cover--blank {
  @apply grid place-items-center p-4 text-center font-display text-lg bg-elevated;
}

@media (hover: hover) and (pointer: fine) {
  .cover-link:hover .cover {
    rotate: 0deg;
    translate: 0 -4px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cover {
    transition: none;
  }
}

.author {
  @apply mt-6 font-display text-base font-semibold text-muted;
}

.title {
  @apply font-display text-[1.375rem] leading-tight font-medium mt-0.5 text-balance;
}

.colophon {
  @apply text-[0.8125rem] leading-snug text-muted text-center text-balance;
}

.colophon a {
  @apply underline decoration-1 underline-offset-2 decoration-current/40;
}

@media (hover: hover) and (pointer: fine) {
  .colophon a:hover {
    text-decoration-color: currentColor;
  }
}
</style>
