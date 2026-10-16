import { describe, expect, it } from 'vitest'
import { findQuote, fingerprint, isFingerprint } from '#shared/engine/quote'

describe('quote fingerprints', () => {
  const text = 'Тропа уходит в долину. Если хотите, возьмите фонарь — 12.'

  it('finds a plain quote, and the fragment a fingerprint stands for', () => {
    expect(findQuote(text, 'возьмите фонарь')).toBe('возьмите фонарь')
    expect(fingerprint('возьмите фонарь')).toMatch(/^#15:[0-9a-f]{8}$/)
    expect(isFingerprint(fingerprint('возьмите фонарь'))).toBe(true)
    expect(findQuote(text, fingerprint('возьмите фонарь'))).toBe('возьмите фонарь')
  })

  it('misses a quote that is not in the text', () => {
    expect(findQuote(text, 'возьмите меч')).toBeUndefined()
    expect(findQuote(text, fingerprint('возьмите меч'))).toBeUndefined()
  })
})
