<template>
  <!-- The book's imprint: whose work this is and what this edition is not (COPYRIGHT.md) -->
  <div v-if="full && book.imprint" class="imprint">
    <p v-for="(line, i) in book.imprint.full" :key="i">{{ line }}</p>
    <p>Сделано на движке <a :href="engineUrl" target="_blank" rel="noopener">Gamebook Engine</a>.</p>
  </div>

  <div v-else-if="full" class="imprint">
    <p>
      Некоммерческий любительский проект. «{{ book.title }}» © {{ book.author }}, {{ book.year }}.
      Текст, правила и иллюстрации принадлежат автору и издателям.
    </p>
    <p>
      Это приложение не продается, не содержит рекламы и не заменяет книгу: оно только бросает за
      читателя кубики и ведет Листок путешественника. Если приключение вам понравилось, купите книгу
      и поддержите автора.
    </p>
    <p>
      Правообладателям: по первому запросу материалы будут удалены.
      <template v-if="feedbackUrl">
        Написать можно через <a :href="feedbackUrl" target="_blank" rel="noopener">форму обратной связи</a>.
      </template>
    </p>
    <p>Сделано на движке <a :href="engineUrl" target="_blank" rel="noopener">Gamebook Engine</a>.</p>
  </div>

  <footer v-else-if="book.imprint" class="colophon">
    {{ book.imprint.short }}
    <a v-if="feedbackUrl" :href="feedbackUrl" target="_blank" rel="noopener">Обратная связь</a>
    <span class="engine">Сделано на движке <a :href="engineUrl" target="_blank" rel="noopener">Gamebook Engine</a>.</span>
  </footer>

  <footer v-else class="colophon">
    Некоммерческий любительский проект по книге-игре «{{ book.title }}» ({{ book.author }}).
    Права на книгу принадлежат автору и издателям. Не для продажи.
    <a v-if="feedbackUrl" :href="feedbackUrl" target="_blank" rel="noopener">Обратная связь</a>
    <span class="engine">Сделано на движке <a :href="engineUrl" target="_blank" rel="noopener">Gamebook Engine</a>.</span>
  </footer>
</template>

<script setup lang="ts">
import { getBook } from '#shared/engine/library'

defineProps<{
  /** The full imprint for the title page; otherwise a one-line note at the foot of every page */
  full?: boolean
}>()

const book = getBook()

// A Google Form or similar, set at runtime with NUXT_PUBLIC_FEEDBACK_URL; no link while it is empty
const { feedbackUrl, engineUrl } = useRuntimeConfig().public
</script>

<style scoped>
@reference "../assets/css/main.css";

.imprint {
  @apply text-[0.9375rem] leading-relaxed text-muted max-w-[38rem];
  text-wrap: pretty;
}

.imprint p + p {
  @apply mt-2;
}

.colophon {
  @apply text-[0.8125rem] leading-snug text-muted text-center text-balance;
}

a {
  @apply underline decoration-1 underline-offset-2 decoration-current/40;
  transition: text-decoration-color 150ms ease;
}

@media (hover: hover) and (pointer: fine) {
  a:hover {
    text-decoration-color: currentColor;
  }
}

a:focus-visible {
  @apply outline-2 outline-offset-2 outline-primary rounded-xs;
}
</style>
