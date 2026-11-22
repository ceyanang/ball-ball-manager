import { useMemo } from 'react'
import { ageFace, generateFace } from '../../engine/face/face'
import { EYE, HAIR, SKIN, greyed, shade } from './colors'
import { Accessory, Brows, Ears, Eyes, FacialHair, HEADS, Hair, Mouth, Nose, OUTLINE } from './parts'

export interface FaceProps {
  seed: number
  age: number
  colors: { primary: string; secondary: string }
  size?: number
  jersey?: number
  title?: string
}

export function Face({ seed, age, colors, size = 64, jersey, title }: FaceProps) {
  const f = useMemo(() => ageFace(generateFace(seed), seed, age), [seed, age])
  const skin = SKIN[f.skin]
  const hair = greyed(HAIR[f.hairColor], f.grey)
  const browColor = greyed(shade(HAIR[f.hairColor], 0.15), f.grey * 0.8)
  return (
    <svg viewBox="0 0 100 120" width={size} height={size * 1.2} role="img" aria-label={title ?? 'Player portrait'}>
      {/* jersey */}
      <path d="M8,120 Q10,100 30,96 L50,104 L70,96 Q90,100 92,120 Z" fill={colors.primary} stroke={OUTLINE} strokeWidth={1.4} />
      <path d="M36,96 L50,108 L64,96" fill="none" stroke={colors.secondary} strokeWidth={4} strokeLinejoin="round" />
      {jersey !== undefined && (
        <text x={50} y={119} textAnchor="middle" fontSize={10} fontWeight={800} fill={colors.secondary} fontFamily="'Big Shoulders Display', sans-serif">{jersey}</text>
      )}
      {/* neck */}
      <path d="M40,78 L40,98 Q50,104 60,98 L60,78 Z" fill={shade(skin, 0.12)} stroke={OUTLINE} strokeWidth={1.4} />
      <Ears v={f.ears} skin={skin} />
      <path d={HEADS[f.head]} fill={skin} stroke={OUTLINE} strokeWidth={1.6} />
      <FacialHair v={f.facialHair} color={hair} />
      <Mouth v={f.mouth} />
      <Nose v={f.nose} skin={shade(skin, 0.08)} />
      <Eyes v={f.eyes} color={EYE[f.eyeColor]} />
      <Brows v={f.brows} color={browColor} />
      <Hair v={f.hair} color={hair} recede={f.recede} />
      <Accessory v={f.accessory} team={colors} />
    </svg>
  )
}
