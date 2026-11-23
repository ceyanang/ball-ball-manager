import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { capSeason, tradesOpen } from '../../engine/gm/cap'
import { archetypeFor } from '../../engine/player/archetype'
import type { Player } from '../../engine/types'
import { OvrPill } from '../components/OvrPill'
import { Face } from '../face/Face'
import { POSITIONS, RATING_GROUPS, filterPlayers, type PosFilter } from '../playerFilter'
import { ratingColor } from '../ratingColor'
import { useStore } from '../store'
import { fullName, heightStr, money, one, ovrOf, seasonLine, teamFull } from '../util'

/** Quick-glance roster browser: your team by default, any team or the whole league with filters. Tap a player for their OVR breakdown. */
export function Roster() {
  const league = useStore((s) => s.league)!
  const me = league.userTeamId
  const [params, setParams] = useSearchParams()
  const team = params.get('team') ?? me
  const pos = (params.get('pos') ?? 'All') as PosFilter
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const teams = useMemo(() => Object.values(league.teams).sort((a, b) => a.city.localeCompare(b.city)), [league])
  const players = useMemo(() => filterPlayers(Object.values(league.players), { team, pos, q }), [league, team, pos, q])
  const set = (k: string, v: string, dflt: string) => {
    const n = new URLSearchParams(params)
    if (v === dflt) n.delete(k); else n.set(k, v)
    setParams(n, { replace: true })
    setOpen(null)
  }
  const showTeam = team === 'All'

  const detail = (p: Player) => {
    const line = seasonLine(league, p)
    const canTrade = p.teamId !== me && tradesOpen(league)
    return (
      <div className="rq-detail">
        <div className="rq-facts">
          <span>{heightStr(p.heightIn)} · {p.age}y · #{p.jersey}</span>
          <span>Potential <strong>{p.pot}</strong></span>
          <span>{p.contract ? `${money(p.contract.salary)} through S${p.contract.expires}${p.contract.expires < capSeason(league) ? ' (expiring)' : ''}` : 'No contract'}</span>
          {line && <span>{one(line.pg.pts)} pts · {one(line.pg.reb)} reb · {one(line.pg.ast)} ast ({line.s.gp} gp)</span>}
        </div>
        <div className="rq-groups">
          {RATING_GROUPS.map(([g, keys]) => (
            <div key={g}>
              <h4>{g}</h4>
              {keys.map(([k, label]) => (
                <div key={k} className="rq-rating">
                  <span>{label}</span>
                  <strong style={{ color: ratingColor(p.ratings[k]) }}>{p.ratings[k]}</strong>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Link className="btn" to={`/player/${p.id}`}>Full profile →</Link>
          {canTrade && <Link className="btn btn-primary" to={`/trade?team=${p.teamId}&get=${p.id}`}>Trade for him</Link>}
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1>Roster</h1>
        {team === me && <Link className="link muted" to="/my-team">Set rotation →</Link>}
      </div>
      <div className="filters">
        <label className="field">Team
          <select value={team} onChange={(e) => set('team', e.target.value, me)}>
            <option value={me}>My team · {league.teams[me].name}</option>
            <option value="All">All teams</option>
            {teams.filter((t) => t.id !== me).map((t) => <option key={t.id} value={t.id}>{teamFull(t)}</option>)}
          </select>
        </label>
        <label className="field">Search
          <input type="search" placeholder="Player name" value={q} onChange={(e) => { setQ(e.target.value); setOpen(null) }} />
        </label>
        <div className="seg" role="group" aria-label="Position">
          {(['All', ...POSITIONS] as PosFilter[]).map((x) => <button key={x} className="btn" aria-pressed={pos === x} onClick={() => set('pos', x, 'All')}>{x}</button>)}
        </div>
      </div>
      <p className="muted" style={{ margin: 0 }}>{players.length} player{players.length === 1 ? '' : 's'} · tap one to see their ratings</p>
      <div className="rq-list">
        {players.slice(0, 150).map((p) => {
          const t = league.teams[p.teamId!]
          const isOpen = open === p.id
          return (
            <div key={p.id} className={`rq${isOpen ? ' open' : ''}`}>
              <button className="rq-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.id)}>
                <Face seed={p.faceSeed} age={p.age} colors={t.colors} size={34} />
                <span className="asset-main">
                  <span className="asset-name">{fullName(p)}{p.injury ? ' 🤕' : ''}</span>
                  <span className="asset-sub">{p.pos} · {p.age}y · {archetypeFor(p)}{showTeam ? ` · ${t.abbrev}` : ''}</span>
                </span>
                <OvrPill value={ovrOf(p)} pot={p.pot} />
              </button>
              {isOpen && detail(p)}
            </div>
          )
        })}
        {players.length > 150 && <p className="muted">Showing the top 150. Narrow it down with a team, position or name.</p>}
        {!players.length && <p className="muted">No players match.</p>}
      </div>
    </div>
  )
}
