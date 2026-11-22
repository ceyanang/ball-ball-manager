import { create } from 'zustand'
import { createLeague } from '../engine/league/create'
import { validateRotation } from '../engine/sim/rotation'
import type { League, Rotation } from '../engine/types'
import { deleteSave, loadSave, parseImport, writeSave } from '../save/db'
import { runSim } from '../worker/client'
import type { SimCommand } from '../worker/protocol'

interface State {
  saveId: string | null
  league: League | null
  busy: boolean
  error: string | null
  newLeague: (opts: { seed: number; userTeamIndex: number; name: string }) => Promise<void>
  load: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  sim: (cmd: SimCommand) => Promise<void>
  setRotation: (teamId: string, rot: Rotation) => void
  importFile: (file: File) => Promise<void>
  clearError: () => void
}

const newId = () => 'save_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36)

export const useStore = create<State>((set, get) => ({
  saveId: null,
  league: null,
  busy: false,
  error: null,

  async newLeague(opts) {
    const league = createLeague(opts)
    const saveId = newId()
    await writeSave(saveId, league)
    set({ league, saveId, error: null })
  },

  async load(id) {
    try {
      set({ league: await loadSave(id), saveId: id, error: null })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  async remove(id) {
    await deleteSave(id)
    if (get().saveId === id) set({ saveId: null, league: null })
  },

  async sim(cmd) {
    const { league, busy, saveId } = get()
    if (busy || !league) return
    set({ busy: true, error: null })
    try {
      const next = await runSim(league, cmd)
      set({ league: next })
      if (saveId) await writeSave(saveId, next)
    } catch (e) {
      set({ error: `The sim stopped unexpectedly: ${(e as Error).message}` })
    } finally {
      set({ busy: false })
    }
  },

  setRotation(teamId, rot) {
    const { league, saveId, busy } = get()
    if (!league || busy) return
    const roster = Object.values(league.players).filter((p) => p.teamId === teamId).map((p) => p.id)
    const problems = validateRotation(rot, roster)
    if (problems.length) {
      set({ error: problems.join(' ') })
      return
    }
    const next: League = { ...league, teams: { ...league.teams, [teamId]: { ...league.teams[teamId], rotation: rot } } }
    set({ league: next, error: null })
    if (saveId) void writeSave(saveId, next)
  },

  async importFile(file) {
    try {
      const league = parseImport(await file.text())
      const saveId = newId()
      await writeSave(saveId, league)
      set({ league, saveId, error: null })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  clearError: () => set({ error: null }),
}))
