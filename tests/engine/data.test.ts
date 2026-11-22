import { describe, expect, it } from 'vitest'
import { PARODY_TEAMS } from '../../src/engine/data/teams'
import { COLLEGES, FIRST_NAMES, HOMETOWNS, INJURY_TYPES, LAST_NAMES } from '../../src/engine/data/names'

const REAL = ['Hawks','Celtics','Nets','Hornets','Bulls','Cavaliers','Pistons','Pacers','Heat','Bucks','Knicks','Magic','76ers','Raptors','Wizards',
  'Mavericks','Nuggets','Warriors','Rockets','Clippers','Lakers','Grizzlies','Timberwolves','Pelicans','Thunder','Suns','Trail Blazers','Kings','Spurs','Jazz']

describe('parody teams', () => {
  it('has 30 teams, 15 per conference', () => {
    expect(PARODY_TEAMS).toHaveLength(30)
    expect(PARODY_TEAMS.filter((t) => t.conf === 'East')).toHaveLength(15)
    expect(PARODY_TEAMS.filter((t) => t.conf === 'West')).toHaveLength(15)
  })
  it('abbrevs and names are unique', () => {
    expect(new Set(PARODY_TEAMS.map((t) => t.abbrev)).size).toBe(30)
    expect(new Set(PARODY_TEAMS.map((t) => `${t.city} ${t.name}`)).size).toBe(30)
  })
  it('never uses a real NBA nickname', () => {
    for (const t of PARODY_TEAMS) expect(REAL).not.toContain(t.name)
  })
  it('colors are hex', () => {
    for (const t of PARODY_TEAMS) {
      expect(t.primary).toMatch(/^#[0-9a-f]{6}$/i)
      expect(t.secondary).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('name data', () => {
  it('meets size minimums', () => {
    expect(new Set(FIRST_NAMES).size).toBeGreaterThanOrEqual(300)
    expect(new Set(LAST_NAMES).size).toBeGreaterThanOrEqual(300)
    expect(new Set(HOMETOWNS).size).toBeGreaterThanOrEqual(60)
    expect(new Set(COLLEGES).size).toBeGreaterThanOrEqual(60)
    expect(INJURY_TYPES.length).toBeGreaterThanOrEqual(15)
    for (const s of ['dtd', 'short', 'long', 'season']) expect(INJURY_TYPES.some((i) => i.severity === s)).toBe(true)
  })
})
