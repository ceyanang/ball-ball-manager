import { describe, expect, it } from 'vitest'
import { BUILD_TEMPLATES } from '../../src/engine/career/build'
import { ovrOf } from '../../src/engine/career/careerOvr'
import { createCareerLeague } from '../../src/engine/career/create'
import { createLeague } from '../../src/engine/league/create'
import { isPlayStyle, PLAY_STYLES, type PlayStyle } from '../../src/engine/player/playStyle'
import { CURRENT_VERSION, migrateLeague } from '../../src/save/migrate'

const v15 = () => {
  const raw = JSON.parse(JSON.stringify(createLeague({ seed: 13, userTeamIndex: 2, name: 'T' })))
  raw.version = 15
  const ids = Object.keys(raw.players)
  raw.players[ids[0]].retired = true
  raw.players[ids[1]].teamId = null
  for (const id of ids) delete raw.players[id].playStyle
  return raw
}

describe('v15 → v16 play style migration', () => {
  it('gives every player (retired and free agents too) a valid style', () => {
    const m = migrateLeague(v15())
    expect(CURRENT_VERSION).toBe(16)
    expect(m.version).toBe(16)
    for (const p of Object.values(m.players)) expect(isPlayStyle(p.playStyle)).toBe(true)
  })
  it('is stable across repeated loads of the same save', () => {
    const a = migrateLeague(v15())
    const b = migrateLeague(v15())
    for (const id of Object.keys(a.players)) expect(a.players[id].playStyle).toBe(b.players[id].playStyle)
    const again = migrateLeague(JSON.parse(JSON.stringify(a)))
    for (const id of Object.keys(a.players)) expect(again.players[id].playStyle).toBe(a.players[id].playStyle)
  })
  it('new leagues are already version 16', () => {
    expect(createLeague({ seed: 1, userTeamIndex: 0, name: 'N' }).version).toBe(16)
  })
})

describe('MyCareer chosen style', () => {
  const t = BUILD_TEMPLATES[0]
  const mk = (playStyle?: PlayStyle) =>
    createCareerLeague({ seed: 5, name: 'Me', build: { max: t.max, pos: t.pos, first: 'J', last: 'H', heightIn: 76, playStyle } })
  const me = (l: ReturnType<typeof mk>) => l.players[l.career!.playerId]
  it('keeps the chosen style', () => {
    expect(me(mk('power')).playStyle).toBe('power')
  })
  it('falls back to a valid roll for a missing or invalid choice', () => {
    expect(isPlayStyle(me(mk()).playStyle)).toBe(true)
    expect(isPlayStyle(me(mk('bogus' as PlayStyle)).playStyle)).toBe(true)
  })
  it('ovrOf is identical for every style', () => {
    const ovrs = PLAY_STYLES.map((s) => { const l = mk(s); return ovrOf(me(l)) })
    expect(new Set(ovrs).size).toBe(1)
  })
})
