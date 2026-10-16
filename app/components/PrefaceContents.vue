<template>
  <nav aria-labelledby="contents-title" class="contents">
    <h2 id="contents-title" class="contents-title">Содержание</h2>
    <ol>
      <li v-for="entry in entries" :key="entry.id" :class="entry.level === 1 ? 'group-title' : 'item'">
        <a
          :href="`#${entry.id}`"
          :aria-current="active === entry.id ? 'location' : undefined"
          @click.prevent="go(entry.id)"
        >{{ entry.text }}</a>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import type { OutlineEntry } from '~/components/GameContent.vue'

const props = defineProps<{
  entries: OutlineEntry[]
}>()

const active = ref<string | null>(null)

const go = (id: string) => {
  const target = document.getElementById(id)
  if (!target) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  history.replaceState(null, '', `#${id}`)
  active.value = id
}

// Mark the heading currently at the top of the reading area
let observer: IntersectionObserver | null = null
watch(() => props.entries, (entries) => {
  observer?.disconnect()
  if (!import.meta.client || !entries.length) return
  observer = new IntersectionObserver((records) => {
    const visible = records.filter(record => record.isIntersecting)
    if (visible[0]) active.value = visible[0].target.id
  }, { rootMargin: '0px 0px -75% 0px' })
  for (const entry of entries) {
    const el = document.getElementById(entry.id)
    if (el) observer.observe(el)
  }
}, { immediate: true, flush: 'post' })

onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
@reference "../assets/css/main.css";

.contents-title {
  font-family: var(--font-ornament);
  font-size: 1rem;
  font-weight: 400;
  margin: 0 0 0.5rem;
  padding-bottom: 0.4rem;
  border-bottom: 1.5px solid var(--color-ink);
}

.contents a {
  @apply block py-1 leading-snug text-toned;
  transition: color 150ms ease;
}

.group-title a {
  @apply font-display font-bold text-ink mt-3;
}

.item a {
  @apply pl-3 text-[0.95rem];
  border-left: 1.5px solid var(--ui-border);
}

.contents a[aria-current="location"] {
  @apply text-primary;
}

.item a[aria-current="location"] {
  border-left-color: var(--ui-primary);
}

@media (hover: hover) and (pointer: fine) {
  .contents a:hover {
    @apply text-ink underline decoration-1 underline-offset-3;
  }
}

.contents a:focus-visible {
  @apply outline-2 outline-offset-2 outline-primary rounded-xs;
}
</style>
