import { create } from 'zustand'
import { createLeague } from '../engine/league/create'
import { validateRotation } from '../engine/sim/rotation'
import { GmError } from '../engine/gm/cap'
import { Rng } from '../engine/rng'
import { eventGame, playAllStarEvent, userSideIndex } from '../engine/allstar/allstar'
import type { AllStarKind, Game, League, Rotation } from '../engine/types'
import { deleteSave, listSaves, loadSave, onSaveWritten, parseImport, rememberOpenedSave, writeSave } from '../save/db'
import { runSim, runWatch } from '../worker/client'
import type { PlayEvent } from '../engine/sim/playlog'
import type { WatchCapture } from '../engine/season/advance'
import type { SimCommand } from '../worker/protocol'

/** A game being watched live. `before` is the league as it stood before the game, for replaying it. Never saved. */
export interface WatchSession {
  gameId: string; log: PlayEvent[]; before: League
  /** All-Star Weekend games aren't in `league.games`: they carry their own game, headline and exit route. */
  game?: Game; meta?: string; doneTo?: string
}

interface State {
  saveId: string | null
  league: League | null
  busy: boolean
  error: string | null
  /** Short confirmation of the last GM move. */
  notice: string | null
  watch: WatchSession | null
  newLeague: (opts: { seed: number; userTeamIndex: number; name: string }) => Promise<void>
  load: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  sim: (cmd: SimCommand) => Promise<void>
  startWatch: () => Promise<void>
  /** Plays the queued All-Star Weekend game (watching it live, or just simming it). Doesn't count for stats. */
  playAllStar: (kind: AllStarKind, watch: boolean) => void
  endWatch: () => void
  toggleFavorite: (playerId: string) => void
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

/** Keeps a tab from overwriting newer progress made in another tab/window on the same save. */
let externalSyncInstalled = false
function installExternalSync(get: () => State, set: (p: Partial<State>) => void) {
  if (externalSyncInstalled) return
  externalSyncInstalled = true
  onSaveWritten(async (id) => {
    const s = get()
    if (s.saveId !== id || s.watch) return
    try {
      const league = await loadSave(id)
      if (get().saveId === id && !get().busy) set({ league, notice: '🔄 This save was updated in another window — showing the latest.' })
    } catch { /* keep what we have */ }
  })
  // Leaving mid-broadcast: the result is already saved, so warn before the reload spoils it.
  if (typeof window !== 'undefined') window.addEventListener('beforeunload', (e) => { if (get().watch) e.preventDefault() })
}

const newId = () => 'save_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36)

export const useStore = create<State>((set, get) => {
  installExternalSync(get, set)
  /** Runs a sim step on the open league, saves the result and shows an offer notice. A watch capture, if any, starts a watch session. */
  async function runAndSave(run: (league: League) => Promise<{ league: League; watch: WatchCapture | null }>) {
    const { league, busy, saveId } = get()
    if (busy || !league) return
    set({ busy: true, error: null, notice: null, watch: null })
    let res: { league: League; watch: WatchCapture | null }
    try {
      res = await run(league)
    } catch (e) {
      set({ error: `The sim stopped unexpectedly: ${(e as Error).message}`, busy: false })
      return
    }
    const next = res.league
    try {
      // Only show the result if the same save is still open; always persist it to the save it came from.
      const openOffers = (l: League) => l.inbox.filter((i) => i.offer?.status === 'open').length
      if (get().saveId === saveId)
        set({
          league: next,
          notice: openOffers(next) > openOffers(league)
            ? '📞 A team just called with a trade offer. Check your inbox — the sim paused so you can answer.'
            : next.allStars.length > league.allStars.length ? '🌟 All-Star Weekend! The rosters are set — head to the All-Star page to watch, or keep simming.' : null,
          watch: res.watch ? { ...res.watch, before: league } : null,
        })
      if (saveId) await writeSave(saveId, next)
    } catch (e) {
      set({ error: `The sim finished but couldn’t be saved: ${(e as Error).message}` })
    } finally {
      set({ busy: false })
    }
  }

  return {
  saveId: null,
  league: null,
  busy: false,
  error: null,
  notice: null,
  watch: null,

  async newLeague(opts) {
    if (get().busy) return
    set({ busy: true })
    try {
      const league = createLeague(opts)
      const saveId = newId()
      await writeSave(saveId, league)
      rememberOpenedSave(saveId)
      set({ league, saveId, error: null })
    } finally {
      set({ busy: false })
    }
  },

  async load(id) {
    if (get().busy) return
    try {
      set({ league: await loadSave(id), saveId: id, error: null })
      rememberOpenedSave(id)
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  async remove(id) {
    if (get().busy) return
    await deleteSave(id)
    if (get().saveId !== id) return
    set({ saveId: null, league: null, watch: null })
    rememberOpenedSave(null)
    const next = (await listSaves())[0]
    if (next) await get().load(next.id)
  },

  async sim(cmd) {
    await runAndSave((league) => runSim(league, cmd).then((next) => ({ league: next, watch: null })))
  },

  async startWatch() {
    await runAndSave(runWatch)
  },

  playAllStar(kind, watchIt) {
    const { league, saveId, busy } = get()
    if (!league || busy) return
    const next = structuredClone(league)
    const ev = next.allStars.find((e) => e.season === next.season && e.kind === kind && !e.result)
    if (!ev) return
    const log: PlayEvent[] = []
    playAllStarEvent(next, ev, watchIt ? log : undefined)
    const [a, b] = ev.teams
    const before: League = { ...league, teams: { ...league.teams, [a.id]: a, [b.id]: b }, userTeamId: ev.teams[userSideIndex(league, ev)].id }
    const game = eventGame(ev)
    const meta = kind === 'allstar' ? 'All-Star Game · East vs West' : 'Rising Stars · Rookies vs Sophomores'
    set({ league: next, error: null, notice: null, watch: watchIt ? { gameId: game.id, log, before, game, meta, doneTo: '/all-star' } : null })
    if (saveId) void writeSave(saveId, next).catch((e) => set({ error: `Couldn’t save: ${(e as Error).message}` }))
  },

  endWatch: () => set({ watch: null }),

  toggleFavorite(playerId) {
    get().act((l) => {
      const fav = new Set(l.favoritePlayerIds)
      if (!fav.delete(playerId)) fav.add(playerId)
      l.favoritePlayerIds = [...fav]
    })
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
}
})
