import { ovr, pname } from '../gm/cap'
import type { Rng } from '../rng'
import type { Game, League, NewsItem, PersonaId, Player, Post, PostAuthor, Transaction } from '../types'
import { fanOf, popularity, teamFan } from './sentiment'
import { nextId, storyRng } from './state'

export const PERSONAS: Record<PersonaId, { name: string; handle: string; seed: number; bio: string }> = {
  insider: { name: 'Courtside Scoop', handle: 'CourtsideScoop', seed: 90211, bio: 'Sources say. Ball Ball League insider.' },
  stats: { name: 'Numbers Don’t Lie', handle: 'NumbersOnTheBall', seed: 31337, bio: 'Per-36, on/off, vibes-adjusted.' },
  hater: { name: 'Actually Mid', handle: 'ActuallyMid', seed: 66613, bio: 'Everyone is overrated. Especially your fave.' },
  superfan: { name: 'Ball Ball Believer', handle: 'BallBallBeliever', seed: 77777, bio: 'Every team is my team. LFG!!!' },
}

const MAX_POSTS = 400

const FIRST = ['hoop', 'bucket', 'swish', 'brick', 'glass', 'dunk', 'fastbreak', 'bench', 'courtside', 'nosebleed', 'rebound', 'splash', 'paint', 'lob', 'crossover', 'jumper']
const LAST = ['guy', 'queen', 'king', 'dad', 'mom', 'head', 'fiend', 'merchant', 'enjoyer', 'truther', 'szn', 'stan', 'goblin', 'oracle']
const NAMES = ['Dee', 'Marcus', 'Tasha', 'Lo', 'Jay', 'Priya', 'Benji', 'Kat', 'Ozzie', 'Remy', 'Nia', 'Gus', 'Yuki', 'Sal', 'Bree', 'Theo']

function fan(rng: Rng, l: League, teamId: string | null): PostAuthor {
  const t = teamId ? l.teams[teamId] : null
  const style = rng.int(0, 2)
  const handle = style === 0 && t ? `${t.name.replace(/\s/g, '')}${rng.pick(LAST)}${rng.int(1, 99)}`
    : style === 1 ? `${rng.pick(FIRST)}${rng.pick(LAST)}${rng.int(1, 999)}`
    : `${rng.pick(NAMES).toLowerCase()}_${t ? t.abbrev.toLowerCase() : rng.pick(FIRST)}${rng.int(1, 99)}`
  return { kind: 'fan', handle, name: rng.pick(NAMES), seed: rng.int(1, 2 ** 30), teamId }
}

interface PostOpts { playerIds?: string[]; teamIds?: string[]; gameId?: string; tone?: Post['tone']; size: number; pop?: number }

function post(l: League, rng: Rng, author: PostAuthor, text: string, o: PostOpts): void {
  const pop = o.pop ?? 30
  const likes = Math.round(pop * o.size * rng.float(0.5, 1.7) * (author.kind === 'fan' ? 0.25 : author.kind === 'player' ? 1.6 : 1))
  l.social.push({
    id: nextId(l, 'p'), season: l.season, day: l.day, author, text, likes, reposts: Math.round(likes * rng.float(0.04, 0.22)),
    playerIds: o.playerIds ?? [], teamIds: o.teamIds ?? [], gameId: o.gameId, tone: o.tone ?? 'neutral',
  })
}

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''))

