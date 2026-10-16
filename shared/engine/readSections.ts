import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** A pack's sections as printed: { '001': markdown, ..., preface: markdown }. Node only: tests and scripts */
export const readSections = (packDir: string): Record<string, string> => {
  const dir = join(packDir, 'sections')
  return Object.fromEntries(readdirSync(dir)
    .filter(file => /^(\d{3}|preface)\.md$/.test(file))
    .map(file => [file.slice(0, -3), readFileSync(join(dir, file), 'utf-8')]))
}
