import type { FaceSpec } from '../../engine/face/face'

/** All parts draw in a 100×120 viewBox. Head spans x 22–78, y 18–87. */
export const OUTLINE = '#1f1a24'
const sw = 1.4

export const HEADS = [
  'M50,19 C68,19 77,33 77,52 C77,72 66,86 50,86 C34,86 23,72 23,52 C23,33 32,19 50,19 Z',
  'M50,20 C70,20 79,34 79,52 C79,71 67,84 50,84 C33,84 21,71 21,52 C21,34 30,20 50,20 Z',
  'M32,19 L68,19 Q77,19 77,30 L77,66 Q77,86 50,86 Q23,86 23,66 L23,30 Q23,19 32,19 Z',
  'M50,17 C66,17 75,31 75,52 C75,75 64,88 50,88 C36,88 25,75 25,52 C25,31 34,17 50,17 Z',
  'M24,40 Q24,18 50,18 Q76,18 76,40 L76,62 Q74,85 50,86 Q26,85 24,62 Z',
  'M23,44 Q23,18 50,18 Q77,18 77,44 Q77,70 50,87 Q23,70 23,44 Z',
  'M30,19 L70,19 Q80,19 79,32 L77,62 Q75,86 50,87 Q25,86 23,62 L21,32 Q20,19 30,19 Z',
  'M50,18 C72,18 80,36 78,54 C76,74 64,87 50,87 C36,87 24,74 22,54 C20,36 28,18 50,18 Z',
]

export function Ears({ v, skin }: { v: number; skin: string }) {
  const r = [5, 6.5, 4.2][v]
  return (
    <g fill={skin} stroke={OUTLINE} strokeWidth={sw}>
      <ellipse cx={23} cy={54} rx={r} ry={r * 1.5} />
      <ellipse cx={77} cy={54} rx={r} ry={r * 1.5} />
    </g>
  )
}

