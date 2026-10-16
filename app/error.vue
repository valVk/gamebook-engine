<template>
  <UApp>
    <main class="error-page">
      <p class="folio">{{ error.statusCode }}</p>
      <h1 class="font-display text-[1.75rem] leading-tight font-medium text-balance">
        {{ error.statusCode === 404 ? 'Такой страницы в книге нет' : 'Страница не открылась' }}
      </h1>
      <p class="mt-3 text-toned text-pretty">
        {{ error.statusCode === 404
          ? 'Похоже, ссылка ведет мимо книги. Ваше путешествие сохранено.'
          : 'Обновите страницу. Ваше путешествие сохранено.' }}
      </p>
      <UButton class="mt-8" size="xl" label="Вернуться к книге" @click="clearError({ redirect: '/' })" />
    </main>
  </UApp>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{
  error: NuxtError
}>()

useHead({ title: 'Книги-игры' })
</script>

<style scoped>
@reference "./assets/css/main.css";

.error-page {
  @apply mx-auto max-w-xl px-6 text-center;
  padding-block: 18vh 4rem;
}

.folio {
  font-family: var(--font-ornament);
  font-size: 2.75rem;
  line-height: 1;
  margin-bottom: 1.25rem;
}
</style>
