import { Link } from 'react-router-dom'
import { projectedSlot } from '../../engine/gm/value'
import { archetypeFor } from '../../engine/player/archetype'
import type { Asset } from '../../engine/gm/trade'
import type { League } from '../../engine/types'
import { Face } from '../face/Face'
import { tradeLabel } from '../tradeText'
import { fullName, money, ovrOf } from '../util'
import { OvrPill } from './OvrPill'

/** The asset rows inside a trade-finder offer card (players with face/OVR, picks with projected slot). */
export function OfferAssets({ league, assets, colors }: { league: League; assets: Asset[]; colors: { primary: string; secondary: string } }) {
  return (
    <>
      {assets.map((a) => {
        if (a.kind === 'pick') {
          const pk = league.picks.find((p) => p.id === a.id)!
          return (
            <div key={a.id} className="asset pick">
              <span className="pick-chip">R{pk.round}</span>
              <span className="asset-main">
                <span className="asset-name">{tradeLabel(league, a)}</span>
                <span className="asset-sub">Projected #{projectedSlot(league, pk)} in round {pk.round}</span>
              </span>
            </div>
          )
        }
        const p = league.players[a.id]
        return (
          <div key={a.id} className="asset">
            <Face seed={p.faceSeed} age={p.age} colors={colors} size={30} />
            <span className="asset-main">
              <Link to={`/player/${p.id}`} className="asset-name">{fullName(p)}{p.injury ? ' 🤕' : ''}</Link>
              <span className="asset-sub">{p.pos} · {p.age}y · {archetypeFor(p)}</span>
            </span>
            <span className="asset-money">{p.contract ? money(p.contract.salary) : ''}</span>
            <OvrPill value={ovrOf(p)} pot={p.pot} />
          </div>
        )
      })}
    </>
  )
}
