import { describe, expect, it } from 'vitest'
import { checkBook, reportErrors } from '#shared/engine/check'
import { findBook } from '#shared/engine/library'
import { readSections } from '#shared/engine/readSections'
import packDirs from '#pack-dirs'

const report = checkBook(findBook('povelitel')!, readSections(packDirs.povelitel!))

describe('«Повелитель» pack against its text (npm run book:check povelitel)', () => {
  it('has no errors', () => {
    expect(reportErrors(report)).toEqual([])
  })

  it('reaches every section but the two the 1st edition never links to', () => {
    expect(report.unreachable).toEqual(['056', '370'])
    expect(report.reachable).toHaveLength(629)
  })

  // Read one by one in the 2026-10-15 audit: flavour (a tiger's fang, a pigeon, the medallion
  // and belt at work, "золотой" as a colour, rolls that happen in the next section). A new section
  // here means mechanical wording without a rule: register it or add it to this list after reading
  it('leaves only known flavour sections to review', () => {
    expect(report.review.map(entry => entry.section)).toEqual([
      '014', '126', '131', '132', '138', '140', '166', '262', '288', '325', '326',
      '331', '383', '440', '456', '475', '485', '502', '580', '599', '616', '624'
    ])
  })
})
