import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RECORD_LABEL, RECORD_STATS } from '../../engine/stories/records'
import type { League, RecordBook, RecordScope } from '../../engine/types'
import { AwardsCeremony } from '../components/Stories'
import { AwardChips } from '../components/AwardChips'
import { playerAwards } from '../../engine/stories/awards'
import { TeamBadge } from '../components/TeamBadge'
import { Face } from '../face/Face'
import { useStore } from '../store'
import { fullName, teamFull } from '../util'

const TABS = ['Seasons', 'Awards', 'Records', 'Hall of Fame'] as const
type Tab = (typeof TABS)[number]

export function RecordTable({ league, book, scope }: { league: League; book: RecordBook | undefined; scope: RecordScope }) {
  const rows = RECORD_STATS.map((s) => [s, book?.[scope][s]] as const)
  if (rows.every(([, e]) => !e)) return <p className="muted" style={{ margin: 0 }}>No records yet.</p>
  return (
    <div className="table-wrap">
      <table className="stats">
        <thead><tr><th>Stat</th><th>Record</th><th className="left">Holder</th><th>Season</th><th className="left">Previous</th></tr></thead>
        <tbody>
          {rows.map(([s, e]) => e && (
            <tr key={s}>
              <td>{RECORD_LABEL[s]}{scope === 'season' ? ' / game' : ''}</td>
              <td><strong>{e.value}</strong></td>
              <td className="left">{league.players[e.playerId] ? <Link className="link" to={`/player/${e.playerId}`}>{fullName(league.players[e.playerId])}</Link> : '—'} <span className="muted">{league.teams[e.teamId]?.abbrev}</span>{e.gameId && league.games.some((g) => g.id === e.gameId && g.result?.box.length) && <> · <Link className="link muted" to={`/game/${e.gameId}`}>box</Link></>}</td>
              <td>{e.season}</td>
              <td className="left muted">{e.prev ? `${e.prev.value} · ${league.players[e.prev.playerId] ? fullName(league.players[e.prev.playerId]) : '—'} (S${e.prev.season})` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Seasons({ league }: { league: League }) {
  const hist = [...league.history].reverse()
  const [open, setOpen] = useState<number | null>(hist[0]?.season ?? null)
  if (!hist.length) return <section className="panel"><p className="muted" style={{ margin: 0 }}>League history starts when the first Finals end.</p></section>
  return (
    <div className="stack">
      {hist.map((h) => {
        const champ = h.championId ? league.teams[h.championId] : null
        const runner = h.runnerUpId ? league.teams[h.runnerUpId] : null
        const a = league.awards.find((x) => x.season === h.season)
        const mvp = a?.mvp ? league.players[a.mvp] : null
        const trades = league.transactions.filter((t) => t.season === h.season && t.type === 'trade')
        const signings = league.transactions.filter((t) => t.season === h.season && t.type === 'sign' && t.phase === 'offseason').slice(0, 12)
        const picks = Object.values(league.players).filter((p) => p.draft?.season === h.season && p.draft.round === 1).sort((x, y) => x.draft!.pick - y.draft!.pick)
        const isOpen = open === h.season
        return (
          <section key={h.season} className="panel stack">
            <button className="season-row" onClick={() => setOpen(isOpen ? null : h.season)} aria-expanded={isOpen}>
              <span className="num" style={{ fontSize: '1.6rem' }}>S{h.season}</span>
              {champ && <TeamBadge team={champ} size={36} />}
              <span style={{ flex: 1, textAlign: 'left' }}><strong>{champ ? teamFull(champ) : '—'}</strong>{runner && <span className="muted"> beat {teamFull(runner)} {h.finals}</span>}</span>
              {mvp && <span className="muted">MVP {fullName(mvp)}</span>}
              <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
            </button>
            {isOpen && (
              <div className="grid-2">
                <div className="stack" style={{ gap: '0.5rem' }}>
                  <h3>Final standings</h3>
                  {(['East', 'West'] as const).map((conf) => (
                    <div key={conf} className="table-wrap">
                      <table className="stats">
                        <thead><tr><th>{conf}</th><th>W</th><th>L</th></tr></thead>
                        <tbody>{h.standings.filter((r) => r.conf === conf).map((r) => (
                          <tr key={r.teamId} className={r.teamId === league.userTeamId ? 'me' : ''}><td><Link className="link" to={`/team/${r.teamId}`}>{league.teams[r.teamId].name}</Link>{r.teamId === h.championId ? ' 🏆' : ''}</td><td>{r.w}</td><td>{r.l}</td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                  ))}
                </div>
                <div className="stack" style={{ gap: '0.5rem' }}>
                  <h3>Stat leaders</h3>
                  <ul className="progress-list">
                    {h.leaders.map((x) => <li key={x.stat}><span>{x.stat}: {league.players[x.playerId] ? <Link className="link" to={`/player/${x.playerId}`}>{fullName(league.players[x.playerId])}</Link> : '—'} <span className="muted">{league.teams[x.teamId]?.abbrev}</span></span><strong>{x.value}</strong></li>)}
                  </ul>
                  {picks.length > 0 && <>
                    <h3>Draft · first round</h3>
                    <ul className="progress-list">{picks.slice(0, 10).map((p) => <li key={p.id}><span>#{p.draft!.pick} <Link className="link" to={`/player/${p.id}`}>{fullName(p)}</Link></span><span className="muted">{league.teams[p.draft!.teamId]?.abbrev}</span></li>)}</ul>
                  </>}
                  <h3>Trades ({trades.length})</h3>
                  {trades.length ? <ul className="tx-list">{trades.map((t, i) => <li key={i}>{t.text}</li>)}</ul> : <span className="muted">None.</span>}
                  {signings.length > 0 && <>
                    <h3>Notable signings</h3>
                    <ul className="tx-list">{signings.map((t, i) => <li key={i}>{t.text}</li>)}</ul>
                  </>}
                </div>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function Awards({ league }: { league: League }) {
  const seasons = league.awards.map((a) => a.season).sort((a, b) => b - a)
  const [season, setSeason] = useState(seasons[0])
  const a = league.awards.find((x) => x.season === season)
  if (!a) return <section className="panel"><p className="muted" style={{ margin: 0 }}>Awards are handed out after the Finals.</p></section>
  return (
    <div className="stack">
      {seasons.length > 1 && <select className="select" style={{ alignSelf: 'flex-start' }} value={season} onChange={(e) => setSeason(Number(e.target.value))}>{seasons.map((s) => <option key={s} value={s}>Season {s}</option>)}</select>}
      <AwardsCeremony key={a.season} league={league} a={a} reveal={false} />
    </div>
  )
}

function Records({ league }: { league: League }) {
  const [teamId, setTeamId] = useState<string>('')
  const book = teamId ? league.records.teams[teamId] : league.records.league
  return (
    <div className="stack">
      <select className="select" style={{ alignSelf: 'flex-start' }} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
        <option value="">League records</option>
        {Object.values(league.teams).sort((a, b) => a.name.localeCompare(b.name)).map((t) => <option key={t.id} value={t.id}>{teamFull(t)}</option>)}
      </select>
      {(['game', 'season', 'career'] as const).map((scope) => (
        <section key={scope} className="panel stack">
          <h2>{scope === 'game' ? 'Single game' : scope === 'season' ? 'Single season' : 'Career'}</h2>
          <RecordTable league={league} book={book} scope={scope} />
        </section>
      ))}
      <p className="muted" style={{ margin: 0 }}>Regular season only. Season records need 70% of games played.</p>
    </div>
  )
}

function HallOfFame({ league }: { league: League }) {
  const hof = [...league.hof].sort((a, b) => b.season - a.season || b.score - a.score)
  if (!hof.length) return <section className="panel"><p className="muted" style={{ margin: 0 }}>No one has been inducted yet. Great careers are voted in when players retire.</p></section>
  return (
    <div className="hof-grid">
      {hof.map((h) => {
        const p = league.players[h.playerId]
        if (!p) return null
        const lastTeam = [...Object.values(league.statLines)].filter((s) => s.playerId === p.id).sort((a, b) => b.season - a.season)[0]?.teamId
        const colors = lastTeam ? league.teams[lastTeam].colors : { primary: '#5b6378', secondary: '#fff' }
        return (
          <div key={h.playerId} className="hof-card">
            <Link to={`/player/${p.id}`} className="hof-card-link">
              <Face seed={p.faceSeed} age={p.age} colors={colors} size={72} title={fullName(p)} />
              <div className="award-winner">{fullName(p)}</div>
              <div className="muted">{p.pos} · inducted S{h.season} · score {h.score}</div>
            </Link>
            <AwardChips awards={playerAwards(league, p.id)} />
          </div>
        )
      })}
    </div>
  )
}

export function History() {
  const league = useStore((s) => s.league)!
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t === params.get('tab')) ?? 'Seasons') as Tab
  return (
    <div className="stack">
      <h1>History</h1>
      <div className="chips" role="tablist">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={t === tab} className={`chip${t === tab ? ' on' : ''}`} onClick={() => setParams({ tab: t })}>{t}</button>)}
      </div>
      {tab === 'Seasons' && <Seasons league={league} />}
      {tab === 'Awards' && <Awards league={league} />}
      {tab === 'Records' && <Records league={league} />}
      {tab === 'Hall of Fame' && <HallOfFame league={league} />}
    </div>
  )
}
