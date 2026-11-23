import { useId, useState } from 'react'

export type HelpTopic = 'pot' | 'sta' | 'energy' | 'tiers' | 'need'

const TIERS: [string, string][] = [
  ['#b0733a', 'bronze <70'], ['#c4ccd8', 'silver 70–75'], ['#ffc83d', 'gold 76–80'],
  ['#a45bff', 'purple 81–85'], ['#7fe7ff', 'diamond 86–94'], ['linear-gradient(135deg,#ff3b3b,#ffe14d,#3ddc84,#2bb8ff,#e04bff)', 'prismatic 95+'],
]

const TEXT: Record<HelpTopic, React.ReactNode> = {
  pot: <><b>POT</b> potential: the OVR he could grow into. Green when he has real room to grow.</>,
  sta: <><b>STA</b> stamina: how long he can play before tiring. 🔋 = within his comfort zone, 🥵 = past it, he’ll fade late.</>,
  energy: <><b>⚡</b> energy left (0–100) at this break. Red means tired: he shoots, handles and defends worse.</>,
  tiers: (
    <><b>Card rings</b> show OVR:{' '}
      {TIERS.map(([c, t]) => <span key={t} className="help-tier"><i style={{ background: c }} />{t}</span>)}
    </>
  ),
  need: (
    <><b>Dots</b> your need at that position: <i className="need-dot need-red" /> urgent, <i className="need-dot need-yellow" /> could use help,{' '}
      <i className="need-dot need-green" /> solid. <i className="need-dot need-red" /> → <i className="need-dot need-yellow" /> is how this move would change it.</>
  ),
}

/** A small "?" that opens a short explainer of the jargon on this screen (tap to toggle, not a hover tooltip). */
export function Help({ topics, label = 'What do these mean?' }: { topics: HelpTopic[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const [shift, setShift] = useState(0)
  const id = useId()
  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Line the box up under the button, nudged so it never runs off either edge of the screen.
    const r = e.currentTarget.getBoundingClientRect()
    const w = Math.min(300, window.innerWidth - 32)
    setShift(Math.max(16, Math.min(r.left, window.innerWidth - 16 - w)) - r.left)
    setOpen((o) => !o)
  }
  return (
    <span className="help">
      <button type="button" className="help-btn" aria-expanded={open} aria-controls={id} aria-label={label} onClick={toggle}>?</button>
      {open && (
        <span id={id} className="help-pop" style={{ left: shift }} role="note">
          {topics.map((t) => <span key={t} className="help-line">{TEXT[t]}</span>)}
        </span>
      )}
    </span>
  )
}
