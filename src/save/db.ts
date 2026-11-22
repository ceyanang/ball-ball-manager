import { openDB, type IDBPDatabase } from 'idb'
import type { League } from '../engine/types'

export interface SaveMeta { id: string; name: string; teamName: string; season: number; updatedAt: number }

export class SaveImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SaveImportError'
  }
}

let dbp: Promise<IDBPDatabase> | null = null
const db = () =>
  (dbp ??= openDB('ball-ball-manager', 1, {
    upgrade(d) {
      d.createObjectStore('meta', { keyPath: 'id' })
      d.createObjectStore('leagues')
    },
  }))

export async function listSaves(): Promise<SaveMeta[]> {
  const rows = (await (await db()).getAll('meta')) as SaveMeta[]
  return rows.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadSave(id: string): Promise<League> {
  const league = (await (await db()).get('leagues', id)) as League | undefined
  if (!league) throw new Error(`No save named "${id}" was found.`)
  return league
}

export async function writeSave(id: string, league: League): Promise<void> {
  const d = await db()
  const team = league.teams[league.userTeamId]
  const meta: SaveMeta = { id, name: league.name, teamName: `${team.city} ${team.name}`, season: league.season, updatedAt: Date.now() }
  const tx = d.transaction(['meta', 'leagues'], 'readwrite')
  await Promise.all([tx.objectStore('meta').put(meta), tx.objectStore('leagues').put(league, id), tx.done])
}

export async function deleteSave(id: string): Promise<void> {
  const d = await db()
  const tx = d.transaction(['meta', 'leagues'], 'readwrite')
  await Promise.all([tx.objectStore('meta').delete(id), tx.objectStore('leagues').delete(id), tx.done])
}

export function exportSave(league: League): Blob {
  return new Blob([JSON.stringify(league)], { type: 'application/json' })
}

const REQUIRED: (keyof League)[] = ['name', 'seed', 'rng', 'season', 'phase', 'day', 'userTeamId', 'teams', 'players', 'coaches', 'games', 'statLines']

export function parseImport(text: string): League {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new SaveImportError('This file isn’t a Ball Ball Manager save (it isn’t valid JSON).')
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data))
    throw new SaveImportError('This file isn’t a Ball Ball Manager save.')
  const obj = data as Record<string, unknown>
  if (obj.version !== 1)
    throw new SaveImportError(`This save is version ${String(obj.version)}, but this app reads version 1 saves.`)
  const missing = REQUIRED.filter((k) => !(k in obj))
  if (missing.length) throw new SaveImportError(`This save is missing data (${missing.join(', ')}), so it can’t be loaded.`)
  const l = obj as unknown as League
  if (!l.teams[l.userTeamId]) throw new SaveImportError('This save’s team can’t be found, so it can’t be loaded.')
  return l
}
