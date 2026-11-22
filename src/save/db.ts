import { openDB, type IDBPDatabase } from 'idb'
import type { League } from '../engine/types'

export interface SaveMeta { id: string; name: string; teamName: string; season: number; updatedAt: number }

import { SaveImportError } from './errors'
import { migrateLeague } from './migrate'

export { SaveImportError }

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
  return migrateLeague(league)
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
  const obj = migrateLeague(data) as unknown as Record<string, unknown>
  const missing = REQUIRED.filter((k) => !(k in obj))
  if (missing.length) throw new SaveImportError(`This save is missing data (${missing.join(', ')}), so it can’t be loaded.`)
  const broken = (what: string) => new SaveImportError(`This save is damaged (${what}), so it can’t be loaded.`)
  const isObj = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v)
  for (const k of ['teams', 'players', 'coaches', 'statLines', 'rng'] as const) if (!isObj(obj[k])) throw broken(k)
  if (!Array.isArray(obj.games)) throw broken('games')
  for (const k of ['day', 'season', 'seed'] as const) if (typeof obj[k] !== 'number') throw broken(k)
  if (!['regular', 'playoffs', 'offseason'].includes(obj.phase as string)) throw broken('phase')
  const l = obj as unknown as League
  if (!isObj(l.teams[l.userTeamId])) throw new SaveImportError('This save’s team can’t be found, so it can’t be loaded.')
  for (const p of Object.values(l.players))
    if (!isObj(p) || !isObj(p.ratings) || typeof p.faceSeed !== 'number') throw broken('player data')
  for (const t of Object.values(l.teams)) {
    const r = t?.rotation
    if (!r || ![r.starters, r.bench, r.inactive].every(Array.isArray)) throw broken('rotations')
    if ([...r.starters, ...r.bench, ...r.inactive].some((id) => !l.players[id])) throw broken('rotations')
    if (!isObj(l.coaches[t.coachId])) throw broken('coaches')
  }
  for (const g of l.games) if (!isObj(g) || !l.teams[g.homeId] || !l.teams[g.awayId]) throw broken('schedule')
  return l
}
