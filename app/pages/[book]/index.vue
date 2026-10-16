<script setup lang="ts">
import { getBook } from '#shared/engine/library'
import type { OutlineEntry } from '~/components/GameContent.vue'

const {
  character,
  isCharacterCreated,
  useFood,
  navigateToPage,
  getCurrentPage,
  getVisitedPages,
  getGameDuration,
  endGameSession
} = useCharacter()

const toast = useToast()

useHead({ title: getBook().title })

// The character lives in localStorage, so the layout is decided after mount: deciding it during
// SSR would leave the server's single-column classes in place after hydration
const mounted = ref(false)
onMounted(() => { mounted.value = true })
const showSheet = computed(() => mounted.value && isCharacterCreated.value)

const outline = ref<OutlineEntry[]>([])

const currentPage = ref('preface')
const showCharacterCreation = ref(false)
const showExitDialog = ref(false)

const changePage = (page: string) => {
  // Starting the game requires a character
  if (page === getBook().start && !isCharacterCreated.value) {
    showCharacterCreation.value = true
    return
  }

  currentPage.value = page
  if (isCharacterCreated.value) {
    navigateToPage(page)
  }
  window.scrollTo({ top: 0 })
}

const onCharacterCreated = () => {
  currentPage.value = getBook().start
}

const handleUseFood = () => {
  if (useFood()) {
    toast.add({ title: 'Вы поели', description: `${getBook().statLabel('strength').name}: ${character.value.strength}/${character.value.maxStrength}`, color: 'success', icon: 'i-lucide-apple' })
  }
}

const confirmExitGame = () => {
  endGameSession()
  currentPage.value = 'preface'
  showExitDialog.value = false
}

const gameStats = computed(() => {
  if (!isCharacterCreated.value) return null
  return {
    duration: getGameDuration(),
    pagesVisited: getVisitedPages().length,
    currentPage: getCurrentPage(),
    strength: character.value.strength,
    maxStrength: character.value.maxStrength
  }
})

// Restore the saved section after a reload
onMounted(() => {
  const savedPage = getCurrentPage()
  if (isCharacterCreated.value && isValidPageId(savedPage)) {
    currentPage.value = savedPage
  }
})
</script>

<template>
  <div
    class="mx-auto px-5 sm:px-8 pt-8 sm:pt-12"
    :class="[
      'max-w-[68rem] md:grid md:grid-cols-[minmax(0,1fr)_16.5rem] md:gap-10 lg:grid-cols-[minmax(0,38rem)_19rem] lg:justify-center lg:gap-16',
      showSheet ? 'pb-28 md:pb-16' : 'pb-16'
    ]"
  >
    <main>
      <GameContent
        :page="currentPage"
        :is-character-created="isCharacterCreated"
        @change-page="changePage"
        @restart="confirmExitGame"
        @outline="outline = $event"
      />
    </main>

    <ClientOnly>
      <!-- Before the journey: the rules' contents sit where the Листок will be -->
      <aside v-if="mounted && !isCharacterCreated && currentPage === 'preface'" class="hidden md:block">
        <div class="sticky top-8 max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain pb-4">
          <PrefaceContents :entries="outline" />
        </div>
      </aside>

      <template v-if="showSheet">
        <!-- Tablet and desktop: the sheet sits beside the book, never over it -->
        <aside class="hidden md:block">
          <div class="sticky top-8 max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain pb-4">
            <TravellerSheet
              @use-food="handleUseFood"
              @exit-game="showExitDialog = true"
            />
          </div>
        </aside>

        <!-- Phones: a status bar that opens the sheet in a drawer -->
        <div class="md:hidden">
          <StatusBar
            @use-food="handleUseFood"
            @exit-game="showExitDialog = true"
          />
        </div>
      </template>
    </ClientOnly>

    <AppColophon class="mt-16 pt-5 border-t border-default md:col-span-2" />

    <CharacterCreation
      v-model="showCharacterCreation"
      @character-created="onCharacterCreated"
    />

    <ExitGameDialog
      v-model="showExitDialog"
      :game-stats="gameStats"
      @confirm="confirmExitGame"
    />
  </div>
</template>
