<template>
  <article :aria-label="isSection ? `Параграф ${Number(page)}` : 'Правила игры'">
    <!-- Each section opens with its number, as in the printed book -->
    <header v-if="isSection" class="mb-6 text-center">
      <span class="folio">{{ Number(page) }}</span>
    </header>
    <TitlePage v-else @start="emit('change-page', getBook().start)" />

    <p v-if="error" class="pencil text-xl text-primary">
      Параграф {{ Number(page) }} не открылся. Обновите страницу или вернитесь назад.
    </p>

    <SectionViewer
      :id="isSection ? undefined : 'rules'"
      :markdown="markdown"
      @rendered="onRendered"
      @click="handleClick"
    />

    <!-- The preface ends with "переверните страницу": the second way in, for those who read the rules -->
    <footer v-if="!isSection && data" class="mt-10 pt-8 text-center border-t-[1.5px] border-ink">
      <UButton size="xl" label="Начать путешествие" @click="emit('change-page', getBook().start)" />
    </footer>

    <SectionEffects
      v-if="isCharacterCreated && !isDead"
      :page="page"
      @navigate="(target: string) => (getBook().isPeek(target) ? openPeek(target) : emit('change-page', target))"
    />

    <!-- The end of the road is dealt as a card too: death, capture, survival or victory -->
    <footer v-if="ended" class="end-mark">
      <OutcomeCard :card="endCard" :fresh="endFresh">
        <UButton class="outcome-action" size="lg" label="Начать новое путешествие" @click="emit('restart')" />
      </OutcomeCard>
    </footer>

    <UModal
      v-model:open="peek.open"
      :title="`Параграф ${Number(peek.id)}`"
      description="Прочитайте и вернитесь к текущему параграфу"
    >
      <template #body>
        <SectionViewer :markdown="peek.content" />
      </template>
    </UModal>
  </article>
</template>

<script setup lang="ts">
import type { DiceRollMetadata } from '#shared/utils/sectionContent'
import { getBook } from '#shared/engine/library'
import { deathCard, endingCard } from '~/utils/outcomes'

interface SectionResponse {
  content: string
  isGameOver: boolean
  hasLinks: boolean
  diceRoll: DiceRollMetadata
}

interface Props {
  page: string
  isCharacterCreated?: boolean
}

export interface OutlineEntry {
  id: string
  text: string
  level: 1 | 2
}

interface Emits {
  (e: 'change-page', page: string): void
  (e: 'luck-rolled' | 'restart'): void
  (e: 'outline', entries: OutlineEntry[]): void
}

const emit = defineEmits<Emits>()
const props = defineProps<Props>()

const character = useCharacter()
const toast = useToast()
const luckCheck = useLuckCheck(() => props.page)
const effects = useSectionEffects(() => props.page)
const contentEl = shallowRef<HTMLElement | null>(null)

const { data, error } = await useFetch<SectionResponse>(() => `/api/books/${getBook().id}/content/${props.page}`, {
  key: () => `section-${getBook().id}-${props.page}`
})

const isSection = computed(() => props.page !== 'preface')

// The preface opens with the book's title lines and cover; the title page shows those instead
const markdown = computed(() => {
  const content = data.value?.content ?? ''
  if (isSection.value) return content
  const heading = getBook().rulesHeading
  const rules = heading ? content.indexOf(heading) : -1
  return rules > 0 ? content.slice(rules) : content
})

/** Book headings are set in caps; the outline shows them in sentence case */
const sentenceCase = (text: string) => {
  const lower = text.trim().replace(/\s+/g, ' ').replace(/[!.:]+$/, '').toLocaleLowerCase('ru')
  return lower.charAt(0).toLocaleUpperCase('ru') + lower.slice(1)
}

