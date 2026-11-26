import { analyzeUnitSynergy } from '../../engine/gm/synergy'
import type { Player } from '../../engine/types'
import { ratingColor } from '../ratingColor'

/** Live starting-unit fit and active synergy bonuses / spacing warnings. */
export function LineupFitPanel({ starters }: { starters: Player[] }) {
  const unitSyn = analyzeUnitSynergy(starters)
  return (
    <section className="panel stack" aria-label="Lineup fit and synergy breakdown">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h3>Lineup fit · Starting five</h3>
        <span className="muted">
          Unit fit <strong style={{ color: ratingColor(unitSyn.score) }}>{unitSyn.grade} · {unitSyn.score}</strong>
        </span>
      </div>
      <div className="cat-pills">
        <span className="cat-pill"><span className="muted">80+ Shooters</span><strong>{unitSyn.summary.shooters80}</strong></span>
        <span className="cat-pill"><span className="muted">Stretch Bigs</span><strong>{unitSyn.summary.stretchBigs}</strong></span>
        <span className="cat-pill"><span className="muted">Playmakers</span><strong>{unitSyn.summary.playmakers}</strong></span>
        <span className="cat-pill"><span className="muted">Rim Anchors</span><strong>{unitSyn.summary.rimProtectors}</strong></span>
        <span className="cat-pill"><span className="muted">Lockdowns</span><strong>{unitSyn.summary.lockdowns}</strong></span>
        {unitSyn.summary.nonShooters >= 3 && (
          <span className="cat-pill syn-warn-pill"><span>Non-shooters (&lt;70 3PT)</span><strong>{unitSyn.summary.nonShooters}</strong></span>
        )}
      </div>
      <div className="synergy-grid">
        {unitSyn.items.map((item) => {
          const cls = item.kind === 'warning'
            ? (item.active ? 'synergy-card syn-warn' : 'synergy-card syn-muted')
            : (item.active ? 'synergy-card syn-active' : 'synergy-card syn-muted')
          const icon = item.kind === 'warning' ? (item.active ? '⚠' : '✓') : (item.active ? '✓' : '○')
          return (
            <div key={item.id} className={cls}>
              <div className="row" style={{ justifyContent: 'space-between', gap: '0.4rem' }}>
                <strong>{icon} {item.label}</strong>
                <span className="muted" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  {item.kind === 'warning' ? (item.active ? 'PENALTY' : 'CLEAR') : (item.active ? 'ACTIVE' : 'INACTIVE')}
                </span>
              </div>
              <span className="muted" style={{ fontSize: '0.8rem' }}>{item.detail}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
