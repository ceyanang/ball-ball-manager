import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { lastOpenedSave, listSaves } from '../save/db'
import { FaceGallery } from './FaceGallery'
import { Shell } from './layout/Shell'
import { BoxScore } from './screens/BoxScore'
import { Home } from './screens/Home'
import { Leaders } from './screens/Leaders'
import { Playoffs } from './screens/Playoffs'
import { Schedule } from './screens/Schedule'
import { Standings } from './screens/Standings'
import { MyTeam } from './screens/MyTeam'
import { Roster } from './screens/Roster'
import { PlayerPage } from './screens/PlayerPage'
import { TeamPage } from './screens/TeamPage'
import { TeamsBrowser } from './screens/TeamsBrowser'
import { NewLeague } from './screens/NewLeague'
import { Saves } from './screens/Saves'
import { FrontOffice } from './screens/FrontOffice'
import { Trade } from './screens/Trade'
import { TradeFinder } from './screens/TradeFinder'
import { FreeAgents } from './screens/FreeAgents'
import { Draft } from './screens/Draft'
import { Offseason } from './screens/Offseason'
import { Inbox } from './screens/Inbox'
import { Highlights } from './screens/Highlights'
import { AllStar } from './screens/AllStar'
import { Social } from './screens/Social'
import { History } from './screens/History'
import { EventLog } from './screens/EventLog'
import { Builder } from './screens/career/Builder'
import { Ending } from './screens/career/Ending'
import { RetirementPrompt } from './screens/career/RetirementPrompt'
import { ContractChoice } from './screens/career/ContractChoice'
import { Moment } from './screens/career/Moment'
import { DraftNight } from './screens/career/DraftNight'
import { isCareer } from '../engine/career/state'
import { CareerAlert } from './screens/career/CareerAlert'
import { EventModal } from './components/EventModal'
import { useStore } from './store'
import './theme.css'

function RequireLeague({ children }: { children: React.ReactNode }) {
  const league = useStore((s) => s.league)
  const loc = useLocation()
  if (!league) return <Navigate to="/new" replace state={{ from: loc.pathname }} />
  // MyCareer: until draft night is done there is no team to show, so every league screen leads back to it.
  if (league.career?.status === 'draftNight' && loc.pathname !== '/career/draft') return <Navigate to="/career/draft" replace />
  // A finished career opens on its epilogue (everything else stays viewable).
  if (league.career?.status === 'retired' && league.career.ending && loc.pathname === '/') return <Navigate to="/career/ending" replace />
  return <>{children}</>
}

/** MyCareer follows one player, so the GM-only screens aren't part of it. */
function GmOnly({ children }: { children: React.ReactNode }) {
  const league = useStore((s) => s.league)
  if (league && isCareer(league)) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const load = useStore((s) => s.load)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    listSaves()
      .then(async (s) => {
        const last = lastOpenedSave()
        const pick = s.find((m) => m.id === last) ?? s[0]
        if (pick) await load(pick.id)
      })
      .finally(() => setReady(true))
  }, [load])
  if (!ready) return null
  const guarded = (el: React.ReactNode) => <RequireLeague>{el}</RequireLeague>
  const gm = (el: React.ReactNode) => <RequireLeague><GmOnly>{el}</GmOnly></RequireLeague>
  return (
    <HashRouter>
      <EventModal />
      <Moment />
      <CareerAlert />
      <ContractChoice />
      <RetirementPrompt />
      <Routes>
        <Route path="/dev/faces" element={<FaceGallery />} />
        <Route element={<Shell />}>
          <Route path="/" element={guarded(<Home />)} />
          <Route path="/new" element={<NewLeague />} />
          <Route path="/saves" element={<Saves />} />
          <Route path="/career/build" element={<Builder />} />
          <Route path="/career/draft" element={guarded(<DraftNight />)} />
          <Route path="/career/ending" element={guarded(<Ending />)} />
          <Route path="/my-team" element={guarded(<MyTeam />)} />
          <Route path="/roster" element={guarded(<Roster />)} />
          <Route path="/team/:id" element={guarded(<TeamPage />)} />
          <Route path="/teams" element={guarded(<TeamsBrowser />)} />
          <Route path="/player/:id" element={guarded(<PlayerPage />)} />
          <Route path="/schedule" element={guarded(<Schedule />)} />
          <Route path="/game/:id" element={guarded(<BoxScore />)} />
          <Route path="/standings" element={guarded(<Standings />)} />
          <Route path="/playoffs" element={guarded(<Playoffs />)} />
          <Route path="/leaders" element={guarded(<Leaders />)} />
          <Route path="/office" element={gm(<FrontOffice />)} />
          <Route path="/trade" element={gm(<Trade />)} />
          <Route path="/trade-finder" element={gm(<TradeFinder />)} />
          <Route path="/free-agents" element={gm(<FreeAgents />)} />
          <Route path="/draft" element={gm(<Draft />)} />
          <Route path="/offseason" element={gm(<Offseason />)} />
          <Route path="/inbox" element={guarded(<Inbox />)} />
          <Route path="/highlights" element={guarded(<Highlights />)} />
          <Route path="/all-star" element={guarded(<AllStar />)} />
          <Route path="/social" element={guarded(<Social />)} />
          <Route path="/history" element={guarded(<History />)} />
          <Route path="/events" element={guarded(<EventLog />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
