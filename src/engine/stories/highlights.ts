import { ovr, pname, teamPlayers } from '../gm/cap'
import type { BoxLine, Game, Injury, League, NewsItem, Player, Series } from '../types'
import { RECORD_LABEL, type Broken } from './records'
import { nextId } from './state'

export function addNews(l: League, n: Omit<NewsItem, 'id' | 'season' | 'day' | 'playoffs'>): NewsItem {
  const item: NewsItem = { id: nextId(l, 'n'), season: l.season, day: l.day, playoffs: l.phase === 'playoffs', ...n }
  l.news.push(item)
  return item
}

/** Drafted last summer; in the first season (no drafts yet), the youngest players count as rookies. */
export function isRookie(l: League, p: Player, season = l.season): boolean {
  if (p.draft) return p.draft.season === season - 1
  return season === 1 && p.age <= 21
}

const reb = (b: BoxLine) => b.oreb + b.dreb
const abbr = (l: League, id: string) => l.teams[id].abbrev
const name = (l: League, id: string) => pname(l.players[id])

/** A team's current run of wins (positive) or losses (negative) this season. */
export function streakOf(l: League, teamId: string, playoffs = false): number {
  const games = l.games
    .filter((g) => g.season === l.season && g.result && (g.playoff !== null) === playoffs && (g.homeId === teamId || g.awayId === teamId))
    .sort((a, b) => b.day - a.day)
  let n = 0
  for (const g of games) {
    const won = (g.homeId === teamId) === g.result!.homeScore > g.result!.awayScore
    if (n === 0) n = won ? 1 : -1
    else if (won === n > 0) n += won ? 1 : -1
    else break
  }
  return n
}

const STREAK_MARKS = [5, 8, 10, 12, 15, 20, 25, 30, 35, 40]

function scoreLine(l: League, g: Game) {
  const r = g.result!
  const homeWon = r.homeScore > r.awayScore
  const [w, lo] = homeWon ? [g.homeId, g.awayId] : [g.awayId, g.homeId]
  const [ws, ls] = homeWon ? [r.homeScore, r.awayScore] : [r.awayScore, r.homeScore]
  return { w, lo, ws, ls, text: `${abbr(l, w)} ${ws}, ${abbr(l, lo)} ${ls}` }
}

/** Standout moments from one finished game. `highs` is each player's career high before this game. */
export function gameHighlights(l: League, g: Game, broken: Broken[], highs: Record<string, { gp: number; pts: number } | undefined>): void {
  const r = g.result!
  const sl = scoreLine(l, g)
  const base = { gameId: g.id }
  for (const b of r.box) {
    if (b.min <= 0) continue
    const p = l.players[b.playerId]
    if (!p) continue
    const who = pname(p), team = abbr(l, b.teamId)
    const line = `${b.pts} pts, ${reb(b)} reb, ${b.ast} ast`
    if (b.pts >= 40)
      addNews(l, { ...base, kind: 'bigGame', emoji: b.pts >= 50 ? '🌋' : '🔥', title: `${who} drops ${b.pts}`, text: `${who} (${team}) poured in ${b.pts} on ${b.fgm}-${b.fga} shooting. ${sl.text}.`, playerIds: [p.id], teamIds: [b.teamId], weight: b.pts >= 50 ? 9 : 7 })
    const tens = [b.pts, reb(b), b.ast, b.stl, b.blk].filter((v) => v >= 10).length
    if (tens >= 3)
      addNews(l, { ...base, kind: 'tripleDouble', emoji: tens >= 4 ? '🤯' : '🎯', title: `${tens >= 4 ? 'Quadruple' : 'Triple'}-double for ${who}`, text: `${who} filled it up: ${line}${b.blk >= 10 ? `, ${b.blk} blk` : ''}${b.stl >= 10 ? `, ${b.stl} stl` : ''}. ${sl.text}.`, playerIds: [p.id], teamIds: [b.teamId], weight: tens >= 4 ? 10 : 6 })
    else if (tens === 2 && b.pts >= 20 && [reb(b), b.ast].some((v) => v === 8 || v === 9))
      addNews(l, { ...base, kind: 'nearTriple', emoji: '🤏', title: `${who} just misses a triple-double`, text: `So close: ${line}. ${sl.text}.`, playerIds: [p.id], teamIds: [b.teamId], weight: 2 })
    const before = highs[p.id]
    if (before && before.gp === 0 && isRookie(l, p, g.season) && b.pts >= 20)
      addNews(l, { ...base, kind: 'rookie', emoji: '🐣', title: `${who} arrives`, text: `Rookie ${who} scored ${b.pts} in his first game for ${team}.`, playerIds: [p.id], teamIds: [b.teamId], weight: 5 })
    else if (before && before.gp >= 10 && b.pts >= 30 && b.pts > before.pts && b.pts < 40)
      addNews(l, { ...base, kind: 'careerHigh', emoji: '📈', title: `Career night for ${who}`, text: `${who} set a career high with ${b.pts} points (old best ${before.pts}). ${sl.text}.`, playerIds: [p.id], teamIds: [b.teamId], weight: 4 })
  }
  if (r.clutch) {
    const who = name(l, r.clutch.playerId)
    addNews(l, { ...base, kind: 'gameWinner', emoji: r.clutch.buzzer ? '🚨' : '🧊', title: r.clutch.buzzer ? `${who} at the buzzer!` : `${who} wins it late`, text: `${who} put ${abbr(l, sl.w)} ahead for good ${r.clutch.buzzer ? 'with the final shot of the game' : 'in the final minute'}${r.ot ? ' of overtime' : ''}. ${sl.text}.`, playerIds: [r.clutch.playerId], teamIds: [sl.w, sl.lo], weight: r.clutch.buzzer ? 8 : 5 })
  }
  if ((r.comeback ?? 0) >= 15)
    addNews(l, { ...base, kind: 'comeback', emoji: '🔄', title: `${l.teams[sl.w].name} erase a ${r.comeback}-point hole`, text: `Down ${r.comeback}, ${l.teams[sl.w].name} came all the way back. ${sl.text}.`, playerIds: [], teamIds: [sl.w, sl.lo], weight: (r.comeback ?? 0) >= 22 ? 7 : 5 })
  if (r.ot > 0)
    addNews(l, { ...base, kind: 'overtime', emoji: '⏱️', title: r.ot >= 2 ? `${r.ot}OT marathon` : 'Overtime thriller', text: `${sl.text} after ${r.ot === 1 ? 'overtime' : `${r.ot} overtimes`}.`, playerIds: [], teamIds: [sl.w, sl.lo], weight: 2 + 2 * r.ot })
  for (const br of broken) {
    if (br.teamId !== null && br.teamId !== l.userTeamId) continue
    if (br.teamId === null && g.season < 2) continue
    if (!br.entry.prev || br.scope !== 'game') continue
    const who = name(l, br.entry.playerId)
    const scope = br.teamId ? `${l.teams[br.teamId].name} franchise` : 'league'
    addNews(l, { ...base, kind: 'record', emoji: '🏛️', title: `New ${scope} record`, text: `${who}: ${br.entry.value} ${RECORD_LABEL[br.stat].toLowerCase()} in a game, breaking ${br.entry.prev.value} by ${name(l, br.entry.prev.playerId)} (season ${br.entry.prev.season}).`, playerIds: [br.entry.playerId], teamIds: [br.entry.teamId], weight: br.teamId ? 6 : 9 })
  }
  if (!g.playoff)
    for (const id of [g.homeId, g.awayId]) {
      const s = streakOf(l, id)
      if (!STREAK_MARKS.includes(Math.abs(s))) continue
      const t = l.teams[id]
      addNews(l, { ...base, kind: 'streak', emoji: s > 0 ? '📈' : '🧊', title: s > 0 ? `${t.name} have won ${s} straight` : `${t.name} have lost ${-s} straight`, text: s > 0 ? `The ${t.city} ${t.name} are rolling: ${s} wins in a row.` : `It’s grim in ${t.city}: ${-s} losses in a row.`, playerIds: [], teamIds: [id], weight: 2 + Math.min(6, Math.abs(s) / 2) })
    }
}

