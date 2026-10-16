export default defineAppConfig({
  ui: {
    colors: {
      primary: 'cinnabar',
      secondary: 'stone',
      success: 'green',
      error: 'cinnabar',
      neutral: 'stone'
    },
    // Buttons are words underlined in pencil (`pencil-action` in main.css), lettered in Neucha (`crayon`)
    button: {
      slots: {
        base: 'crayon pencil-action rounded-none px-2'
      },
      // A hand font reads smaller than the sans sizes Nuxt UI assumes
      variants: {
        size: {
          xs: { base: 'text-lg' },
          sm: { base: 'text-xl' },
          md: { base: 'text-[1.375rem]' },
          lg: { base: 'text-[1.625rem]' },
          xl: { base: 'text-[1.875rem] gap-2.5' }
        }
      },
      compoundVariants: [
        // Primary: red pencil, double underline
        { color: 'primary', variant: 'solid', class: 'pencil-action--primary text-primary bg-transparent hover:bg-transparent active:bg-transparent disabled:bg-transparent aria-disabled:bg-transparent' },
        { color: 'error', variant: 'solid', class: 'pencil-action--primary text-error bg-transparent hover:bg-transparent active:bg-transparent disabled:bg-transparent aria-disabled:bg-transparent' },
        // Ordinary actions: ink, one graphite underline
        { color: 'neutral', variant: 'outline', class: 'ring-0 text-ink bg-transparent hover:bg-transparent active:bg-transparent disabled:bg-transparent aria-disabled:bg-transparent focus-visible:ring-0' },
        // Secondary: quiet
        { color: 'neutral', variant: 'ghost', class: 'pencil-action--quiet hover:bg-transparent active:bg-transparent focus-visible:bg-transparent focus-visible:ring-0' },
        // Destructive but secondary
        { color: 'error', variant: 'ghost', class: 'pencil-action--danger text-error hover:bg-transparent active:bg-transparent focus-visible:bg-transparent focus-visible:ring-0' }
      ]
    },
    card: {
      slots: {
        root: 'parchment-surface ring ring-default',
        header: 'font-display text-highlighted'
      }
    },
    // Dialogs are a single sheet of the same paper, edged in ink: no internal dividers
    modal: {
      slots: {
        content: 'parchment-surface divide-y-0',
        header: 'items-start pt-6 pb-1 sm:px-7',
        body: 'pt-3 pb-2 sm:px-7',
        footer: 'justify-center flex-wrap gap-x-6 gap-y-2 pt-4 pb-6 sm:px-7',
        title: 'font-display text-[1.75rem] leading-tight font-medium text-highlighted text-balance',
        description: 'mt-2 text-base text-toned leading-relaxed text-pretty',
        close: 'top-5 end-5'
      },
      variants: {
        overlay: {
          true: { overlay: 'bg-ink/35' }
        },
        // Corners and edge live on this variant in the Nuxt UI theme, so they are set here
        fullscreen: {
          false: { content: 'w-[calc(100vw-2rem)] max-w-lg rounded-none ring-[1.5px] ring-ink' }
        }
      }
    },
    drawer: {
      slots: {
        content: 'bg-elevated ring-[1.5px] ring-ink',
        handle: 'bg-ink/25'
      },
      variants: {
        overlay: {
          true: { overlay: 'bg-ink/35' }
        }
      }
    }
  }
})