export function Eyes({ v, color }: { v: number; color: string }) {
  const pair = (draw: (x: number) => React.ReactNode) => <g>{draw(39)}{draw(61)}</g>
  const white = (x: number, rx: number, ry: number) => (
    <ellipse cx={x} cy={51} rx={rx} ry={ry} fill="#fff" stroke={OUTLINE} strokeWidth={1} />
  )
  const iris = (x: number, r: number, dy = 0) => <circle cx={x} cy={51 + dy} r={r} fill={color} />
  const pupil = (x: number, r: number, dy = 0) => <circle cx={x} cy={51 + dy} r={r} fill={OUTLINE} />
  switch (v) {
    case 0: return pair((x) => <g>{white(x, 4.5, 3.2)}{iris(x, 2.4)}{pupil(x, 1.1)}</g>)
    case 1: return pair((x) => <g>{pupil(x, 2)}</g>)
    case 2: return pair((x) => <g>{white(x, 5, 3.4)}{iris(x, 2.5, 0.6)}{pupil(x, 1.1, 0.6)}<path d={`M${x - 5.5},49.5 Q${x},46.5 ${x + 5.5},49.5`} fill="none" stroke={OUTLINE} strokeWidth={1.6} /></g>)
    case 3: return pair((x) => <g>{white(x, 5, 2)}{iris(x, 1.8)}</g>)
    case 4: return pair((x) => <g>{white(x, 5, 4)}{iris(x, 2.8)}{pupil(x, 1.3)}<circle cx={x + 1} cy={50} r={0.7} fill="#fff" /></g>)
    case 5: return pair((x) => <g><path d={`M${x - 5},51 Q${x},46.5 ${x + 5},51 Q${x},54 ${x - 5},51 Z`} fill="#fff" stroke={OUTLINE} strokeWidth={1} />{iris(x, 2.1)}{pupil(x, 1)}</g>)
    case 6: return pair((x) => <path d={`M${x - 4.5},52 Q${x},47.5 ${x + 4.5},52`} fill="none" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" />)
    case 8: case 9: case 10: {
      // Soft almond shapes. 8: slightly narrower, gently upturned outer corner. 9: narrower still with a calm lid. 10: softly downturned.
      const up = v === 10 ? -1 : 1
      const hgt = v === 9 ? 0.9 : 1.2
      return pair((x) => {
        const s = x < 50 ? -1 : 1 // outward direction
        const ox = x + 5.2 * s, ix = x - 5.2 * s
        const oy = 51 - 1.1 * up, iy = 51 + 0.7 * up
        const top = 51 - 3.1 * hgt, bot = 51 + 2.7 * hgt
        return (
          <g>
            <path d={`M${ix},${iy} Q${x},${top} ${ox},${oy} Q${x},${bot} ${ix},${iy} Z`} fill="#fff" stroke={OUTLINE} strokeWidth={1} strokeLinejoin="round" />
            {iris(x, 1.75, -0.2)}{pupil(x, 0.85, -0.2)}
            <path d={`M${ix - 0.4 * s},${iy - 0.4} Q${x},${top - 1.2} ${ox + 0.7 * s},${oy - 0.5}`} fill="none" stroke={OUTLINE} strokeWidth={1.1} strokeLinecap="round" />
          </g>
        )
      })
    }
    default: return (
      <g>
        <path d="M34,49.5 L44,51 Q39,55 34,52 Z" fill="#fff" stroke={OUTLINE} strokeWidth={1} />
        <path d="M66,49.5 L56,51 Q61,55 66,52 Z" fill="#fff" stroke={OUTLINE} strokeWidth={1} />
        <circle cx={39.5} cy={52} r={1.8} fill={color} />
        <circle cx={60.5} cy={52} r={1.8} fill={color} />
      </g>
    )
  }
}

export function Brows({ v, color }: { v: number; color: string }) {
  const s = { fill: 'none', stroke: color, strokeLinecap: 'round' as const }
  switch (v) {
    case 0: return <g {...s} strokeWidth={2.2}><path d="M33,44 L45,44" /><path d="M55,44 L67,44" /></g>
    case 1: return <g {...s} strokeWidth={2}><path d="M33,45 Q39,40 45,44" /><path d="M55,44 Q61,40 67,45" /></g>
    case 2: return <g {...s} strokeWidth={3.6}><path d="M33,44 Q39,42 45,43.5" /><path d="M55,43.5 Q61,42 67,44" /></g>
    case 3: return <g {...s} strokeWidth={1.2}><path d="M34,44 Q39,42 44,44" /><path d="M56,44 Q61,42 66,44" /></g>
    case 4: return <g {...s} strokeWidth={2.4}><path d="M33,42 L45,45.5" /><path d="M55,45.5 L67,42" /></g>
    case 5: return <g {...s} strokeWidth={2.8}><path d="M33,44 Q41,41 50,44 Q59,41 67,44" /></g>
    case 6: return <g {...s} strokeWidth={2.6}><path d="M33,46 L45,42" /><path d="M55,42 L67,46" /></g>
    default: return <g {...s} strokeWidth={3}><path d="M33,43 Q39,40 45,43" /><path d="M55,43 Q61,40 67,43" /><path d="M35,46 L43,46" strokeWidth={1} /></g>
  }
}

export function Nose({ v, skin }: { v: number; skin: string }) {
  const s = { fill: 'none', stroke: OUTLINE, strokeWidth: 1.3, strokeLinecap: 'round' as const }
  switch (v) {
    case 0: return <path {...s} d="M50,53 L47,63 Q50,65 53,63" />
    case 1: return <g {...s}><path d="M46,63 Q50,66 54,63" /><circle cx={47} cy={62.5} r={0.6} fill={OUTLINE} /><circle cx={53} cy={62.5} r={0.6} fill={OUTLINE} /></g>
    case 2: return <path d="M50,54 Q45,63 47,64 Q50,66 53,64 Q55,63 50,54 Z" fill={skin} stroke={OUTLINE} strokeWidth={1.1} opacity={0.9} />
    case 3: return <path {...s} d="M44,63 Q47,58 50,60 Q53,58 56,63 Q50,67 44,63" />
    case 4: return <path {...s} d="M51,52 Q53,60 49,64" />
    case 5: return <ellipse cx={50} cy={62} rx={4} ry={2.6} fill="none" stroke={OUTLINE} strokeWidth={1.2} />
    case 6: return <g {...s}><path d="M48,54 L46,62" /><path d="M43,62 Q50,68 57,62" /></g>
    case 7: return <path {...s} d="M45,64 Q50,60 55,64" />
    case 9: return <g {...s}><path d="M47,63.5 Q50,66 53,63.5" /><circle cx={50} cy={61.5} r={3} fill="none" opacity={0.7} /></g>
    case 10: return <g {...s}><path d="M44.5,63 Q47,60 50,62 Q53,60 55.5,63" /><path d="M46,64.5 Q50,66.5 54,64.5" /></g>
    default: return <g {...s}><path d="M50,54 L50,62" /><path d="M46,64 Q50,67 54,64" /></g>
  }
}

export function Mouth({ v }: { v: number }) {
  const s = { fill: 'none', stroke: OUTLINE, strokeWidth: 1.6, strokeLinecap: 'round' as const }
  switch (v) {
    case 0: return <path {...s} d="M42,71 Q50,77 58,71" />
    case 1: return <path {...s} d="M43,73 L57,73" />
    case 2: return <path {...s} d="M43,73 Q51,75 58,70" />
    case 3: return <path d="M41,70 Q50,80 59,70 Z" fill="#fff" stroke={OUTLINE} strokeWidth={1.4} strokeLinejoin="round" />
    case 4: return <path {...s} d="M43,74 Q50,70 57,74" />
    case 5: return <ellipse cx={50} cy={73} rx={2.6} ry={2} fill="#6b2d2d" stroke={OUTLINE} strokeWidth={1.1} />
    case 6: return <g><path d="M40,70 Q50,81 60,70 Q50,73 40,70 Z" fill="#7a2e2e" stroke={OUTLINE} strokeWidth={1.3} /><path d="M42,71 Q50,73.5 58,71 L57,73 Q50,75 43,73 Z" fill="#fff" /></g>
    case 7: return <path {...s} d="M44,73 Q50,75.5 56,73" />
    case 8: return <g><path {...s} d="M42,72 Q50,78 58,72" /><path {...s} d="M58,72 L60,70" /></g>
    case 10: return <path d="M41,71.5 Q50,68.5 59,71.5 Q50,79.5 41,71.5 Z" fill="#8e4a45" fillOpacity={0.55} stroke={OUTLINE} strokeWidth={1.3} strokeLinejoin="round" />
    case 11: return <path {...s} d="M43,73 Q50,75 57,72.5" strokeWidth={1.4} />
    default: return <g><path d="M42,71 Q50,79 58,71 Z" fill="#fff" stroke={OUTLINE} strokeWidth={1.3} strokeLinejoin="round" /><path d="M46,75 L54,75" stroke={OUTLINE} strokeWidth={0.8} /></g>
  }
}

/** Squared-off cap that follows a flat-topped head: corners reach out past the head outline so no skin shows at the temples. */
const sqCap = (top: number, lift = 0) =>
  `M22,46 L21,${31 - lift} Q21,${16 - lift} 34,${16 - lift} L66,${16 - lift} Q79,${16 - lift} 79,${31 - lift} L78,46 Q72,${30 + top} 50,${29 + top} Q28,${30 + top} 22,46 Z`

/** Hair path set; index 0 = bald. Fill with hair color. */
export function Hair({ v, color, recede }: { v: number; color: string; recede: number }) {
  if (v === 0) return null
  const f = { fill: color, stroke: OUTLINE, strokeWidth: 1.2, strokeLinejoin: 'round' as const }
  if (recede > 0.8) {
    return (
      <g {...f}>
        <path d="M23,46 Q22,34 28,28 L30,44 Z" />
        <path d="M77,46 Q78,34 72,28 L70,44 Z" />
      </g>
    )
  }
  const top = recede > 0 ? recede * 7 : 0 // hairline creeps up
  const P: Record<number, React.ReactNode> = {
    1: <path d={`M24,42 Q22,18 50,16 Q78,18 76,42 Q70,${30 + top} 50,${29 + top} Q30,${30 + top} 24,42 Z`} opacity={0.85} />,
    2: <path d={`M23,44 Q20,14 50,13 Q80,14 77,44 Q74,${31 + top} 60,${29 + top} Q50,${26 + top} 40,${29 + top} Q26,${31 + top} 23,44 Z`} />,
    3: <path d={`M24,38 L24,10 L76,10 L76,38 Q70,${28 + top} 50,${28 + top} Q30,${28 + top} 24,38 Z`} />,
    4: <path d={`M20,48 Q12,26 26,15 Q38,5 50,6 Q62,5 74,15 Q88,26 80,48 Q76,${32 + top} 50,${30 + top} Q24,${32 + top} 20,48 Z`} />,
    5: <path d={`M16,54 Q4,28 22,10 Q36,-2 50,-1 Q64,-2 78,10 Q96,28 84,54 Q78,${32 + top} 50,${30 + top} Q22,${32 + top} 16,54 Z`} />,
    6: <g><path d={`M23,44 Q20,16 50,14 Q80,16 77,44 Q72,${30 + top} 50,${29 + top} Q28,${30 + top} 23,44 Z`} />{[30, 38, 46, 54, 62, 70].map((x) => <circle key={x} cx={x} cy={18 + (x % 3)} r={4.5} />)}</g>,
    7: <g><path d={`M24,42 Q22,17 50,15 Q78,17 76,42 Q70,${30 + top} 50,${29 + top} Q30,${30 + top} 24,42 Z`} /><path d="M30,24 Q40,20 50,24 Q60,20 70,24" fill="none" stroke={OUTLINE} strokeWidth={0.8} opacity={0.5} /></g>,
    8: <g><path d={`M24,42 Q22,16 50,15 Q78,16 76,42 Q70,${30 + top} 50,${29 + top} Q30,${30 + top} 24,42 Z`} />{[36, 43, 50, 57, 64].map((x) => <path key={x} d={`M${x},17 L${x},31`} stroke={OUTLINE} strokeWidth={0.7} opacity={0.6} />)}</g>,
    9: <path d={`M42,${32 + top} Q42,8 50,2 Q58,8 58,${32 + top} Z`} />,
    10: <g><path d={`M24,42 Q22,17 50,15 Q78,17 76,42 Q70,${30 + top} 50,${29 + top} Q30,${30 + top} 24,42 Z`} /><circle cx={50} cy={10} r={7} /></g>,
    11: <g><path d={`M22,62 Q16,20 50,14 Q84,20 78,62 L74,62 Q74,${34 + top} 50,${30 + top} Q26,${34 + top} 26,62 Z`} /></g>,
    12: <g><path d={`M24,42 Q22,16 50,14 Q78,16 76,42 Q70,${30 + top} 50,${29 + top} Q30,${30 + top} 24,42 Z`} />{[26, 33, 40, 60, 67, 74].map((x) => <rect key={x} x={x - 2} y={28} width={4} height={14} rx={2} />)}</g>,
    13: <g>{[22, 28, 34, 66, 72, 78].map((x) => <rect key={x} x={x - 2.5} y={24} width={5} height={52} rx={2.5} />)}<path d={`M23,44 Q20,14 50,13 Q80,14 77,44 Q72,${30 + top} 50,${29 + top} Q28,${30 + top} 23,44 Z`} /></g>,
    14: <path d={`M23,46 Q20,14 52,13 Q80,15 77,42 Q66,${26 + top} 42,${30 + top} Q30,${34 + top} 23,46 Z`} />,
    15: <path d={`M24,42 L22,22 L30,26 L33,12 L40,22 L46,8 L52,20 L60,9 L64,22 L71,13 L72,27 L78,23 L76,42 Q70,${30 + top} 50,${29 + top} Q30,${30 + top} 24,42 Z`} />,
    16: <path d={`M26,40 L26,4 Q50,-2 74,4 L74,40 Q70,${28 + top} 50,${28 + top} Q30,${28 + top} 26,40 Z`} />,
    18: <g><path d={`M24,42 Q22,17 50,15 Q78,17 76,42 Q70,${30 + top} 50,${29 + top} Q30,${30 + top} 24,42 Z`} /><circle cx={50} cy={6} r={9} /><rect x={44} y={12} width={12} height={4} rx={2} /></g>,
    19: <g><path d={`M20,86 Q12,24 50,13 Q88,24 80,86 L72,86 Q74,${34 + top} 50,${30 + top} Q26,${34 + top} 28,86 Z`} /></g>,
    20: <g><path d={`M23,44 Q20,14 50,13 Q80,14 77,44 Q72,${30 + top} 50,${29 + top} Q28,${30 + top} 23,44 Z`} />{[26, 36, 46, 56, 66, 74].map((x, i) => <path key={x} d={`M${x},${22 + (i % 2) * 2} Q${x + 3},34 ${x - 1},${42 + (i % 3) * 3}`} fill="none" stroke={OUTLINE} strokeWidth={1.2} />)}</g>,
    21: <g><path d={`M24,42 Q22,18 50,16 Q78,18 76,42 Q70,${30 + top} 50,${29 + top} Q30,${30 + top} 24,42 Z`} /><path d={`M30,27 Q55,22 74,32`} fill="none" stroke={OUTLINE} strokeWidth={1} /><path d={`M24,42 L24,52 L28,48 Z M76,42 L76,52 L72,48 Z`} /></g>,
    22: <path d={`M22,52 Q16,16 50,13 Q84,16 78,52 L73,46 L73,37 Q50,${33 + top} 27,37 L27,46 Z`} />,
    23: <g><path d={`M23,50 Q19,14 50,13 Q81,14 77,50 Q73,34 57,${28 + top} L50,${34 + top} L43,${28 + top} Q27,34 23,50 Z`} /><path d={`M50,14 L50,${33 + top}`} stroke={OUTLINE} strokeWidth={0.8} opacity={0.5} /></g>,
    24: <g><path d={`M29,40 Q27,10 50,8 Q73,10 71,40 Q64,${26 + top} 50,${25 + top} Q36,${26 + top} 29,40 Z`} /><path d={`M23,44 Q22,32 26,28 L28,42 Z M77,44 Q78,32 74,28 L72,42 Z`} opacity={0.65} /></g>,
    25: <path d={`M24,42 Q22,16 50,14 Q78,16 76,42 Q74,${34 + top} 68,${35 + top} L64,${29 + top} L58,${36 + top} L52,${29 + top} L46,${36 + top} L40,${29 + top} L34,${36 + top} L30,${31 + top} Q26,${35 + top} 24,42 Z`} />,
    26: <g><path d={`M24,44 Q21,15 50,13 Q79,15 76,44 Q72,32 50,${27 + top} Q28,32 24,44 Z`} /><path d="M34,21 Q50,16 66,22 M30,27 Q50,21 70,28" fill="none" stroke={OUTLINE} strokeWidth={0.8} opacity={0.5} /></g>,
    27: <path d={`M25,44 L22,13 L33,4 L67,4 L78,13 L75,44 Q70,${28 + top} 50,${28 + top} Q30,${28 + top} 25,44 Z`} />,
    28: <g><path d={`M24,42 Q22,18 50,16 Q78,18 76,42 Q70,${30 + top} 50,${29 + top} Q30,${30 + top} 24,42 Z`} />{[26, 31, 36].map((y, i) => <path key={y} d={`M${29 - i},${y} Q50,${y - 8} ${71 + i},${y}`} fill="none" stroke={OUTLINE} strokeWidth={0.8} opacity={0.5} />)}</g>,
    29: <g><path d={`M24,42 Q22,18 50,16 Q78,18 76,42 Q70,${30 + top} 50,${29 + top} Q30,${30 + top} 24,42 Z`} />{[30, 38, 46, 54, 62, 70].map((x, i) => <rect key={x} x={x - 2.4} y={9 + (i % 2) * 3} width={4.8} height={13} rx={2.4} />)}</g>,
    30: <g><path d={`M28,38 Q27,26 32,22 L68,22 Q73,26 72,38 Q64,${28 + top} 50,${28 + top} Q36,${28 + top} 28,38 Z`} />{[34, 42, 50, 58, 66].map((x, i) => <circle key={x} cx={x} cy={17 + (i % 2) * 2} r={5.5} />)}</g>,
    31: <path d={`M24,44 Q19,17 40,8 Q60,-2 80,16 Q83,30 76,44 Q70,${30 + top} 56,${28 + top} Q40,${26 + top} 24,44 Z`} />,
    32: <g><path d={`M24,44 Q22,16 50,14 Q80,16 76,44 Q72,30 58,${27 + top} Q46,${26 + top} 40,${30 + top} L34,${36 + top} Q28,36 24,44 Z`} /><path d={`M38,17 L41,${29 + top}`} stroke={OUTLINE} strokeWidth={0.9} opacity={0.6} /></g>,
    33: <g><path d={`M22,70 Q16,20 50,14 Q84,20 78,70 L72,70 Q74,34 50,${30 + top} Q26,34 28,70 Z`} /><circle cx={50} cy={8} r={7} /></g>,
    34: <g><path d={`M26,40 Q24,22 50,19 Q76,22 74,40 Q66,${29 + top} 50,${28 + top} Q34,${29 + top} 26,40 Z`} />{[28, 35, 42, 50, 58, 65, 72].map((x, i) => <circle key={x} cx={x} cy={20 + (i % 2) * 2 - (i === 3 ? 3 : 0)} r={5} />)}</g>,
    35: <path d={`M20,88 Q10,24 50,13 Q90,24 80,88 Q74,78 76,66 L72,58 Q74,34 50,${30 + top} Q26,34 28,58 L24,66 Q26,78 20,88 Z`} />,
    // 36-45: styles drawn to hug the flat-topped square heads (HEADS[2], HEADS[6]); corners are filled so no skin shows at the temples.
    36: <path d={sqCap(top)} />,
    37: <g><path d={`M23,46 L21,22 Q21,7 34,6 L66,6 Q79,7 79,22 L77,46 Q71,${28 + top} 50,${27 + top} Q29,${28 + top} 23,46 Z`} /><path d="M23,46 L22,32 L27,32 L27,46 Z M77,46 L78,32 L73,32 L73,46 Z" fill={OUTLINE} opacity={0.3} stroke="none" /></g>,
    38: <path d={sqCap(top)} opacity={0.82} />,
    39: <g><path d={sqCap(top)} /><path d={`M36,16 Q38,${24 + top} 42,${29 + top}`} fill="none" stroke={OUTLINE} strokeWidth={0.9} opacity={0.6} /><path d={`M42,${29 + top} Q58,${22 + top} 78,${33 + top}`} fill="none" stroke={OUTLINE} strokeWidth={0.8} opacity={0.4} /></g>,
    40: <path d={`M21,46 L21,31 Q21,15 34,15 L66,15 Q79,15 79,31 L79,46 Q77,${34 + top} 71,${35 + top} L67,${29 + top} L60,${36 + top} L54,${29 + top} L47,${36 + top} L41,${29 + top} L34,${36 + top} L29,${31 + top} Q23,${35 + top} 21,46 Z`} />,
    41: <g><path d={sqCap(top, 3)} />{[27, 35, 43, 51, 59, 67, 74].map((x, i) => <circle key={x} cx={x} cy={14 + (i % 2) * 2} r={5.5} />)}{[[22, 26], [78, 26]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={5} />)}</g>,
    42: <g><path d={sqCap(top)} />{[24, 29, 34].map((y, i) => <path key={y} d={`M${24 - i},${y} Q50,${y - 9} ${76 + i},${y}`} fill="none" stroke={OUTLINE} strokeWidth={0.8} opacity={0.5} />)}</g>,
    43: <g><path d={sqCap(top)} /><path d="M32,20 Q50,15 68,21 M27,26 Q50,19 73,27" fill="none" stroke={OUTLINE} strokeWidth={0.8} opacity={0.5} /></g>,
    44: <g><path d={sqCap(top)} />{[28, 36, 44, 52, 60, 68, 76].map((x, i) => <rect key={x} x={x - 2.4} y={7 + (i % 2) * 3} width={4.8} height={14} rx={2.4} />)}</g>,
    45: <path d={`M21,52 L21,31 Q21,15 34,15 L66,15 Q79,15 79,31 L79,52 L74,46 L74,37 Q50,${34 + top} 26,37 L26,46 Z`} />,
    17: <g><path d={`M27,40 Q26,30 30,26 L30,${33 + top} Z`} opacity={0.8} /><path d={`M73,40 Q74,30 70,26 L70,${33 + top} Z`} opacity={0.8} /><path d={`M38,${31 + top} Q38,6 50,4 Q62,6 62,${31 + top} Z`} /></g>,
  }
  return <g {...f}>{P[v]}</g>
}

export function FacialHair({ v, color }: { v: number; color: string }) {
  if (v === 0) return null
  const f = { fill: color, stroke: 'none' }
  switch (v) {
    case 1: return <path d="M27,62 Q30,84 50,86 Q70,84 73,62 Q66,80 50,80 Q34,80 27,62 Z" fill={color} opacity={0.35} />
    case 2: return <path {...f} d="M41,68 Q50,64 59,68 Q57,70.5 50,69 Q43,70.5 41,68 Z" />
    case 3: return <path {...f} d="M44,77 Q50,75 56,77 L55,86 Q50,89 45,86 Z" />
    case 4: return <path {...f} d="M24,56 Q26,84 50,87 Q74,84 76,56 L73,56 Q70,80 50,82 Q30,80 27,56 Z" />
    case 5: return <path {...f} d="M24,52 Q24,88 50,90 Q76,88 76,52 L72,58 Q68,68 58,69 Q50,66 42,69 Q32,68 28,58 Z" />
    case 6: return <path {...f} d="M23,52 Q20,98 50,102 Q80,98 77,52 L72,58 Q68,68 58,69 Q50,66 42,69 Q32,68 28,58 Z" />
    case 7: return <path {...f} d="M48,76 L52,76 L51,80 L49,80 Z" />
    case 8: return <g {...f}><path d="M23,48 L28,48 L30,70 L24,66 Z" /><path d="M77,48 L72,48 L70,70 L76,66 Z" /></g>
    case 9: return <g {...f}><path d="M41,68 Q50,64 59,68 Q57,70.5 50,69 Q43,70.5 41,68 Z" /><path d="M45,77 Q50,75.5 55,77 L54,84 Q50,86 46,84 Z" /></g>
    case 10: return <path {...f} d="M41,67 Q50,63 59,67 L60,79 L57,79 L56,70 Q50,68 44,70 L43,79 L40,79 Z" />
    case 11: return <g {...f}><path d="M41,68 Q50,64 59,68 Q57,70.5 50,69 Q43,70.5 41,68 Z" /><path d="M47,77 L53,77 L52,81 L48,81 Z" /></g>
    case 12: return <g {...f}><path d="M38,70 Q50,66 62,70 L64,80 Q50,90 36,80 Z" /></g>
    default: return <g {...f}><path d="M23,50 L29,50 L31,72 L24,68 Z" /><path d="M77,50 L71,50 L69,72 L76,68 Z" /><path d="M41,68 Q50,64 59,68 Q57,70.5 50,69 Q43,70.5 41,68 Z" /></g>
  }
}

export function Accessory({ v, team }: { v: number; team: { primary: string; secondary: string } }) {
  switch (v) {
    case 1: return <rect x={21} y={31} width={58} height={6} rx={3} fill={team.secondary} stroke={OUTLINE} strokeWidth={1} />
    case 2: return <g><path d="M24,47 L76,47" stroke={OUTLINE} strokeWidth={2} /><rect x={31} y={44} width={16} height={11} rx={5} fill="#9fd3ff" fillOpacity={0.45} stroke={OUTLINE} strokeWidth={1.6} /><rect x={53} y={44} width={16} height={11} rx={5} fill="#9fd3ff" fillOpacity={0.45} stroke={OUTLINE} strokeWidth={1.6} /></g>
    case 3: return <circle cx={21} cy={62} r={1.8} fill="#ffd84a" stroke={OUTLINE} strokeWidth={0.6} />
    case 4: return <g fill="none" stroke={OUTLINE} strokeWidth={1.4}><circle cx={39} cy={51} r={6} /><circle cx={61} cy={51} r={6} /><path d="M45,51 L55,51" /></g>
    case 5: return <g fill="none" stroke={OUTLINE} strokeWidth={1.6}><rect x={32} y={46.5} width={14} height={9} rx={1.5} /><rect x={54} y={46.5} width={14} height={9} rx={1.5} /><path d="M46,50 L54,50" /></g>
    case 6: return <rect x={21} y={30} width={58} height={3.4} rx={1.7} fill={team.primary} stroke={OUTLINE} strokeWidth={0.8} />
    case 7: return <rect x={46} y={57} width={8} height={3.2} rx={1.2} fill="#f4efe6" stroke={OUTLINE} strokeWidth={0.6} />
    case 8: return <path d="M26,40 Q50,30 74,40 L76,62 Q74,72 66,72 L62,58 Q50,54 38,58 L34,72 Q26,72 24,62 Z" fill="#cfe6ff" fillOpacity={0.35} stroke={OUTLINE} strokeWidth={1} />
    case 9: return <g fill="#e8f6ff" stroke={OUTLINE} strokeWidth={0.6}><circle cx={21} cy={61} r={1.6} /><circle cx={79} cy={61} r={1.6} /></g>
    case 11: return <g fill="#111"><rect x={30} y={57} width={9} height={2.6} rx={1} /><rect x={61} y={57} width={9} height={2.6} rx={1} /></g>
    case 12: return <g><path d="M24,46 L76,46" stroke={OUTLINE} strokeWidth={2} /><path d="M29,45 L47,45 L46,56 Q38,60 31,56 Z M71,45 L53,45 L54,56 Q62,60 69,56 Z" fill="#161a24" stroke={OUTLINE} strokeWidth={1.2} /><path d="M33,48 L40,48" stroke="#fff" strokeOpacity={0.5} strokeWidth={1.2} /></g>
    case 13: return <g><rect x={58} y={60} width={13} height={6} rx={2} fill="#f2d3a8" stroke={OUTLINE} strokeWidth={0.9} transform="rotate(-18 64 63)" /><path d="M62,61 L62,65 M66,60 L66,64" stroke="#c99a6a" strokeWidth={0.8} /></g>
    case 10: return <path d="M22,36 Q22,14 50,13 Q78,14 78,36 Q50,30 22,36 Z M76,30 L86,36 L80,40 Z" fill={team.primary} stroke={OUTLINE} strokeWidth={1.2} />
    default: return null
  }
}

export type { FaceSpec }
