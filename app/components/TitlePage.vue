<template>
  <header class="title-page">
    <!-- The book itself: the original cover, held like an object on the desk -->
    <img
      v-if="book.cover"
      :src="`/books/${book.id}/${book.cover.file}`"
      :alt="`Обложка книги: ${book.author}, «${book.title}», книга-игра`"
      class="cover"
      :width="book.cover.width"
      :height="book.cover.height"
      fetchpriority="high"
    >

    <div class="title-block">
      <p class="author">{{ book.author }}</p>
      <h1 class="title">{{ book.title }}</h1>
      <p class="kind">книга-игра</p>

      <p class="lede">{{ book.lede }}</p>

      <div class="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
        <UButton size="xl" label="Начать путешествие" @click="emit('start')" />
        <a href="#rules" class="read-rules">Сначала прочитать правила</a>
      </div>
    </div>

    <!-- The reverse of a title page: the imprint -->
    <AppColophon full class="imprint-row" />
  </header>
</template>

<script setup lang="ts">
import { getBook } from '#shared/engine/library'

const book = getBook()

const emit = defineEmits<{
  start: []
}>()
</script>

<style scoped>
@reference "../assets/css/main.css";

.title-page {
  @apply grid gap-8 items-center pb-12 mb-10;
  grid-template-columns: minmax(0, 1fr);
  border-bottom: 1.5px solid var(--color-ink);
}

@media (min-width: 640px) {
  .title-page {
    grid-template-columns: 13rem minmax(0, 1fr);
    gap: 2.5rem;
  }
}

/* Spans both columns, under a hairline like a book's imprint */
.imprint-row {
  @apply pt-6;
  grid-column: 1 / -1;
  border-top: 1px solid var(--ui-border);
}

.cover {
  @apply w-44 sm:w-full justify-self-center rounded-[2px];
  aspect-ratio: 300 / 372;
  object-fit: cover;
  /* A printed paperback: a thin spine shadow on the left and a soft drop shadow beneath */
  box-shadow:
    inset 6px 0 8px -6px rgb(0 0 0 / 0.35),
    0 1px 1px rgb(34 28 22 / 0.2),
    0 18px 30px -14px rgb(34 28 22 / 0.55);
  transform: rotate(-1.5deg);
}

.author {
  @apply font-display text-lg font-semibold text-muted;
  letter-spacing: 0.02em;
}

.title {
  font-family: var(--font-ornament);
  font-size: clamp(2.1rem, 1.4rem + 2.6vw, 3.1rem);
  font-weight: 400;
  line-height: 1.08;
  margin-top: 0.35rem;
  text-wrap: balance;
}

.kind {
  @apply pencil text-xl mt-1;
}

.lede {
  @apply mt-6 text-[1.1875rem] leading-relaxed max-w-[34rem];
  text-wrap: pretty;
}

.read-rules {
  @apply font-semibold underline decoration-1 underline-offset-4 decoration-current/35;
  transition: text-decoration-color 150ms ease;
}

@media (hover: hover) and (pointer: fine) {
  .read-rules:hover {
    text-decoration-color: currentColor;
  }
}

.read-rules:focus-visible {
  @apply outline-2 outline-offset-2 outline-primary rounded-xs;
}
</style>
