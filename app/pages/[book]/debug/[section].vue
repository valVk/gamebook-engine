<template>
  <UContainer class="py-4 min-h-screen">
    <!-- Debug Header -->
    <UCard class="mb-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="font-display text-xl font-bold">
          🐛 Debug Section: {{ currentSection }}
          <UBadge color="primary" size="sm" :label="interactionType || 'Unknown'" class="ml-2" />
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton icon="i-lucide-refresh-cw" label="Reset Character" size="sm" @click="resetCharacter" />
          <UButton icon="i-lucide-arrow-left" label="Back to Debug" size="sm" :to="`/${getBook().id}/debug`" />
          <UButton
            :icon="debugMode ? 'i-lucide-eye-off' : 'i-lucide-eye'"
            :label="debugMode ? 'Hide Debug' : 'Show Debug'"
            :color="debugMode ? 'success' : 'warning'"
            size="sm"
            @click="toggleDebugMode"
          />
        </div>
      </div>
    </UCard>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Main Content -->
      <UCard class="book-page" :class="debugMode ? 'lg:col-span-2' : 'lg:col-span-3'">
        <div v-if="pending" class="text-center p-8">
          <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
          <p class="mt-4">Loading section {{ currentSection }}...</p>
        </div>

        <div v-else-if="error" class="text-center p-8 text-error">
          <UIcon name="i-lucide-circle-alert" class="size-12 mb-4" />
          <h3>Error Loading Section</h3>
          <p>{{ error.message || 'Failed to load section content' }}</p>
          <UButton label="Retry" class="mt-4" @click="refresh()" />
        </div>

        <div v-else-if="content">
          <!-- Game Indicators -->
          <div v-if="content.hasLuckCheck || content.hasCharisma || content.isGameOver" class="flex flex-wrap gap-2 mb-3">
            <UBadge v-if="content.hasLuckCheck" color="success" size="sm" icon="i-lucide-clover" label="ПРОВЕРЬТЕ СВОЮ УДАЧУ" />
            <UBadge v-if="content.hasCharisma" color="secondary" size="sm" icon="i-lucide-smile" label="ОБАЯНИЕ Test" />
            <UBadge v-if="content.hasCombat" color="error" size="sm" icon="i-lucide-sword" label="Combat" />
            <UBadge v-if="content.isGameOver" color="warning" size="sm" icon="i-lucide-flag" label="Game Over" />
          </div>

          <!-- Section text; the key remounts it so a reset clears roll results -->
          <SectionViewer
            :key="viewerKey"
            :markdown="content.content"
            @rendered="onRendered"
            @click="handleClick"
          />
        </div>
      </UCard>

      <!-- Debug Panel (client only: shows character state from localStorage) -->
      <ClientOnly>
        <UCard v-if="debugMode" class="lg:sticky lg:top-5 lg:max-h-[calc(100vh-2.5rem)] overflow-y-auto self-start">
          <template #header>
            <h2 class="text-xl m-0">🔍 Debug Info</h2>
          </template>

          <!-- Character Stats -->
          <div class="mb-4">
            <h4 class="mb-2">Character Stats</h4>
            <div class="flex flex-wrap gap-1">
              <UBadge color="neutral" variant="soft" size="sm" :label="`AGI: ${character.character.value.agility}`" />
              <UBadge color="neutral" variant="soft" size="sm" :label="`STR: ${character.character.value.strength}`" />
            <UFieldGroup size="xs">
              <UButton icon="i-lucide-minus" color="neutral" variant="outline" aria-label="STR -1" @click="character.applyChange('strength', -1)" />
              <UButton icon="i-lucide-plus" color="neutral" variant="outline" aria-label="STR +1" @click="character.applyChange('strength', 1)" />
            </UFieldGroup>
              <UBadge
                v-for="(value, attribute) in character.character.value.attributes"
                :key="attribute"
                color="neutral"
                variant="soft"
                size="sm"
                :label="`${attribute}: ${value}`"
              />
              <UBadge color="neutral" variant="soft" size="sm" :label="`Gold: ${character.character.value.gold}`" />
              <UBadge color="neutral" variant="soft" size="sm" :label="`Food: ${character.character.value.food}`" />
            </div>
          </div>

          <!-- Luck Points -->
          <div class="mb-4">
            <h4 class="mb-2">Luck Points</h4>
            <div class="flex flex-wrap gap-1">
              <UBadge
                v-for="(available, index) in character.character.value.luck"
                :key="index"
                :color="available ? 'success' : 'error'"
                size="sm"
                :label="String(index + 1)"
              />
            </div>
          </div>

          <!-- Section Info -->
          <div class="mb-4">
            <h4 class="mb-2">Section Analysis</h4>
            <p><strong>Type:</strong> {{ interactionType || 'None detected' }}</p>
            <p><strong>Has Combat:</strong> {{ content?.hasCombat ? 'Yes' : 'No' }}</p>
            <p><strong>Has Luck Check:</strong> {{ content?.hasLuckCheck ? 'Yes' : 'No' }}</p>
            <p><strong>Has Charisma:</strong> {{ content?.hasCharisma ? 'Yes' : 'No' }}</p>
            <p><strong>Game Over:</strong> {{ content?.isGameOver ? 'Yes' : 'No' }}</p>
          </div>

          <!-- Quick Actions -->
          <div class="mb-4 flex flex-col gap-2">
            <h4 class="mb-0">Quick Actions</h4>
            <UButton icon="i-lucide-dice-6" label="Test Luck Roll" size="sm" block @click="rollLuck" />
            <UButton icon="i-lucide-smile" label="Test Charisma" size="sm" block @click="rollCharisma" />
            <UButton icon="i-lucide-sword" label="Simulate Combat" size="sm" block @click="simulateCombat" />
          </div>

          <!-- Navigation History -->
          <div v-if="navigationHistory.length">
            <h4 class="mb-2">Recent Sections</h4>
            <div class="flex flex-wrap gap-1">
              <UButton
                v-for="section in navigationHistory.slice(-5)"
                :key="section"
                :to="`/debug/${section}`"
                :label="section"
                color="neutral"
                variant="soft"
                size="xs"
              />
            </div>
          </div>
        </UCard>
      </ClientOnly>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import { DiceRoll } from '@dice-roller/rpg-dice-roller'
