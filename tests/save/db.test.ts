import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { SaveImportError, deleteSave, exportSave, listSaves, loadSave, parseImport, writeSave } from '../../src/save/db'

const league = createLeague({ seed: 12, userTeamIndex: 20, name: 'Dynasty' })

describe('save slots', () => {
  it('write → list → load round-trips', async () => {
    await writeSave('slot1', league)
    const list = await listSaves()
    const row = list.find((s) => s.id === 'slot1')!
    expect(row.name).toBe('Dynasty')
    expect(row.teamName).toBe('Los Angeles Fakers')
    expect(row.season).toBe(1)
    expect(typeof row.updatedAt).toBe('number')
    expect(await loadSave('slot1')).toEqual(league)
  })
  it('delete removes the slot', async () => {
    await writeSave('slot2', league)
    await deleteSave('slot2')
    expect((await listSaves()).some((s) => s.id === 'slot2')).toBe(false)
    await expect(loadSave('slot2')).rejects.toThrow()
  })
})

describe('import/export', () => {
  it('exportSave → parseImport round-trips', async () => {
    const text = await exportSave(league).text()
    expect(parseImport(text)).toEqual(league)
  })
  it('rejects garbage, wrong versions and missing keys without touching saves', async () => {
    await writeSave('keep', league)
    const before = await listSaves()
    const bad = ['not json{', JSON.stringify({ ...league, version: 99 }), JSON.stringify({ version: 2, name: 'x' }), '[]', 'null']
    for (const t of bad) {
      expect(() => parseImport(t)).toThrow(SaveImportError)
      try { parseImport(t) } catch (e) { expect((e as Error).message.length).toBeGreaterThan(10) }
    }
    expect(await listSaves()).toEqual(before)
  })
  it('rejects structurally broken saves with a clear message', () => {
    const base = JSON.parse(JSON.stringify(league))
    const firstPlayer = Object.keys(base.players)[0]
    const cases = [
      { ...base, games: null },
      { ...base, teams: null },
      { ...base, statLines: [] },
      { ...base, day: 'x' },
      { ...base, phase: 'preseason' },
      { ...base, players: { ...base.players, [firstPlayer]: { ...base.players[firstPlayer], ratings: undefined } } },
      { ...base, teams: { ...base.teams, [base.userTeamId]: { ...base.teams[base.userTeamId], rotation: { starters: ['p_ghost'], bench: [], inactive: [] } } } },
    ]
    for (const c of cases) {
      expect(() => parseImport(JSON.stringify(c))).toThrow(SaveImportError)
    }
  })
})

