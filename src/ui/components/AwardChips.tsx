import { useEffect, useRef, useState } from 'react'

type Award = { season: number; label: string }

/** Group repeated accolades: [{label, seasons: [newest…oldest]}], in order of first appearance. */
export function groupAwards(awards: Award[]): { label: string; seasons: number[] }[] {
  const map = new Map<string, number[]>()
  for (const a of awards) map.set(a.label, [...(map.get(a.label) ?? []), a.season])
  return [...map].map(([label, seasons]) => ({ label, seasons: seasons.sort((x, y) => y - x) }))
}

/** Prefix the count: "🏆 Champion" ×3 → "3x 🏆 Champion". */
const withCount = (label: string, n: number) => (n > 1 ? `${n}x ${label}` : label)

function AwardChip({ label, seasons }: { label: string; seasons: number[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <span ref={ref} className="award-chip-wrap">
      <button type="button" className="chip on" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{withCount(label, seasons.length)}</button>
      {open && <span role="dialog" className="award-pop">{seasons.map((s) => `S${s}`).join(' · ')}</span>}
    </span>
  )
}

/** Compact accolades: "3x MVP" chips; click one to see the seasons in a small popup above it. */
export function AwardChips({ awards }: { awards: Award[] }) {
  return <div className="chips">{groupAwards(awards).map((g) => <AwardChip key={g.label} {...g} />)}</div>
}
