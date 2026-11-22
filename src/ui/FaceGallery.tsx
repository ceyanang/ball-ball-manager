import { PARODY_TEAMS } from '../engine/data/teams'
import { Rng } from '../engine/rng'
import { Face } from './face/Face'

/** Dev-only grid for eyeballing face variety. */
export function FaceGallery() {
  const rng = Rng.fromSeed(2026)
  const rows = Array.from({ length: 60 }, () => ({ seed: rng.int(1, 2 ** 31 - 1), team: rng.pick(PARODY_TEAMS), num: rng.int(0, 99) }))
  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontFamily: "'Big Shoulders Display'", margin: '0 0 12px' }}>Face lab</h1>
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