/** A star (or the user's starter) goes down for a while. */
export function injuryNews(l: League, p: Player, inj: Injury): void {
  if (!p.teamId || (inj.severity !== 'long' && inj.severity !== 'season')) return
  const rank = teamPlayers(l, p.teamId).map(ovr).sort((a, b) => b - a).indexOf(ovr(p))
  if (ovr(p) < 72 && rank > 1 && p.teamId !== l.userTeamId) return
  const out = inj.severity === 'season' ? 'is out for the season' : `will miss about ${inj.gamesRemaining} games`
  addNews(l, { kind: 'injury', emoji: '🚑', title: `${pname(p)} hurt`, text: `${pname(p)} (${abbr(l, p.teamId)}) ${out} with a ${inj.type.toLowerCase()}.`, playerIds: [p.id], teamIds: [p.teamId], weight: inj.severity === 'season' ? 8 : 6 })
}

const ROUND_NAME = ['', 'first round', 'conference semifinals', 'conference finals', 'Finals']

export function seriesNews(l: League, s: Series): void {
  if (!s.winnerId) return
  const loser = s.winnerId === s.highSeedId ? s.lowSeedId : s.highSeedId
  const [w, lw] = s.winnerId === s.highSeedId ? [s.highWins, s.lowWins] : [s.lowWins, s.highWins]
  const t = l.teams[s.winnerId]
  if (s.round === 4) {
    addNews(l, { kind: 'champion', emoji: '🏆', title: `${t.city} ${t.name} are champions!`, text: `${t.name} beat the ${l.teams[loser].name} ${w}–${lw} in the Finals.`, playerIds: [], teamIds: [s.winnerId, loser], weight: 10 })
    return
  }
  const upset = s.winnerId === s.lowSeedId
  addNews(l, { kind: 'series', emoji: upset ? '😱' : '✅', title: `${t.name} advance${upset ? ' in an upset' : ''}`, text: `${t.name} took the ${ROUND_NAME[s.round]} series ${w}–${lw} over the ${l.teams[loser].name}.`, playerIds: [], teamIds: [s.winnerId, loser], weight: upset ? 6 : 3 + s.round })
}

/** Keeps this season's news and last season's bigger stories. */
export function pruneNews(l: League): void {
  l.news = l.news.filter((n) => n.season >= l.season || (n.season === l.season - 1 && n.weight >= 5))
}
