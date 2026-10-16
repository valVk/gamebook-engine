import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getBook, setBook } from '#shared/engine/library'
import { buildInteractionIndex } from '#shared/utils/interactionIndex'
import packDirs from '#pack-dirs'

// The registry holds every installed book; these tests read «Повелитель»
setBook('povelitel')

const dir = join(packDirs.povelitel!, 'sections')
const sections = Object.fromEntries(
  readdirSync(dir)
    .filter(file => file.endsWith('.md'))
    .map(file => [file.slice(0, -3), readFileSync(join(dir, file), 'utf-8')])
)
const index = buildInteractionIndex(getBook(), sections)
const category = (id: string) => index.find(entry => entry.id === id)!.sections

describe('buildInteractionIndex', () => {
  it('finds the unreachable sections (328 is only reached by the Reduction spell)', () => {
    expect(category('unreachable')).toEqual(['056', '328', '370'])
  })

  it('splits sword fights and telepathic duels (43 combat sections in total)', () => {
    const combat = new Set([...category('combat-sword'), ...category('combat-mind')])
    expect(combat.size).toBe(43)
    expect(category('combat-mind')).toEqual(expect.arrayContaining(['016', '343', '385', '515', '555']))
    expect(combat.has('105')).toBe(false)
  })

  it('includes rolled damage and meals in strength changes', () => {
    expect(category('strength')).toEqual(expect.arrayContaining(['029', '067', '024', '127']))
  })

  it('does not report reference pages as endings', () => {
    expect(category('ending')).not.toContain('488')
    expect(category('peek')).toContain('488')
  })

  it('lists the 15 luck checks', () => {
    expect(category('luck')).toHaveLength(15)
  })
})
