import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BUILD_BUDGET, BUILD_TEMPLATES, CAREER_FLOOR, START_OVR, buildCost, makeBuild, startRatings } from '../../../engine/career/build'
import { mostLikelyStyle, PLAY_STYLES, STYLE_BLURB, STYLE_EMOJI, STYLE_LABEL, type PlayStyle } from '../../../engine/player/playStyle'
import { HERITAGES, type Heritage } from '../../../engine/face/heritage'
import { POSITION_HEIGHT_BOUNDS } from '../../../engine/player/generate'
import { RATING_GROUPS, RATING_MAX } from '../../../engine/player/ratings'
import type { Position, Ratings } from '../../../engine/types'
import { useStore } from '../../store'
import { ratingColor } from '../../ratingColor'

const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']
const randomSeed = () => Math.floor(Math.random() * 1_000_000)
const feet = (inch: number) => `${Math.floor(inch / 12)}'${inch % 12}"`

/** MyCareer step one: set the maximum of every attribute from a shared point pool. */
export function Builder() {
  const newCareer = useStore((s) => s.newCareer)
  const busy = useStore((s) => s.busy)
  const navigate = useNavigate()
  const [seed] = useState(randomSeed)
  const [templateId, setTemplateId] = useState(BUILD_TEMPLATES[0].id)
  const [pos, setPos] = useState<Position>(BUILD_TEMPLATES[0].pos)
  const [max, setMax] = useState<Ratings>({ ...BUILD_TEMPLATES[0].max })
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [heritage, setHeritage] = useState<Heritage | ''>('')
  const [heightIn, setHeightIn] = useState(Math.round(POSITION_HEIGHT_BOUNDS[BUILD_TEMPLATES[0].pos][0]))
  const [leagueName, setLeagueName] = useState('My Career')
  /** Null until the user picks: then the default follows his build (the most likely style for his start ratings). */
  const [chosenStyle, setChosenStyle] = useState<PlayStyle | null>(null)

  const spent = buildCost(max)
  const left = BUILD_BUDGET - spent
  const build = useMemo(() => makeBuild(max, pos), [max, pos])
  const [, hMin, hMax] = POSITION_HEIGHT_BOUNDS[pos]
  const suggestedStyle = useMemo(() => mostLikelyStyle(pos, startRatings(max)), [pos, max])
  const playStyle = chosenStyle ?? suggestedStyle

  const pickTemplate = (id: string) => {
    const t = BUILD_TEMPLATES.find((x) => x.id === id)!
    setTemplateId(id); setPos(t.pos); setMax({ ...t.max })
    setHeightIn(Math.round(POSITION_HEIGHT_BOUNDS[t.pos][0]))
  }
  const pickPos = (p: Position) => {
    setPos(p)
    const [mean, lo, hi] = POSITION_HEIGHT_BOUNDS[p]
    setHeightIn(Math.max(lo, Math.min(hi, Math.round(mean))))
  }
  const setKey = (k: keyof Ratings, v: number) => setMax((m) => ({ ...m, [k]: Math.max(CAREER_FLOOR, Math.min(RATING_MAX, Math.min(v, m[k] + left))) }))

  const go = async () => {
    await newCareer({ seed, name: leagueName.trim() || 'My Career', build: { max, pos, first, last, heritage: heritage || undefined, heightIn, playStyle } })
    navigate('/career/draft')
  }

  return (
    <div className="stack">
      <h1>MyCareer — build your player</h1>
      <p className="muted" style={{ margin: 0, maxWidth: '62ch' }}>
        Set each attribute’s <b>maximum</b>. You spend every point you have, then you start well below those maxes at 19 and grow into them.
        However you build him, a fully maxed player is a 99.
      </p>
      <div className="row cb-fields" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="field">First name<input value={first} onChange={(e) => setFirst(e.target.value)} maxLength={16} /></label>
        <label className="field">Last name<input value={last} onChange={(e) => setLast(e.target.value)} maxLength={20} /></label>
        <label className="field">Heritage
          <select value={heritage} onChange={(e) => setHeritage(e.target.value as Heritage | '')}>
            <option value="">Random</option>
            {HERITAGES.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </label>
        <label className="field">League name<input value={leagueName} onChange={(e) => setLeagueName(e.target.value)} maxLength={40} /></label>
      </div>
      <div className="chips cb-pos" role="tablist" aria-label="Position">
        {POSITIONS.map((p) => <button key={p} role="tab" aria-selected={pos === p} className={`chip${pos === p ? ' on' : ''}`} onClick={() => pickPos(p)}>{p}</button>)}
        <label className="field cb-height" style={{ marginLeft: '0.6rem' }}>Height {feet(heightIn)}
          <input type="range" min={hMin} max={hMax} value={heightIn} onChange={(e) => setHeightIn(Number(e.target.value))} />
        </label>
      </div>
      <div className="chips cb-templates" aria-label="Templates">
        {BUILD_TEMPLATES.map((t) => <button key={t.id} className={`chip${templateId === t.id ? ' on' : ''}`} onClick={() => pickTemplate(t.id)}>{t.label}</button>)}
      </div>
      <section className="stack cb-style" aria-label="Play style">
        <h2 style={{ margin: 0 }}>Play style <span className="muted" style={{ fontSize: '0.85rem', fontWeight: 400 }}>fixed for his whole career</span></h2>
        <div className="chips" role="radiogroup" aria-label="Play style">
          {PLAY_STYLES.map((s) => (
            <button key={s} role="radio" aria-checked={playStyle === s} className={`chip${playStyle === s ? ' on' : ''}`} onClick={() => setChosenStyle(s)} title={STYLE_BLURB[s]}>
              {STYLE_EMOJI[s]} {STYLE_LABEL[s]}{chosenStyle === null && s === suggestedStyle ? ' · fits your build' : ''}
            </button>
          ))}
        </div>
        <p className="muted" style={{ margin: 0 }}>{STYLE_EMOJI[playStyle]} <b>{STYLE_LABEL[playStyle]}</b>: {STYLE_BLURB[playStyle]}</p>
      </section>
      <div className="panel cb-summary" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
        <div className="row cb-summary-row" style={{ flexWrap: 'wrap', gap: '1.2rem' }}>
          <span><b>{build.archetype}</b></span>
          <span title="Points left to spend">Points left <b className="num">{left}</b> / {BUILD_BUDGET}</span>
          <span>Max Career OVR <b className="num">{left === 0 ? 99 : '—'}</b></span>
          <span>Starts at <b className="num">{START_OVR}</b></span>
        </div>
      </div>
      {RATING_GROUPS.map(([group, entries]) => (
        <section key={group} className="stack">
          <h2>{group}</h2>
          {entries.map(([k, label]) => (
            <label key={k} className="row cb-rating" style={{ gap: '0.6rem' }}>
              <span className="cb-label" style={{ width: '11rem' }}>{label}</span>
              <input type="range" min={CAREER_FLOOR} max={RATING_MAX} value={k === 'intangibles' ? RATING_MAX : max[k]} disabled={k === 'intangibles'} title={k === 'intangibles' ? 'Always 99 — free' : undefined} onChange={(e) => setKey(k, Number(e.target.value))} style={{ flex: 1, accentColor: ratingColor(max[k]) }} />
              <strong className="num cb-val" style={{ width: '2rem', textAlign: 'right', color: ratingColor(max[k]) }}>{k === 'intangibles' ? RATING_MAX : max[k]}</strong>
            </label>
          ))}
        </section>
      ))}
      <div className="start-bar">
        <button className="btn btn-primary" disabled={left !== 0 || busy} onClick={go}>
          {left === 0 ? 'Continue to draft night' : `Spend ${left} more point${left === 1 ? '' : 's'} to continue`}
        </button>
      </div>
    </div>
  )
}
