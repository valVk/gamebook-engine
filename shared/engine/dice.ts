/** A dice formula: `NdM`, optionally `+K` or `-K` ('1d6+6', '2d6+12') */
export type DiceFormula = `${number}d${number}` | `${number}d${number}${'+' | '-'}${number}`

const FORMULA = /^(\d+)d(\d+)(?:([+-])(\d+))?$/

/** The parts of a formula: how many dice, how many sides, what is added */
export const parseFormula = (formula: string) => {
  const match = FORMULA.exec(formula.replace(/\s/g, ''))
  if (!match) throw new Error(`Unsupported dice formula: ${formula}`)
  const [, count, sides, sign, value] = match
  return { count: Number(count), sides: Number(sides), modifier: (sign === '-' ? -1 : 1) * Number(value ?? 0) }
}
