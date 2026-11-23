import { pname } from '../gm/cap'
import type { Game, Injury, League, NewsItem } from '../types'
import { AWARD_NAMES, awardNews, computeAwards, induct, seasonHistory } from './awards'
import { addNews, gameHighlights, injuryNews, pruneNews, seriesNews } from './highlights'
import { expireOffers, injuryPing, maybeAiOffer, offseasonInbox, ping, returnPing, weeklyInbox } from './inbox'
import { RECORD_LABEL, careerRecords, gameRecords, seasonRecords, type Broken } from './records'
import { updateFans, weeklyMorale } from './sentiment'
import { socialDay, socialOffseason } from './social'

/**
 * The only entry points the season engine calls. Everything here is flavour and bookkeeping: none of it draws from
 * the league's sim RNG, so stories never change results.
 */

/** Right after a game is simmed and its stats are in. */
export function afterGame(l: League, g: Game): void {
  const r = g.result
  if (!r) return
  const highs: Record<string, { gp: number; pts: number }> = {}
  for (const b of r.box) {
    if (b.min <= 0) continue
    const h = (l.careerHighs[b.playerId] ??= { gp: 0, pts: 0, reb: 0, ast: 0 })
    highs[b.playerId] = { gp: h.gp, pts: h.pts }
    h.gp++
    h.pts = Math.max(h.pts, b.pts)
    h.reb = Math.max(h.reb, b.oreb + b.dreb)
    h.ast = Math.max(h.ast, b.ast)
  }
  const broken = gameRecords(l, g)
  gameHighlights(l, g, broken, highs)
  updateFans(l, g)
}

export function onInjury(l: League, playerId: string, inj: Injury): void {
  const p = l.players[playerId]
  injuryNews(l, p, inj)
  injuryPing(l, p, inj)
}

export function onReturn(l: League, playerId: string): void {
  returnPing(l, l.players[playerId])
}

export function onSeriesDecided(l: League, seriesIds: string[]): void {
  for (const s of l.playoffs?.series ?? []) if (seriesIds.includes(s.id)) seriesNews(l, s)
}

function recordNews(l: League, broken: Broken[]): void {
  for (const br of broken) {
    if (br.teamId !== null || !br.entry.prev || l.season < 2) continue
    const who = pname(l.players[br.entry.playerId])
    const what = br.scope === 'season' ? `${br.entry.value} ${RECORD_LABEL[br.stat].toLowerCase()} per game in a season` : `${br.entry.value} career ${RECORD_LABEL[br.stat].toLowerCase()}`
    addNews(l, { kind: 'record', emoji: '🏛️', title: `${who} sets a league record`, text: `${who}: ${what}, passing ${br.entry.prev.value} by ${pname(l.players[br.entry.prev.playerId])}.`, playerIds: [br.entry.playerId], teamIds: [br.entry.teamId], weight: 8 })
  }
}

export function onRegularSeasonEnd(l: League): void {
  recordNews(l, seasonRecords(l, l.season))
}

/** The Finals just ended (before progression): awards, history, career records. */
export function onSeasonEnd(l: League): void {
  const a = computeAwards(l)
  l.awards = l.awards.filter((x) => x.season !== a.season)
  l.awards.push(a)
  l.history = l.history.filter((x) => x.season !== l.season)
  l.history.push(seasonHistory(l))
  recordNews(l, careerRecords(l, l.season))
  awardNews(l, a)
  const me = l.userTeamId
  for (const k of ['mvp', 'finalsMvp', 'dpoy', 'roy', 'smoy', 'mip'] as const) {
    const id = a[k]
    if (id && l.players[id].teamId === me) ping(l, 'award', `award:${k}:${a.season}`, `🏅 ${pname(l.players[id])}: ${AWARD_NAMES[k]}`, `Your guy took home ${AWARD_NAMES[k]} for season ${a.season}.`, `/player/${id}`)
  }
  if (a.coy?.teamId === me) {
    const c = l.coaches[a.coy.coachId]
    ping(l, 'award', `award:coy:${a.season}`, `🏅 ${c.firstName} ${c.lastName}: Coach of the Year`, 'Your coach got the league’s nod for Coach of the Year.', '/office')
  }
}

/** Called with players who just retired (offseason or unsigned at season start). */
export function onRetired(l: League, playerIds: string[]): void {
  for (const id of induct(l, playerIds)) {
    const p = l.players[id]
    if (l.awards.some((a) => a.championRoster.includes(id)) || p.draft?.teamId === l.userTeamId)
      ping(l, 'award', `hof:${id}`, `🎖️ ${pname(p)} makes the Hall of Fame`, `${pname(p)} has been inducted into the Hall of Fame.`, `/player/${id}`)
  }
}

/** End of each in-season day. Returns true when a trade offer for the user just arrived. */
export function afterDay(l: League, games: Game[], newsFrom: number, txFrom: number): boolean {
  let offer = false
  expireOffers(l)
  if (l.phase === 'regular' && l.day % 7 === 0) {
    weeklyInbox(l, weeklyMorale(l))
    if (l.day <= l.tradeDeadlineDay) offer = maybeAiOffer(l)
  }
  socialDay(l, games, l.news.slice(newsFrom), l.transactions.slice(txFrom))
  return offer
}

/** After an offseason step or a free-agency day. */
export function afterOffseason(l: League, newsFrom: number, txFrom: number, faTick: boolean): void {
  expireOffers(l)
  if (faTick && l.offseason?.step === 'freeAgency' && l.offseason.faDay % 5 === 0) maybeAiOffer(l, 0.4)
  const news: NewsItem[] = l.news.slice(newsFrom)
  socialOffseason(l, news, l.transactions.slice(txFrom))
}

export function onOffseasonStart(l: League): void {
  offseasonInbox(l)
}

export function onNewSeason(l: League): void {
  pruneNews(l)
  for (const k of Object.keys(l.fans.players)) {
    if (!l.players[k] || l.players[k].retired) delete l.fans.players[k]
    else l.fans.players[k] = Math.round(l.fans.players[k] * 0.5)
  }
  for (const k of Object.keys(l.fans.teams)) l.fans.teams[k] = Math.round(l.fans.teams[k] * 0.3)
  for (const k of Object.keys(l.careerHighs)) if (!l.players[k]) delete l.careerHighs[k]
}
