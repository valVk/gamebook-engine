import { describe, expect, it } from 'vitest'
import { KNOWN_FB2, addLuckMarkers, imageFileName, normalizeLinks } from '../../importers/shelton/fb2'

// Invented sentences in the shape of the known FB2 of «Тайна капитана Шелтона»
describe('«Шелтон» FB2 importer', () => {
  it('knows its file', () => {
    expect(KNOWN_FB2).toEqual({ md5: 'eaf182fbf0d6a79ffc5e77e9a3f06060', bytes: 2221775 })
  })

  it('gives images proper file names', () => {
    expect(imageFileName('p002.png_1')).toBe('p002_1.png')
    expect(imageFileName('pred_01.png_0')).toBe('pred_01_0.png')
    expect(imageFileName('img4906.jpg')).toBe('img4906.jpg')
  })

  it('writes bracketed links as the engine\'s links', () => {
    expect(normalizeLinks('налево [(43)](#n_43) или направо [**7**](#n_7)')).toBe('налево [**43**](#n_43) или направо [**7**](#n_7)')
  })

  it('marks luck checks: two links by themselves, a choice from the hand-marked list', () => {
    const { sections, unclear } = addLuckMarkers({
      '010': 'ПРОВЕРЬТЕ СВОЮ УДАЧУ. Если удачливы, то [**5**](#n_5), если нет, — [**6**](#n_6).\n\n',
      '474': 'ПРОВЕРЬТЕ СВОЮ УДАЧУ. Если вам повезло, — [**139**](#n_139), если нет, — [**43**](#n_43) или [**508**](#n_508).\n\n',
      '475': 'ПРОВЕРЬТЕ СВОЮ УДАЧУ: [**1**](#n_1), [**2**](#n_2) или [**3**](#n_3).\n\n',
      '476': 'Прибавьте себе 2 УДАЧИ.\n\n'
    })
    expect(sections['010']).toMatch(/^<!-- DICE_ROLL_REQUIRED: luck -->\n<!-- LUCK_SUCCESS_LINK: 5 -->\n<!-- LUCK_FAILURE_LINK: 6 -->\n\n/)
    expect(sections['474']).toContain('<!-- LUCK_FAILURE_LINK: 43, 508 -->')
    expect(unclear).toEqual(['475'])
    expect(sections['476']).toBe('Прибавьте себе 2 УДАЧИ.\n\n')
  })
})
