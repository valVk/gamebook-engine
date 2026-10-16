<template>
  <UContainer class="py-4 min-h-screen">
    <UCard>
      <template #header>
        <div class="text-center">
          <h1 class="text-4xl font-bold m-0">🎮 Debug: Game Interactions</h1>
          <p class="mt-2 text-muted">Every section grouped by mechanics, built from the section texts and the rules registry</p>
        </div>
      </template>

      <!-- Summary Stats -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <UCard
          v-for="category in categories"
          :key="category.id"
          class="text-center transition-transform hover:-translate-y-0.5"
        >
          <div class="font-display text-lg font-bold">{{ category.name }}</div>
          <div class="font-display text-3xl mt-2">{{ category.sections.length }}</div>
          <div class="text-xs text-muted">sections</div>
        </UCard>
      </div>

      <!-- Interaction Categories -->
      <UAccordion
        type="multiple"
        :items="accordionItems"
        :ui="{ item: 'mb-3 rounded-lg ring-2 ring-default px-4', label: 'font-display text-lg font-bold' }"
      >
        <template #default="{ item }">
          <span class="font-display text-lg font-bold">{{ item.label }}</span>
          <UBadge color="primary" size="sm" :label="String(item.sections.length)" class="ml-2" />
        </template>

        <template #body="{ item }">
          <p class="mb-4 text-sm">{{ item.description }}</p>

          <!-- Section Grid -->
          <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            <UButton
              v-for="section in item.sections"
              :key="section"
              :to="`/debug/${section}`"
              target="_blank"
              :label="section"
              color="primary"
              variant="outline"
              size="sm"
              block
            />
          </div>

          <!-- Bulk Navigation -->
          <USeparator class="my-4" />
          <div class="flex flex-wrap justify-center gap-2">
            <UButton
              icon="i-lucide-shuffle"
              :label="`Random ${item.name} Section`"
              @click="openRandomSection(item.sections)"
            />
            <UButton
              icon="i-lucide-external-link"
              label="Open First 5"
              @click="openFirstFive(item.sections)"
            />
          </div>
        </template>
      </UAccordion>

      <!-- Quick Actions -->
      <UCard class="mt-6">
        <template #header>
          <h2 class="text-xl m-0">🔧 Quick Actions</h2>
        </template>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UFormField label="Go to Section">
            <UFieldGroup class="w-full">
              <UInput
                v-model="quickSection"
                placeholder="e.g., 037"
                class="flex-1"
                @keyup.enter="goToSection"
              />
              <UButton icon="i-lucide-arrow-right" aria-label="Go to section" @click="goToSection" />
            </UFieldGroup>
          </UFormField>
          <div class="flex flex-wrap items-end gap-2">
            <UButton icon="i-lucide-user" label="Character Sheet" @click="openCharacterSheet" />
            <UButton icon="i-lucide-house" label="Game Home" :to="`/${getBook().id}`" color="neutral" variant="outline" />
          </div>
        </div>
      </UCard>
    </UCard>
  </UContainer>
</template>

<script setup lang="ts">
import { getBook } from '#shared/engine/library'
// Page metadata
useHead({
  title: 'Debug: Game Interactions - RPG Game Book',
  meta: [
    { name: 'description', content: 'Debug page for testing all game interactions and mechanics' }
  ]
})

// Reactive data
const quickSection = ref('')

// Built on the server from the section texts and the book's rules, so it is always complete
const { data: categories } = await useFetch(`/api/books/${getBook().id}/interactions`, { default: () => [] })

const accordionItems = computed(() => categories.value
  .filter(category => category.sections.length > 0)
  .map(category => ({
    ...category,
    label: category.name,
    value: category.id
  })))

// Methods
const openRandomSection = (sections: string[]) => {
  const randomSection = sections[Math.floor(Math.random() * sections.length)]
  window.open(`/debug/${randomSection}`, '_blank')
}

const openFirstFive = (sections: string[]) => {
  const firstFive = sections.slice(0, 5)
  firstFive.forEach(section => {
    window.open(`/debug/${section}`, '_blank')
  })
}

const goToSection = () => {
  if (quickSection.value.trim()) {
    const section = quickSection.value.trim()
    window.open(`/debug/${section}`, '_blank')
    quickSection.value = ''
  }
}

const openCharacterSheet = () => {
  // This would trigger the character sheet modal in the actual game
  navigateTo(`/${getBook().id}`)
}
</script>