import { getBook } from '#shared/engine/library'
import type { DiceRollMetadata } from '#shared/utils/sectionContent'
import type { LuckCheckResult } from '~/composables/useCharacter'

interface SectionResponse {
  content: string
  isGameOver: boolean
  hasLinks: boolean
  diceRoll: DiceRollMetadata
}

const route = useRoute()
const currentSection = computed(() => route.params.section as string)

const debugMode = ref(true)
const navigationHistory = ref<string[]>([])
const toast = useToast()
const contentEl = shallowRef<HTMLElement | null>(null)
const viewerKey = ref(0)

const character = useCharacter()
const luckCheck = useLuckCheck(currentSection)

const showToast = (text: string, color: 'success' | 'warning' | 'error' | 'info' = 'info') => {
  toast.add({ title: text, color, duration: 4000 })
}

// Debug pages always start from a fresh random character
onMounted(() => {
  character.resetToDebugState()
  showToast('Character initialized for debug mode', 'success')
  applySectionState()
})

const { data: content, pending, error, refresh } = await useFetch(() => `/api/books/${getBook().id}/content/${currentSection.value}`, {
  key: () => `debug-section-${currentSection.value}`,
  transform: (data: SectionResponse) => {
    const text = data.content
    return {
      ...data,
      hasCombat: data.diceRoll.hasCombat,
      hasLuckCheck: data.diceRoll.hasLuckCheck,
      hasCharisma: data.diceRoll.hasCharisma,
      hasFood: /еды|пищи|порци/i.test(text),
      hasDice: /бросьте|кубик|кость/i.test(text),
      hasMentalPower: /Сила мысли|телепат|психич/i.test(text),
      hasEconomic: /золот|монет|купить|продать/i.test(text)
    }
  }
})

