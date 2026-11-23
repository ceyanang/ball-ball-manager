import { create } from 'zustand'
import { createLeague } from '../engine/league/create'
import { validateRotation } from '../engine/sim/rotation'
import { GmError } from '../engine/gm/cap'
import { Rng } from '../engine/rng'
import type { League, Rotation } from '../engine/types'
import { deleteSave, loadSave, parseImport, writeSave } from '../save/db'
import { runSim } from '../worker/client'
import type { SimCommand } from '../worker/protocol'

interface State {
  saveId: string | null
  league: League | null
  busy: boolean
  error: string | null
  /** Short confirmation of the last GM move. */
  notice: string | null
  newLeague: (opts: { seed: number; userTeamIndex: number; name: string }) => Promise<void>
  load: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  sim: (cmd: SimCommand) => Promise<void>
  setRotation: (teamId: string, rot: Rotation) => void
  importFile: (file: File) => Promise<void>
  clearError: () => void
  clearNotice: () => void
  /**
   * Runs a GM move on a copy of the league. A GmError becomes a friendly error; on success the move is saved and
   * its message (if any) shown as a notice. Returns whether it went through.
   */
  act: (fn: (l: League, rng: Rng) => string | void) => boolean
}

const newId = () => 'save_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36)

export const useStore = create<State>((set, get) => ({
  saveId: null,
  league: null,
  busy: false,
  error: null,
  notice: null,

  async newLeague(opts) {
    if (get().busy) return
    const league = createLeague(opts)
    const saveId = newId()
    await writeSave(saveId, league)
    set({ league, saveId, error: null })
  },

  async load(id) {
    if (get().busy) return
    try {
      set({ league: await loadSave(id), saveId: id, error: null })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  async remove(id) {
    if (get().busy) return
    await deleteSave(id)
    if (get().saveId === id) set({ saveId: null, league: null })
  },

  async sim(cmd) {
    const { league, busy, saveId } = get()
    if (busy || !league) return
    set({ busy: true, error: null, notice: null })
    let next: League
    try {
      next = await runSim(league, cmd)
    } catch (e) {
      set({ error: `The sim stopped unexpectedly: ${(e as Error).message}`, busy: false })
      return
    }
    try {
      // Only show the result if the same save is still open; always persist it to the save it came from.
      const openOffers = (l: League) => l.inbox.filter((i) => i.offer?.status === 'open').length
      if (get().saveId === saveId) set({ league: next, notice: openOffers(next) > openOffers(league) ? '📞 A team just called with a trade offer. Check your inbox — the sim paused so you can answer.' : null })
      if (saveId) await writeSave(saveId, next)
    } catch (e) {
      set({ error: `The sim finished but couldn’t be saved: ${(e as Error).message}` })
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
    if (get().busy) return
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
  clearNotice: () => set({ notice: null }),

  act(fn) {
    const { league, saveId, busy } = get()
    if (!league || busy) return false
    const next = structuredClone(league)
    let msg: string | void
    try {
      msg = fn(next, new Rng(next.rng))
    } catch (e) {
      if (e instanceof GmError) {
        set({ error: e.message, notice: null })
        return false
      }
      throw e
    }
    set({ league: next, error: null, notice: msg || null })
    if (saveId) void writeSave(saveId, next).catch((e) => set({ error: `Couldn’t save: ${(e as Error).message}` }))
    return true
  },
}))
