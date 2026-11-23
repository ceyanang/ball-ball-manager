import { setSettings, useAudioSettings } from '../../audio/settings'

/** Music and effects volume plus a mute toggle. */
export function SoundPanel() {
  const s = useAudioSettings()
  return (
    <div className="panel stack">
      <h2>Sound</h2>
      <label className="row">
        <span style={{ minWidth: 110 }}>Music</span>
        <input type="range" min={0} max={1} step={0.05} value={s.music} onChange={(e) => setSettings({ music: Number(e.target.value) })} />
      </label>
      <label className="row">
        <span style={{ minWidth: 110 }}>Sound effects</span>
        <input type="range" min={0} max={1} step={0.05} value={s.sfx} onChange={(e) => setSettings({ sfx: Number(e.target.value) })} />
      </label>
      <button className="btn" aria-pressed={s.muted} onClick={() => setSettings({ muted: !s.muted })}>{s.muted ? '🔇 Muted' : '🔊 Sound on'}</button>
    </div>
  )
}
