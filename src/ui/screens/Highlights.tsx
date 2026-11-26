import { useState } from 'react'
import type { NewsKind } from '../../engine/types'
import { NewsCard } from '../components/Stories'
import { useStore } from '../store'

const FILTERS: [string, NewsKind[] | null][] = [
  ['All', null], ['Big games', ['bigGame', 'tripleDouble', 'nearTriple', 'careerHigh', 'rookie']], ['Clutch', ['gameWinner', 'comeback', 'overtime']],
  ['Records', ['record']], ['Streaks', ['streak']], ['Injuries', ['injury']], ['Playoffs & awards', ['series', 'champion', 'award', 'hof']],
]

export function Highlights() {
  const league = useStore((s) => s.league)!
  const seasons = [...new Set([league.season, ...league.news.map((n) => n.season)])].sort((a, b) => b - a)
  const [season, setSeason] = useState(league.season)
  const [filter, setFilter] = useState(0)
  const [mine, setMine] = useState(false)
  const kinds = FILTERS[filter][1]
  const items = league.news
    .filter((n) => n.season === season && (!kinds || kinds.includes(n.kind)) && (!mine || n.teamIds.includes(league.userTeamId)))
    .sort((a, b) => b.day - a.day || b.weight - a.weight)
    .slice(0, 200)
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1>Highlights</h1>
        <div className="row">
          {seasons.length > 1 && <select className="select" value={season} onChange={(e) => setSeason(Number(e.target.value))}>{seasons.map((s) => <option key={s} value={s}>Season {s}</option>)}</select>}
          <label className="row" style={{ gap: '0.4rem' }}><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> My team</label>
        </div>
      </div>
      <div className="chips" role="tablist">
        {FILTERS.map(([label], i) => <button key={label} role="tab" aria-selected={i === filter} className={`chip${i === filter ? ' on' : ''}`} onClick={() => setFilter(i)}>{label}</button>)}
      </div>
      {items.length ? <div className="stack" style={{ gap: '0.6rem', maxWidth: '860px' }}>{items.map((n) => <NewsCard key={n.id} league={league} n={n} />)}</div>
        : <section className="panel"><p className="muted" style={{ margin: 0 }}>No highlights yet. Big nights, buzzer-beaters and records show up here.</p></section>}
    </div>
  )
}
