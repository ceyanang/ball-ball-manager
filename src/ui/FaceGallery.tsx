import { useMemo, useState } from 'react'
import { PARODY_TEAMS } from '../engine/data/teams'
import { HERITAGES, encodeHeritage, type Heritage } from '../engine/face/heritage'
import { Rng } from '../engine/rng'
import { Face } from './face/Face'

/** Dev-only grid for eyeballing face variety, filterable by heritage. */
export function FaceGallery() {
  const initial = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('h') as Heritage | null
  const [h, setH] = useState<Heritage | 'all'>(initial && HERITAGES.includes(initial) ? initial : 'all')
  const rows = useMemo(() => {
    const rng = Rng.fromSeed(2026)
    return Array.from({ length: 60 }, () => {
      const raw = rng.int(1, 2 ** 31 - 1)
      return { seed: h === 'all' ? raw : encodeHeritage(raw, h), team: rng.pick(PARODY_TEAMS), num: rng.int(0, 99) }
    })
  }, [h])
  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontFamily: "'Big Shoulders Display'", margin: '0 0 12px' }}>Face lab</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {(['all', ...HERITAGES] as const).map((x) => (
          <button key={x} onClick={() => setH(x)} style={{ fontWeight: x === h ? 800 : 400 }}>{x}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {rows.map((r) => (
          <div key={r.seed} style={{ display: 'flex', gap: 2, background: '#e9edf3', borderRadius: 8, padding: 4 }}>
            {[22, 30, 38].map((age) => (
              <Face key={age} seed={r.seed} age={age} colors={r.team} jersey={r.num} size={70} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