const T = {
  statsBig: [
    '{player}: {pts} points tonight. That’s the kind of line that ends up on a wall somewhere. 📊',
    'Stat check 🧮 {player} — {line}. Efficiency? Absurd.',
    '{player} tonight: {line}. Put it in the museum. 🏛️',
  ],
  hypeBig: [
    '{PLAYER} IS HIM 🔥🔥🔥',
    'cancel my meetings i need to rewatch {player} tonight 😤',
    '{player} said "give me the ball" and nobody argued 🫡',
    'we are not worthy of {player} 🙇',
    '{player} cooking with gas rn 🧑‍🍳🔥',
  ],
  playerBig: ['Blessed 🙏 W', 'Just hoopin. On to the next 💯', 'Team win. That’s all that matters 🤝', '🔥🔥🔥', 'They left me open. Mistake 🤷‍♂️'],
  clutch: ['ICE IN HIS VEINS 🧊 {player}!!!', '{player} WITH THE DAGGER 🗡️', 'nah {player} is NOT human 😱', 'i was screaming. my neighbours were screaming. {player} 🚨'],
  insiderInjury: ['Sources: {player} ({team}) {out}. Tough blow.', 'Injury update 🚑 {player} {out}, per team sources.'],
  fanInjury: ['noooo not {player} 😭', 'season over man. {player} down 💔', 'praying for {player} 🙏'],
  hotTake: ['{player} is the best player in this league and it’s not close 🐐', 'Appreciation post for {player}. Hooper. 🔥', 'If you’re not watching {player} right now you’re doing it wrong 🍿'],
  roast: ['{player} has been invisible lately. Milk carton type stuff 🥛', 'Respectfully, what is {player} doing out there? 🧱🧱🧱', '{player} shooting like the rim owes him money 💀', 'Somebody check on {player}. Not in a nice way.'],
  boosReply: ['I hear y’all. Keep the same energy when I’m back on top 🤫', 'Tune out the noise. Back in the gym 🏋️', 'Love to the real ones. The rest… see you soon 😤'],
  complaint: ['I just want to compete. That’s all I’ll say 🤐', 'Tired of sitting. I know what I bring 💯', 'Need a role. Facts.', '👀'],
  tradeRequest: ['It’s time for a new chapter. Thank you {team} fans 🙏', 'Asked for a fresh start. Nothing but respect 🤝'],
  insiderTrade: ['🚨 TRADE: {text}', 'Breaking 🚨 {text} League sources confirm.'],
  fanTradeGood: ['WE FLEECED THEM 🤑', 'GM ate with this one 🍽️', 'LETS GOOOO welcome to the squad 🙌'],
  fanTradeBad: ['what did we just do 😐', 'fire the GM. into the sun. ☀️', 'i need an explanation for this trade immediately'],
  insiderSign: ['💰 {text}', 'Done deal: {text}'],
  winHype: ['WE ARE SO BACK 🔥', 'love this team man 😤', 'W. Next. 💪', 'that’s my squad!! {score}', 'playoff mode activated 🏁'],
  winMeh: ['ugly win but a W is a W 🤷', 'we’ll take it 😮‍💨', 'not pretty. still counts.'],
  lossCalm: ['tough one. bounce back next game 💪', 'L but we move 🫡', 'refs were cooked tonight tbh 🙄'],
  lossAngry: ['it’s so over 💀', 'fire everyone. EVERYONE.', 'i’m not watching the next one (i’m watching the next one) 😩', 'another L. cool. great. love that for us 🙃', '{score}?? embarrassing 🤡'],
  hater: ['{team} fans really thought 😂', 'Told y’all {team} were frauds 🤡', 'Imagine paying to watch {team} 💀'],
  award: ['Congrats {player} on {award}! 👏', '{award}: {player}. Deserved. 🏆', '{player} takes home {award} 🎉'],
  awardSelf: ['Grateful 🙏 {award}. Thank you to my teammates and coaches.', 'God is good 🙏 {award}!!', 'This one’s for the city 🏆'],
  champion: ['🏆 {TEAM} ARE CHAMPIONS 🏆', 'CHAMPIONSHIP PARADE WHEN??? 🎉🍾', '{team} run the league 💍'],
  championPlayer: ['CHAMPS 💍💍💍', 'We did it!!! 🏆 Love y’all', 'From day one 🙏 CHAMPIONS'],
  draft: ['With pick #{pick}, {team} take {player}. Big upside. 📋', 'Draft night: {player} goes #{pick} to {team}.'],
  draftFan: ['welcome {player}!!! future MVP 🔮', 'who?? 🤨 ok trust the process I guess', 'love this pick 🔥'],
  retire: ['{player} is calling it a career. What a run. 🫡', 'End of an era: {player} retires.'],
  hof: ['🎖️ Hall of Famer {player}. Legend.', 'First ballot. {player}. Say less. 🎖️'],
  coach: ['{text} 📋', 'Coaching change: {text}'],
}