describe('save versions', () => {
  const v1 = () => {
    const l = JSON.parse(JSON.stringify(league))
    l.version = 1
    for (const k of ['progress', 'picks', 'draft', 'draftRights', 'transactions', 'deadMoney', 'waivers', 'faOffers', 'offseason', 'tradeDeadlineDay', 'news', 'social', 'inbox', 'awards', 'history', 'records', 'hof', 'fans', 'careerHighs', 'storySeq', 'favoritePlayerIds']) delete l[k]
    return l
  }
  it('loads a v1 save from IndexedDB and migrates it', async () => {
    await writeSave('old', v1())
    const l = await loadSave('old')
    expect(l.version).toBe(14)
    expect(l.progress).toEqual([])
    expect(l.picks).toHaveLength(120)
    expect(l.tradeDeadlineDay).toBe(league.tradeDeadlineDay)
  })
  it('imports a v1 file', () => {
    const l = parseImport(JSON.stringify(v1()))
    expect(l.version).toBe(14)
    expect(l.progress).toEqual([])
    expect(l.waivers).toEqual([])
  })
  it('imports a v3 file with empty stories and backfilled records', () => {
    const l = v1()
    l.version = 3
    Object.assign(l, { progress: [], picks: [], draft: null, draftRights: {}, transactions: [], deadMoney: [], waivers: [], faOffers: [], offseason: null, tradeDeadlineDay: 20 })
    const m = parseImport(JSON.stringify(l))
    expect(m.version).toBe(14)
    expect(m.news).toEqual([])
    expect(m.inbox).toEqual([])
    expect(m.records.league.game).toEqual({})
    expect(m.fans.players).toEqual({}); expect(m.fans.teams).toEqual({})
  })
  it('migrates a v4 save to v5 with no favorites', () => {
    const m = parseImport(JSON.stringify({ ...league, version: 4, favoritePlayerIds: undefined }))
    expect(m.version).toBe(14)
    expect(m.favoritePlayerIds).toEqual([])
  })
  it('loads a v5 save missing favoritePlayerIds with an empty list', () => {
    const m = parseImport(JSON.stringify({ ...league, version: 5, favoritePlayerIds: undefined }))
    expect(m.favoritePlayerIds).toEqual([])
  })
  it('migrates a v5 save to v6 with All-Star Weekend and empty development slots', () => {
    const m = parseImport(JSON.stringify({ ...league, version: 5, allStarDay: undefined, allStars: undefined, training: undefined }))
    expect(m.version).toBe(14)
    expect(m.allStars).toEqual([])
    expect(m.training).toEqual([])
    expect(m.allStarDay).toBeGreaterThan(0)
  })
  it('migrates a v6 save to v7 keeping its depth charts (no minutes plan = coach suggestions)', () => {
    const m = parseImport(JSON.stringify({ ...league, version: 6 }))
    expect(m.version).toBe(14)
    const t = m.teams[m.userTeamId]
    expect(t.rotation.minutes).toBeUndefined()
    expect(t.rotation.starters).toEqual(league.teams[league.userTeamId].rotation.starters)
  })
  it('migrates a v8 save to v9 with a computed fan following', () => {
    const m = parseImport(JSON.stringify({ ...league, version: 8, fans: { players: { x: 5 }, teams: {} } }))
    expect(m.version).toBe(14)
    expect(m.fans.players).toEqual({ x: 5 })
    expect(Object.keys(m.fans.base).length).toBeGreaterThan(0)
  })
  it('migrates a v9 save to v10 with an empty retired-jersey list', () => {
    const m = parseImport(JSON.stringify({ ...league, version: 9, retiredJerseys: undefined }))
    expect(m.version).toBe(14)
    expect(Array.isArray(m.retiredJerseys)).toBe(true)
  })
  it('backfills jerseys for players who retired before v10, quietly', () => {
    const l = structuredClone(league)
    const a = Object.keys(l.teams)[0]
    const p = Object.values(l.players).find((q) => q.teamId === a)!
    p.teamId = null
    p.retired = true
    for (let s = 1; s <= 8; s++)
      l.statLines[`${s}|r|${p.id}|${a}`] = {
        playerId: p.id, teamId: a, season: s, playoffs: false, gp: 70, gs: 70, min: 2100, pts: 2100, oreb: 0, dreb: 0, ast: 0,
        stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, pm: 0,
      }
    const news = l.news.length
    const m = parseImport(JSON.stringify({ ...l, version: 9, retiredJerseys: undefined }))
    expect(m.retiredJerseys.map((j) => [j.teamId, j.playerId, j.season])).toEqual([[a, p.id, 9]])
    expect(m.news.length).toBe(news)
  })
  it('migrates v10 15-attribute and legacy fields (lateralQuickness, acceleration, fatigue) cleanly to v11', () => {
    const l = JSON.parse(JSON.stringify(league))
    l.version = 10
    const firstId = Object.keys(l.players)[0]
    l.players[firstId].fatigue = 42
    l.players[firstId].ratings = {
      ins: 82, mid: 76, three: 84, ft: 88, pass: 80, handle: 83, oreb: 45,
      perD: 77, intD: 54, stl: 74, blk: 40, dreb: 58, ath: 79, stam: 85, iq: 81,
      lateralQuickness: 91, acceleration: 87,
    }
    const m = parseImport(JSON.stringify(l))
    expect(m.version).toBe(14)
    const mp = m.players[firstId] as unknown as Record<string, unknown>
    expect('fatigue' in mp).toBe(false)
    const keys = Object.keys(m.players[firstId].ratings)
    expect(keys).toHaveLength(36)
    expect('lateralQuickness' in m.players[firstId].ratings).toBe(false)
    expect('acceleration' in m.players[firstId].ratings).toBe(false)
    expect('ins' in m.players[firstId].ratings).toBe(false)
    expect(m.players[firstId].ratings.agility).toBe(89)
    expect(m.players[firstId].ratings.threePointShot).toBe(84)
    for (const v of Object.values(m.players[firstId].ratings)) {
      expect(v).toBeGreaterThanOrEqual(25)
      expect(v).toBeLessThanOrEqual(99)
    }
  })
  it('rejects version 13', () => {
    expect(() => parseImport(JSON.stringify({ ...league, version: 99 }))).toThrow(SaveImportError)
  })
})
