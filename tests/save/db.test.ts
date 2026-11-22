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
    const bad = ['not json{', JSON.stringify({ ...league, version: 2 }), JSON.stringify({ version: 1, name: 'x' }), '[]', 'null']
    for (const t of bad) {
      expect(() => parseImport(t)).toThrow(SaveImportError)
      try { parseImport(t) } catch (e) { expect((e as Error).message.length).toBeGreaterThan(10) }
    }
    expect(await listSaves()).toEqual(before)
  })
})
