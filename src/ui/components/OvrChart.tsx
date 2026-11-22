import { useState } from 'react'

/** Single-series OVR-by-season line. Title names the series, so no legend. */
export function OvrChart({ points }: { points: { label: string; ovr: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 520, H = 180, P = { l: 34, r: 16, t: 14, b: 26 }
  const min = Math.max(0, Math.min(...points.map((p) => p.ovr)) - 8)
  const max = Math.min(99, Math.max(...points.map((p) => p.ovr)) + 8)
  const n = points.length
  const x = (i: number) => (n === 1 ? (P.l + W - P.r) / 2 : P.l + (i * (W - P.l - P.r)) / (n - 1))
  const y = (v: number) => P.t + ((max - v) * (H - P.t - P.b)) / (max - min || 1)
  const ticks = [min, Math.round((min + max) / 2), max]
  return (
    <figure style={{ margin: 0, maxWidth: 640 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Overall by season: ${points.map((p) => `${p.label} ${p.ovr}`).join(', ')}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--ink-2)">{t}</text>
          </g>
        ))}
        {n > 1 && <polyline points={points.map((p, i) => `${x(i)},${y(p.ovr)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />}
        {points.map((p, i) => (
          <g key={p.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <circle cx={x(i)} cy={y(p.ovr)} r={14} fill="transparent" />
            <circle cx={x(i)} cy={y(p.ovr)} r={hover === i ? 6 : 4.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--ink-2)">{p.label}</text>
          </g>
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <rect x={x(hover) - 34} y={y(points[hover].ovr) - 34} width={68} height={22} rx={5} fill="var(--ink)" />
            <text x={x(hover)} y={y(points[hover].ovr) - 19} textAnchor="middle" fontSize={12} fill="var(--surface)" fontWeight={700}>OVR {points[hover].ovr}</text>
          </g>
        )}
      </svg>
    </figure>
  )
}