const lineOf = (n: NewsItem) => n.text.split('. ')[0].replace(/\.$/, '')

/** Social reactions to everything that happened today: games, highlights, moves. */
export function socialDay(l: League, todaysGames: Game[], news: NewsItem[], txs: Transaction[]): void {
  const rng = storyRng(l, 77)
  const top = [...news].sort((a, b) => b.weight - a.weight).slice(0, 5)
  for (const n of top) {
    const pid = n.playerIds[0]
    const p = pid ? l.players[pid] : undefined
    const pop = popularity(l, p)
    const v = { player: p ? pname(p) : '', PLAYER: p ? pname(p).toUpperCase() : '', line: lineOf(n), team: n.teamIds[0] ? l.teams[n.teamIds[0]].name : '', pts: (n.text.match(/(\d+) (?:pts|points)|poured in (\d+)|scored (\d+)/)?.slice(1).find(Boolean) ?? '') }
    const base = { playerIds: n.playerIds, teamIds: n.teamIds, gameId: n.gameId, pop, size: n.weight }
    if (n.kind === 'bigGame' || n.kind === 'tripleDouble' || n.kind === 'careerHigh' || n.kind === 'rookie') {
      post(l, rng, { kind: 'persona', id: 'stats' }, fill(rng.pick(T.statsBig), v), base)
      post(l, rng, fan(rng, l, p?.teamId ?? null), fill(rng.pick(T.hypeBig), v), { ...base, tone: 'hype' })
      if (p && rng.chance(0.5)) post(l, rng, { kind: 'player', playerId: p.id }, rng.pick(T.playerBig), { ...base, tone: 'hype' })
    } else if (n.kind === 'gameWinner') {
      post(l, rng, fan(rng, l, p?.teamId ?? null), fill(rng.pick(T.clutch), v), { ...base, tone: 'hype' })
      if (p && rng.chance(0.6)) post(l, rng, { kind: 'player', playerId: p.id }, rng.pick(['Wanted that shot 🎯', 'Clutch genes 🧬', '🧊🧊🧊']), { ...base, tone: 'hype' })
    } else if (n.kind === 'injury' && p) {
      const out = n.text.includes('season') ? 'is out for the season' : n.text.match(/will miss about \d+ games/)?.[0] ?? 'will miss time'
      post(l, rng, { kind: 'persona', id: 'insider' }, fill(rng.pick(T.insiderInjury), { ...v, out }), base)
      post(l, rng, fan(rng, l, p.teamId), fill(rng.pick(T.fanInjury), v), base)
    } else if (n.kind === 'record' || n.kind === 'comeback' || n.kind === 'overtime' || n.kind === 'streak' || n.kind === 'series') {
      post(l, rng, { kind: 'persona', id: n.kind === 'record' ? 'stats' : 'superfan' }, `${n.emoji} ${n.title}. ${lineOf(n)}.`, base)
      if (n.kind === 'streak' && n.title.includes('lost')) post(l, rng, { kind: 'persona', id: 'hater' }, fill(rng.pick(T.hater), v), { ...base, tone: 'roast' })
    } else if (n.kind === 'champion') {
      const tm = l.teams[n.teamIds[0]]
      post(l, rng, { kind: 'persona', id: 'superfan' }, fill(rng.pick(T.champion), { team: tm.name, TEAM: tm.name.toUpperCase() }), { ...base, size: 10, pop: 120, tone: 'hype' })
      const stars = Object.values(l.players).filter((x) => x.teamId === tm.id).sort((a, b) => ovr(b) - ovr(a)).slice(0, 2)
      for (const s of stars) post(l, rng, { kind: 'player', playerId: s.id }, rng.pick(T.championPlayer), { ...base, playerIds: [s.id], pop: popularity(l, s), tone: 'hype' })
    }
  }

  // The user's fans react to every game.
  const mine = todaysGames.find((g) => g.result && (g.homeId === l.userTeamId || g.awayId === l.userTeamId))
  if (mine) {
    const r = mine.result!
    const home = mine.homeId === l.userTeamId
    const [us, them] = home ? [r.homeScore, r.awayScore] : [r.awayScore, r.homeScore]
    const won = us > them
    const mood = teamFan(l, l.userTeamId)
    const pool = won ? (us - them >= 8 || mood > 20 ? T.winHype : T.winMeh) : mood < -10 || them - us >= 15 ? T.lossAngry : T.lossCalm
    const v = { score: `${us}-${them}`, team: l.teams[l.userTeamId].name }
    post(l, rng, fan(rng, l, l.userTeamId), fill(rng.pick(pool), v), { teamIds: [l.userTeamId], gameId: mine.id, size: 3, tone: won ? 'hype' : 'roast' })
    if (!won && rng.chance(0.25)) post(l, rng, { kind: 'persona', id: 'hater' }, fill(rng.pick(T.hater), v), { teamIds: [l.userTeamId], gameId: mine.id, size: 3, tone: 'roast' })
  }

  transactionPosts(l, rng, txs)

  // Hot and cold takes every few days.
  if (l.day % 3 === 0 && l.phase !== 'offseason') {
    const known = Object.values(l.players).filter((p) => p.teamId && !p.retired && ovr(p) >= 68)
    const hot = known.reduce<Player | null>((a, b) => (!a || fanOf(l, b.id) > fanOf(l, a.id) ? b : a), null)
    const cold = known.reduce<Player | null>((a, b) => (!a || fanOf(l, b.id) < fanOf(l, a.id) ? b : a), null)
    if (hot && fanOf(l, hot.id) > 30) post(l, rng, { kind: 'persona', id: 'superfan' }, fill(rng.pick(T.hotTake), { player: pname(hot) }), { playerIds: [hot.id], teamIds: [hot.teamId!], size: 4, pop: popularity(l, hot), tone: 'hype' })
    if (cold && fanOf(l, cold.id) < -30) {
      post(l, rng, { kind: 'persona', id: 'hater' }, fill(rng.pick(T.roast), { player: pname(cold) }), { playerIds: [cold.id], teamIds: [cold.teamId!], size: 4, pop: popularity(l, cold), tone: 'roast' })
      if (fanOf(l, cold.id) < -55 && rng.chance(0.35)) post(l, rng, { kind: 'player', playerId: cold.id }, rng.pick(T.boosReply), { playerIds: [cold.id], size: 3, pop: popularity(l, cold) })
    }
  }
  trimSocial(l)
}