const emitOutline = (el: HTMLElement) => {
  if (isSection.value) return
  const entries: OutlineEntry[] = []
  el.querySelectorAll<HTMLElement>('h1, h5').forEach((heading, i) => {
    heading.id ||= `rules-${i}`
    entries.push({ id: heading.id, text: sentenceCase(heading.textContent ?? ''), level: heading.tagName === 'H1' ? 1 : 2 })
  })
  emit('outline', entries)
}
const isDead = computed(() => !!props.isCharacterCreated && character.isDead.value)
const ended = computed(() => isDead.value || (!!data.value?.isGameOver && !!props.isCharacterCreated))
const endCard = computed(() => (isDead.value ? deathCard() : endingCard(getBook().endingKind(props.page))))

// The end card is dealt only when the reader's own action led to it, not when a saved ending is reopened
let lastAction = 0
const noteAction = () => { lastAction = Date.now() }
const endFresh = ref(false)
watch(ended, (now) => {
  endFresh.value = now && Date.now() - lastAction < 5000
})
onMounted(() => {
  document.addEventListener('pointerdown', noteAction, true)
  document.addEventListener('keydown', noteAction, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', noteAction, true)
  document.removeEventListener('keydown', noteAction, true)
})

// Reference sections ("не закрывая этого параграфа") open on top of the current one
const peek = reactive({ open: false, id: '', content: '' })

const openPeek = async (id: string) => {
  Object.assign(peek, { id, content: '', open: true })
  try {
    peek.content = (await $fetch<SectionResponse>(`/api/books/${getBook().id}/content/${id}`)).content
  } catch {
    peek.content = 'Не удалось загрузить параграф.'
  }
}

const applySectionState = () => {
  if (!contentEl.value || !data.value) return
  if (props.isCharacterCreated) {
    luckCheck.apply(contentEl.value, data.value.diceRoll)
  }
  effects.decorateLinks(contentEl.value)
}

const handleClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement

  if (target.closest('.luck-roll-btn')) {
    event.preventDefault()
    if (contentEl.value && luckCheck.roll(contentEl.value, data.value?.diceRoll)) {
      emit('luck-rolled')
    }
    return
  }

  const link = target.closest('a')
  if (!link) return

  const pageId = parseSectionHref(link.getAttribute('href'))
  if (!pageId) return // In-page anchors keep their default behavior

  event.preventDefault()
  if (link.classList.contains('blocked-link') || link.classList.contains('luck-dimmed-link')) return

  // Before a character exists only the preface is readable; its links start the game
  if (!props.isCharacterCreated) {
    emit('change-page', pageId)
    return
  }

  const state = effects.linkState(pageId)
  switch (state.status) {
    case 'peek':
      openPeek(pageId)
      return
    case 'unaffordable':
      toast.add({ title: 'Не хватает средств', description: formatCost(state.cost), color: 'warning', icon: 'i-lucide-coins' })
      return
    case 'unavailable':
      toast.add({ title: 'Этот путь вам пока недоступен', description: formatCondition(state.condition), color: 'warning', icon: 'i-lucide-lock' })
      return
    case 'locked':
    case 'testDimmed':
      toast.add({ title: 'Сначала выполните указания параграфа', color: 'warning', icon: 'i-lucide-scroll-text' })
      return
  }

  if (effects.followLink(pageId)) {
    emit('change-page', pageId)
  }
}

const onRendered = (el: HTMLElement) => {
  contentEl.value = el
  applySectionState()
  emitOutline(el)
}

// Apply the section's automatic effects once per visit; resolved effects are stored, so reloads are safe
watch(() => [props.page, props.isCharacterCreated] as const, () => {
  effects.applyArrival()
}, { immediate: true })

// Link states depend on resolved effects and on resources (affordability, death)
watch(
  () => {
    const c = character.character.value
    return [effects.entries.value, c.gold, c.food, c.strength, JSON.stringify(c.attributes), c.inventory.length, character.isDead.value, props.isCharacterCreated]
  },
  () => nextTick(applySectionState)
)
</script>

<style scoped>
@reference "../assets/css/main.css";

.folio {
  font-family: var(--font-ornament);
  font-size: 2.75rem;
  line-height: 1;
  font-variant-numeric: lining-nums;
}

.end-mark {
  @apply mt-12;
}
</style>
