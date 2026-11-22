import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { listSaves } from '../save/db'
import { FaceGallery } from './FaceGallery'
import { Shell } from './layout/Shell'
import { Home } from './screens/Home'
import { NewLeague } from './screens/NewLeague'
import { Saves } from './screens/Saves'
import { useStore } from './store'
import './theme.css'

function Placeholder({ title }: { title: string }) {
  return <div className="panel"><h2>{title}</h2><p className="muted">Coming up next.</p></div>
}

function RequireLeague({ children }: { children: React.ReactNode }) {
  const league = useStore((s) => s.league)
  const loc = useLocation()
  if (!league) return <Navigate to="/new" replace state={{ from: loc.pathname }} />
  return <>{children}</>
}

export const SCREENS: Record<string, React.ReactNode> = {}

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
          <Route path="/my-team" element={guarded(SCREENS.myTeam ?? <Placeholder title="My Team" />)} />
          <Route path="/team/:id" element={guarded(SCREENS.team ?? <Placeholder title="Team" />)} />
          <Route path="/teams" element={guarded(SCREENS.teams ?? <Placeholder title="Teams" />)} />
          <Route path="/player/:id" element={guarded(SCREENS.player ?? <Placeholder title="Player" />)} />
          <Route path="/schedule" element={guarded(SCREENS.schedule ?? <Placeholder title="Schedule" />)} />
          <Route path="/game/:id" element={guarded(SCREENS.game ?? <Placeholder title="Box score" />)} />
          <Route path="/standings" element={guarded(SCREENS.standings ?? <Placeholder title="Standings" />)} />
          <Route path="/playoffs" element={guarded(SCREENS.playoffs ?? <Placeholder title="Playoffs" />)} />
          <Route path="/leaders" element={guarded(SCREENS.leaders ?? <Placeholder title="Leaders" />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
