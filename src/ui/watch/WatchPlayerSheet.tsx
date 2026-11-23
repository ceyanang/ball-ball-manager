import type { Player, Team } from '../../engine/types'
import { Sheet } from '../components/Sheet'
import { Face } from '../face/Face'
import { fullName, teamFull } from '../util'
import { onPace, periodLabel, type LiveLine } from './replay'

/** A player's game so far, opened from a quarter break. The player-page link is only offered on the final recap. */
export function WatchPlayerSheet({ player, team, line, ppg, frac, periods, final, fav, onToggleFav, onClose, onOpenPage }: {
  player: Player | null
  team: Team | null
  line: LiveLine
  ppg: number | null
  /** Game time elapsed / 48 min. */
  frac: number
  /** Periods played so far. */
  periods: number
  final: boolean
  fav: boolean
  onToggleFav: () => void
  onClose: () => void
  onOpenPage: () => void
}) {
  const open = !!player && !!team
  const pace = onPace(line.pts, frac)
  const shown = final ? line.pts : pace
  const diff = ppg === null ? null : shown - ppg
  const bars = Array.from({ length: Math.max(4, periods) }, (_, i) => i)
  const max = Math.max(4, ...line.byPeriod)
  const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`
  const cells: [string, string | number][] = [
    ['PTS', line.pts], ['REB', line.reb], ['AST', line.ast], ['STL', line.stl], ['BLK', line.blk], ['TOV', line.tov],
    ['FG', `${line.fgm}/${line.fga}`], ['3P', `${line.tpm}/${line.tpa}`],
    ['FG%', line.fga ? `${Math.round((line.fgm / line.fga) * 100)}%` : '—'], ['MIN', Math.round(line.min)], ['+/-', signed(line.pm)],
  ]

  return (
    <Sheet open={open} onClose={onClose} title={player ? fullName(player) : 'Player'}>
      {player && team && (
        <div className="w-sheet">
          <div className="w-sheet-top">
            <span className="w-sheet-face"><Face seed={player.faceSeed} age={player.age} colors={team.colors} size={56} jersey={player.jersey} title={fullName(player)} /></span>
            <div className="w-sheet-who">
              <div>{player.pos} · #{player.jersey} · {teamFull(team)}</div>
              <div className="muted">{ppg === null ? 'No games yet this season' : `Averages ${ppg.toFixed(1)} ppg`}</div>
            </div>
            <button className={`btn${fav ? ' w-fav-on' : ''}`} onClick={onToggleFav} aria-pressed={fav}>{fav ? '⭐ Your guy' : '☆ Favorite'}</button>
          </div>

          <div className="w-boxgrid">
            {cells.map(([k, v]) => <div key={k}><b>{v}</b>{k}</div>)}
          </div>

          <div>
            <div className="muted w-sheet-lbl">Points by {periods > 4 ? 'period' : 'quarter'}</div>
            <div className="w-qbar">
              {bars.map((i) => {
                const played = i < periods
                const v = line.byPeriod[i] ?? 0
                return (
                  <div key={i} className={played ? undefined : 'todo'} style={{ height: played ? `${Math.max(4, (v / max) * 100)}%` : '4%' }}>
                    <span>{played ? v : periodLabel(i + 1)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="w-pace">
            {final ? 'Finished with ' : 'On pace for '}<b>{shown}</b>{final ? '' : ' tonight'}
            {diff !== null && (
              <> · <span className={diff >= 0 ? 'win' : 'loss'}>{diff >= 0 ? '+' : '−'}{Math.abs(diff).toFixed(1)} vs his average</span></>
            )}
          </div>

          {final && <button className="btn" onClick={onOpenPage}>Player page →</button>}
          <button className="btn btn-primary" onClick={onClose}>{final ? 'Back to the recap' : 'Back to the game'}</button>
        </div>
      )}
    </Sheet>
  )
}