function transactionPosts(l: League, rng: Rng, txs: Transaction[]): void {
  let n = 0
  for (const tx of txs) {
    if (n >= 4) break
    const players = tx.playerIds.map((id) => l.players[id]).filter(Boolean)
    const star = players.reduce<Player | null>((a, b) => (!a || ovr(b) > ovr(a) ? b : a), null)
    const pop = popularity(l, star ?? undefined)
    const base = { playerIds: tx.playerIds, teamIds: tx.teamIds, pop }
    if (tx.type === 'trade') {
      n++
      post(l, rng, { kind: 'persona', id: 'insider' }, fill(rng.pick(T.insiderTrade), { text: tx.text }), { ...base, size: 7 })
      const side = tx.teamIds.includes(l.userTeamId) ? l.userTeamId : tx.teamIds[0]
      post(l, rng, fan(rng, l, side), rng.pick(rng.chance(0.55) ? T.fanTradeGood : T.fanTradeBad), { ...base, size: 4 })
    } else if ((tx.type === 'sign' || tx.type === 'resign') && star && (ovr(star) >= 72 || tx.teamIds.includes(l.userTeamId))) {
      n++
      post(l, rng, { kind: 'persona', id: 'insider' }, fill(rng.pick(T.insiderSign), { text: tx.text }), { ...base, size: 5 })
      if (rng.chance(0.5)) post(l, rng, { kind: 'player', playerId: star.id }, rng.pick(['New chapter. Let’s work 💪', 'Home 🏠', 'Blessed 🙏 Let’s get it', '✍️']), { ...base, size: 4 })
    } else if (tx.type === 'draft' && star?.draft && (star.draft.pick <= 3 || tx.teamIds.includes(l.userTeamId)) && star.draft.round === 1) {
      n++
      const v = { pick: star.draft.pick, team: l.teams[tx.teamIds[0]].name, player: pname(star) }
      post(l, rng, { kind: 'persona', id: 'insider' }, fill(rng.pick(T.draft), v), { ...base, size: 5 })
      post(l, rng, fan(rng, l, tx.teamIds[0]), fill(rng.pick(T.draftFan), v), { ...base, size: 3 })
    } else if (tx.type === 'fire' || (tx.type === 'hire' && tx.teamIds.includes(l.userTeamId))) {
      n++
      post(l, rng, { kind: 'persona', id: 'insider' }, fill(rng.pick(T.coach), { text: tx.text }), { ...base, size: 4 })
    } else if (tx.type === 'retire' && star && ovr(star) >= 72) {
      n++
      post(l, rng, { kind: 'persona', id: 'stats' }, fill(rng.pick(T.retire), { player: pname(star) }), { ...base, size: 5 })
    }
  }
}

