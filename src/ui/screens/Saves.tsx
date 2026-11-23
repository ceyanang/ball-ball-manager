import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { exportSave, listSaves, type SaveMeta } from '../../save/db'
import { useStore } from '../store'
import { SoundPanel } from '../components/SoundPanel'

export function Saves() {
  const [saves, setSaves] = useState<SaveMeta[]>([])
  const { saveId, league, load, remove, importFile, busy } = useStore()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const refresh = () => listSaves().then(setSaves)
  useEffect(() => { void refresh() }, [saveId, league])

  const download = () => {
    if (!league) return
    const url = URL.createObjectURL(exportSave(league))
    const a = document.createElement('a')
    a.href = url
    a.download = `${league.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-season-${league.season}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="stack">
      <h1>Saves</h1>
      <SoundPanel />
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-primary" disabled={busy} onClick={() => navigate('/new')}>New league</button>
        <button className="btn" disabled={!league} onClick={download}>Export current league</button>
        <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>Import a save file</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) { await importFile(f); await refresh() }
        }} />
      </div>
      {busy && <div className="notice">A sim is running. Loading, importing and deleting are paused until it finishes.</div>}
      <div className="panel table-wrap">
        <table className="stats">
          <thead><tr><th>League</th><th className="left">Team</th><th>Season</th><th>Last played</th><th></th></tr></thead>
          <tbody>
            {saves.map((s) => (
              <tr key={s.id} className={s.id === saveId ? 'me' : ''}>
                <td>{s.name}</td>
                <td className="left">{s.teamName}</td>
                <td>{s.season}</td>
                <td>{new Date(s.updatedAt).toLocaleString()}</td>
                <td>
                  <div className="row" style={{ justifyContent: 'flex-end', gap: '0.4rem' }}>
                    <button className="btn" disabled={s.id === saveId || busy} onClick={async () => { await load(s.id); navigate('/') }}>{s.id === saveId ? 'Playing' : 'Load'}</button>
                    <button className="btn btn-danger" disabled={busy} onClick={async () => {
                      if (confirm(`Delete “${s.name}”? This can’t be undone.`)) { await remove(s.id); await refresh() }
                    }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {!saves.length && <tr><td colSpan={5} className="muted">No saves yet. Start a new league to create one.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
