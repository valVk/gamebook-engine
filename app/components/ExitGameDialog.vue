<template>
  <UModal
    v-model:open="showDialog"
    title="Закончить путешествие?"
    description="Листок путешественника будет стерт: характеристики, вещи и пройденный путь. Начать можно будет только заново."
    :ui="{ content: 'sm:max-w-md', footer: 'justify-center' }"
    :content="{ onOpenAutoFocus: focusSafeAction }"
  >
    <!-- The journey so far, as a row of the Листок -->
    <template v-if="gameStats" #body>
      <div class="grid grid-cols-3 border-y-[1.5px] border-ink">
        <div v-for="(cell, i) in summary" :key="cell.label" class="flex flex-col gap-1 px-3 py-2.5" :class="{ 'border-l-[1.5px] border-ink': i > 0 }">
          <span class="cell-label">{{ cell.label }}</span>
          <span class="pencil text-2xl leading-tight">{{ cell.value }}<span v-if="cell.note" class="text-base ml-1">{{ cell.note }}</span></span>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton ref="continueButton" color="neutral" variant="ghost" label="Продолжить путешествие" @click="cancel" />
      <UButton color="error" label="Закончить" @click="confirm" />
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { getBook } from '#shared/engine/library'
interface Props {
  modelValue: boolean
  gameStats?: {
    duration: number
    pagesVisited: number
    currentPage: string
    strength: number
    maxStrength: number
  } | null
}

interface Emits {
  'update:modelValue': [value: boolean]
  'confirm': []
  'cancel': []
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const showDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours} ч ${minutes % 60} мин`
  } else if (minutes > 0) {
    return `${minutes} мин`
  } else {
    return '< 1 мин'
  }
}

const paragraphs = (n: number) => {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'параграф'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'параграфа'
  return 'параграфов'
}

const summary = computed(() => props.gameStats
  ? [
      { label: 'В ПУТИ', value: formatDuration(props.gameStats.duration), note: '' },
      { label: 'ПРОЙДЕНО', value: props.gameStats.pagesVisited, note: paragraphs(props.gameStats.pagesVisited) },
      { label: getBook().statLabel('strength').name, value: props.gameStats.strength, note: `из ${props.gameStats.maxStrength}` }
    ]
  : [])

// Destructive dialog: focus starts on the safe action, not on the close icon
const continueButton = useTemplateRef<{ $el: HTMLElement }>('continueButton')
const focusSafeAction = (event: Event) => {
  event.preventDefault()
  // Focus for keyboard users without drawing the focus frame after a mouse click
  continueButton.value?.$el.focus({ focusVisible: false } as FocusOptions)
}

const confirm = () => {
  emit('confirm')
  showDialog.value = false
}

const cancel = () => {
  emit('cancel')
  showDialog.value = false
}
</script>