/** Offseason chatter: moves made during a step, plus awards/HoF headlines from it. */
export function socialOffseason(l: League, news: NewsItem[], txs: Transaction[]): void {
  const rng = storyRng(l, 78)
  for (const n of news) {
    const pid = n.playerIds[0]
    const p = pid ? l.players[pid] : undefined
    if (!p) continue
    const base = { playerIds: n.playerIds, teamIds: n.teamIds, pop: popularity(l, p), size: n.weight }
    if (n.kind === 'award') {
      const award = n.title.split(': ')[1] ?? 'the award'
      post(l, rng, { kind: 'persona', id: 'stats' }, fill(rng.pick(T.award), { player: pname(p), award }), base)
      if (!p.retired) post(l, rng, { kind: 'player', playerId: p.id }, fill(rng.pick(T.awardSelf), { award }), { ...base, tone: 'hype' })
    } else if (n.kind === 'hof') post(l, rng, { kind: 'persona', id: 'superfan' }, fill(rng.pick(T.hof), { player: pname(p) }), { ...base, tone: 'hype' })
  }
  transactionPosts(l, rng, txs)
  trimSocial(l)
}

/** A player speaks up about his mood (minutes complaints, trade requests). */
export function moodPost(l: League, p: Player, kind: 'complaint' | 'tradeRequest'): void {
  const rng = storyRng(l, 79 + p.faceSeed % 1000)
  const team = p.teamId ? l.teams[p.teamId].name : ''
  post(l, rng, { kind: 'player', playerId: p.id }, fill(rng.pick(T[kind]), { team }), { playerIds: [p.id], teamIds: p.teamId ? [p.teamId] : [], size: kind === 'tradeRequest' ? 7 : 3, pop: popularity(l, p) })
  if (kind === 'tradeRequest') post(l, rng, { kind: 'persona', id: 'insider' }, `Sources: ${pname(p)} has asked ${team} for a trade. 👀`, { playerIds: [p.id], teamIds: p.teamId ? [p.teamId] : [], size: 7, pop: popularity(l, p) })
}

function trimSocial(l: League): void {
  if (l.social.length > MAX_POSTS) l.social = l.social.slice(-MAX_POSTS)
}
