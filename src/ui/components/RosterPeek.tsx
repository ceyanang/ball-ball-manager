import type { League } from '../../engine/types'
import { useStore } from '../store'
import { rosterOf, teamFull } from '../util'
import { RosterTable } from './RosterTable'
import { Sheet } from './Sheet'

interface PeekProps { open: boolean; onClose: () => void; teamId: string }

/** Pure view: a team's roster and full stats in a bottom sheet. Renders nothing for an unknown team. */
export function RosterPeekView({ league, open, onClose, teamId }: PeekProps & { league: League }) {
  const team = Object.hasOwn(league.teams, teamId) ? league.teams[teamId] : null
  if (!team) return null
  return (
    <Sheet open={open} onClose={onClose} title={teamFull(team)} wide>
      {open && <RosterTable league={league} team={team} players={rosterOf(league, team.id)} />}
    </Sheet>
  )
}

/** Roster stats sheet openable over any screen (e.g. mid-trade) without leaving it. */
export function RosterPeek(props: PeekProps) {
  const league = useStore((s) => s.league)
  return league ? <RosterPeekView league={league} {...props} /> : null
}
