import { useState } from 'react'
import { PERSONAS } from '../../engine/stories/social'
import { fanOf, teamFan } from '../../engine/stories/sentiment'
import { PostCard } from '../components/Stories'
import { Face } from '../face/Face'
import { useStore } from '../store'
import { fullName, ovrOf } from '../util'

const TABS = ['For you', 'My team', 'Players'] as const

export function Social() {
  const league = useStore((s) => s.league)!
  const [tab, setTab] = useState<(typeof TABS)[number]>('For you')
  const me = league.userTeamId
  const posts = [...league.social].reverse().filter((p) =>
    tab === 'My team' ? p.teamIds.includes(me) || (p.author.kind === 'fan' && p.author.teamId === me) || (p.author.kind === 'player' && league.players[p.author.playerId]?.teamId === me)
    : tab === 'Players' ? p.author.kind === 'player' : true).slice(0, 150)
  const mood = teamFan(league, me)
  const pulse = Object.values(league.players).filter((p) => p.teamId && ovrOf(p) >= 66 && league.fans.players[p.id] !== undefined)
  const hot = [...pulse].sort((a, b) => fanOf(league, b.id) - fanOf(league, a.id)).slice(0, 3)
  const cold = [...pulse].sort((a, b) => fanOf(league, a.id) - fanOf(league, b.id)).slice(0, 3)
  return (
    <div className="social-layout">
      <div className="stack">
        <h1>Hoopr</h1>
        <div className="chips" role="tablist">
          {TABS.map((t) => <button key={t} role="tab" aria-selected={t === tab} className={`chip${t === tab ? ' on' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
        </div>
        <div className="feed">
          {posts.length ? posts.map((p) => <PostCard key={p.id} league={league} post={p} />) : <p className="muted" style={{ padding: '1rem' }}>The timeline is quiet. Sim a day.</p>}
        </div>
      </div>
      <aside className="stack social-side">
        <section className="panel stack" style={{ gap: '0.5rem' }}>
          <h3>Fan pulse: {league.teams[me].name}</h3>
          <div className="pulse-bar" aria-label={`Fan mood ${mood}`}><span style={{ left: `${(mood + 100) / 2}%` }} /></div>
          <div className="muted">{mood > 40 ? 'The city is buzzing 🔥' : mood > 10 ? 'Fans are feeling good 🙂' : mood > -10 ? 'Fans are waiting to see 😐' : mood > -40 ? 'Grumbling in the stands 😒' : 'Full meltdown mode 💀'}</div>
        </section>
        <section className="panel stack" style={{ gap: '0.45rem' }}>
          <h3>🔥 Fan favourites</h3>
          {hot.map((p) => <div key={p.id} className="row" style={{ justifyContent: 'space-between' }}><span>{fullName(p)} <span className="muted">{league.teams[p.teamId!].abbrev}</span></span><span className="delta-up">+{fanOf(league, p.id)}</span></div>)}
          <h3>🥶 Getting roasted</h3>
          {cold.map((p) => <div key={p.id} className="row" style={{ justifyContent: 'space-between' }}><span>{fullName(p)} <span className="muted">{league.teams[p.teamId!].abbrev}</span></span><span className="delta-down">{fanOf(league, p.id)}</span></div>)}
        </section>
        <section className="panel stack" style={{ gap: '0.5rem' }}>
          <h3>Who to follow</h3>
          {Object.entries(PERSONAS).map(([id, per]) => (
            <div key={id} className="row" style={{ gap: '0.5rem' }}>
              <Face seed={per.seed} age={34} colors={{ primary: '#1c2030', secondary: '#f5b400' }} size={30} />
              <div style={{ lineHeight: 1.15 }}><strong>{per.name}</strong><div className="muted" style={{ fontSize: '0.8rem' }}>@{per.handle} · {per.bio}</div></div>
            </div>
          ))}
        </section>
      </aside>
    </div>
  )
}
