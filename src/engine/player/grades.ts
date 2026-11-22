const SCALE: [number, string][] = [
  [97, 'A+'], [93, 'A'], [90, 'A−'], [87, 'B+'], [83, 'B'], [80, 'B−'],
  [77, 'C+'], [73, 'C'], [70, 'C−'], [67, 'D+'], [63, 'D'], [60, 'D−'],
]

/** Standard US letter-grade scale applied to a 1–99 rating. */
export function gradeFor(v: number): string {
  for (const [min, g] of SCALE) if (v >= min) return g
  return 'F'
}
