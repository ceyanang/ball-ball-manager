import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { listSaves } from '../save/db'
import { FaceGallery } from './FaceGallery'
import { Shell } from './layout/Shell'
import { BoxScore } from './screens/BoxScore'
import { Home } from './screens/Home'
import { Leaders } from './screens/Leaders'
import { Playoffs } from './screens/Playoffs'
import { Schedule } from './screens/Schedule'
import { Standings } from './screens/Standings'
import { MyTeam } from './screens/MyTeam'
import { PlayerPage } from './screens/PlayerPage'
import { TeamPage } from './screens/TeamPage'
import { TeamsBrowser } from './screens/TeamsBrowser'
import { NewLeague } from './screens/NewLeague'
import { Saves } from './screens/Saves'
import { FrontOffice } from './screens/FrontOffice'
import { Trade } from './screens/Trade'
import { FreeAgents } from './screens/FreeAgents'
import { Draft } from './screens/Draft'
import { Offseason } from './screens/Offseason'
import { useStore } from './store'
import './theme.css'

function RequireLeague({ children }: { children: React.ReactNode }) {
  const league = useStore((s) => s.league)
  const loc = useLocation()
  if (!league) return <Navigate to="/new" replace state={{ from: loc.pathname }} />
  return <>{children}</>
}

export default function App() {
  const load = useStore((s) => s.load)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    listSaves()
      .then(async (s) => { if (s.length) await load(s[0].id) })
      .finally(() => setReady(true))
  }, [load])
  if (!ready) return null
  const guarded = (el: React.ReactNode) => <RequireLeague>{el}</RequireLeague>
  return (
    <HashRouter>
      <Routes>
        <Route path="/dev/faces" element={<FaceGallery />} />
        <Route element={<Shell />}>
          <Route path="/" element={guarded(<Home />)} />
          <Route path="/new" element={<NewLeague />} />
          <Route path="/saves" element={<Saves />} />
          <Route path="/my-team" element={guarded(<MyTeam />)} />
          <Route path="/team/:id" element={guarded(<TeamPage />)} />
          <Route path="/teams" element={guarded(<TeamsBrowser />)} />
          <Route path="/player/:id" element={guarded(<PlayerPage />)} />
          <Route path="/schedule" element={guarded(<Schedule />)} />
          <Route path="/game/:id" element={guarded(<BoxScore />)} />
          <Route path="/standings" element={guarded(<Standings />)} />
          <Route path="/playoffs" element={guarded(<Playoffs />)} />
          <Route path="/leaders" element={guarded(<Leaders />)} />
          <Route path="/office" element={guarded(<FrontOffice />)} />
          <Route path="/trade" element={guarded(<Trade />)} />
          <Route path="/free-agents" element={guarded(<FreeAgents />)} />
          <Route path="/draft" element={guarded(<Draft />)} />
          <Route path="/offseason" element={guarded(<Offseason />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
