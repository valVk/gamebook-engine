<template>
  <!-- Section files are bundled with the app (trusted content), so marked output is not sanitized -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div ref="root" class="book-content" v-html="html" />
</template>

<script setup lang="ts">
import { marked } from 'marked'

const props = defineProps<{
  markdown: string
}>()

const emit = defineEmits<{
  // Fired after the HTML is in the DOM, so callers can enhance it (luck checks etc.)
  rendered: [el: HTMLElement]
}>()

const root = useTemplateRef<HTMLElement>('root')

// Repairs for the digitized text; the section files themselves stay untouched:
// - headings separated from their "=====" underline by a blank line print as rows of "="
// - paragraphs that start on a new line with a non-breaking-space indent (no blank line) would merge into one
const repairMarkdown = (markdown: string) => markdown
  .replace(/^([^\n=].*)\n[ \t]*\n(={3,})[ \t]*$/gm, '$1\n$2')
  .replace(/\n[ \u00A0]{2,}(?=\S)/g, '\n\n')

const html = computed(() => marked.parse(repairMarkdown(props.markdown), { async: false }))

const notifyRendered = () => {
  if (root.value) emit('rendered', root.value)
}

onMounted(notifyRendered)
watch(html, notifyRendered, { flush: 'post' })
</script>