const interactionType = computed(() => {
  if (!content.value) return null

  const types = []
  if (content.value.hasLuckCheck) types.push('Luck Check')
  if (content.value.diceRoll.hasLuckRestoration) types.push('Luck Restoration')
  if (content.value.diceRoll.hasLuckPenalty) types.push('Luck Penalty')
  if (content.value.hasCombat) types.push('Combat')
  if (content.value.hasCharisma) types.push('Charisma')
  if (content.value.hasFood) types.push('Food')
  if (content.value.hasDice) types.push('Dice')
  if (content.value.hasMentalPower) types.push('Mental Power')
  if (content.value.hasEconomic) types.push('Economic')

  return types.length > 0 ? types.join(', ') : null
})

const applySectionState = () => {
  if (!contentEl.value || !content.value) return
  luckCheck.apply(contentEl.value, content.value.diceRoll)
}

const handleClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement

  if (target.closest('.luck-roll-btn')) {
    event.preventDefault()
    if (contentEl.value) {
      const result = luckCheck.roll(contentEl.value, content.value?.diceRoll)
      if (result) showLuckToast(result)
    }
    return
  }

  const link = target.closest('a')
  if (!link) return

  const pageId = parseSectionHref(link.getAttribute('href'))
  if (!pageId) return

  event.preventDefault()
  if (link.classList.contains('blocked-link')) {
    showToast('You must roll the dice first!', 'warning')
    return
  }
  navigateTo(`/${getBook().id}/debug/${pageId}`)
}

const onRendered = (el: HTMLElement) => {
  contentEl.value = el
  applySectionState()
}

const showLuckToast = (result: LuckCheckResult) => {
  const rolled = result.penalty ? 'Penalty (no roll)' : `Rolled: ${result.roll}`
  showToast(`${rolled} - ${result.lucky ? 'LUCKY' : 'UNLUCKY'} (Available: ${character.getAvailableLuckPoints()})`, result.lucky ? 'success' : 'error')
}

const resetCharacter = () => {
  character.resetToDebugState()
  showToast('Character reset for debug testing', 'success')
  viewerKey.value++
}

const toggleDebugMode = () => {
  debugMode.value = !debugMode.value
}

const rollLuck = () => {
  if (contentEl.value && luckCheck.isLuckSection(content.value?.diceRoll)) {
    const result = luckCheck.roll(contentEl.value, content.value?.diceRoll)
    if (result) showLuckToast(result)
    return
  }
  showLuckToast(character.checkLuck())
}

const rollCharisma = () => {
  const roll = new DiceRoll('2d6')
  const currentCharisma = character.getAttribute(getBook().testedAttribute ?? '')
  showToast(`Charisma Test: ${roll.output} vs ${currentCharisma} - ${roll.total <= currentCharisma ? 'SUCCESS' : 'FAILURE'}`)
}

const simulateCombat = () => {
  const enemy = content.value?.diceRoll.enemies[0]
  const enemySkill = enemy?.skill ?? new DiceRoll('1d12').total
  const mindSkill = getBook().character.mindSkill
  const playerSkill = enemy?.type === 'mind' && mindSkill ? character.getAttribute(mindSkill) : character.character.value.agility
  const playerAttack = new DiceRoll('1d6').total * 2 + playerSkill
  const enemyAttack = new DiceRoll('1d6').total * 2 + enemySkill
  const outcome = playerAttack > enemyAttack ? 'Player hits (-2 enemy СИЛА)' : playerAttack < enemyAttack ? 'Enemy hits (-2 СИЛА)' : 'Blocked'
  showToast(`Combat round vs ${enemy?.name ?? 'random enemy'}: ${playerAttack} vs ${enemyAttack} - ${outcome}`)
}

watch(currentSection, (newSection) => {
  if (newSection && !navigationHistory.value.includes(newSection)) {
    navigationHistory.value.push(newSection)
  }
}, { immediate: true })


useHead({
  title: () => `Debug Section ${currentSection.value} - RPG Game Book`,
  meta: [
    { name: 'description', content: () => `Debug view for game section ${currentSection.value}` }
  ]
})
</script>
