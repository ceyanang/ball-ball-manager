import { ROSTER_MAX } from '../constants'
import { GmError, log, ovr, pname, refreshRotation, teamPlayers, tname } from '../gm/cap'
import { rookieSalary, rookieYears } from '../gm/draft'
import { pickJersey } from '../player/jerseyNumber'
import type { Rng } from '../rng'
import { storyRng } from '../stories/state'
import type { DraftSlot, League } from '../types'
import { careerOvr } from './careerOvr'

export interface DraftPrompt {
  id: string; omen: string; title: string; text: string
  choices: { label: string; sub: string; tags: string[] }[]
}

/** What each hidden tag does: `stock` moves his draft stock, `wild` widens the luck, `contender`/`hometown` steer team interest. */
export const DRAFT_TAGS: Record<string, { stock?: number; wild?: number; contender?: number; hometown?: number }> = {
  'secret-workout': { stock: 0.08, wild: 0.5 },
  loud: { stock: 0.04, wild: 1.2 },
  'hometown-buzz': { stock: 0.02, hometown: 1.5 },
  humble: { stock: -0.02, contender: 1.0 },
  'combine-shine': { stock: 0.1 },
  'skipped-combine': { stock: -0.06, wild: 0.8 },
  'injury-whispers': { stock: -0.12, wild: 0.6 },
  'agent-hype': { stock: 0.06, wild: 1.0 },
  'film-room': { stock: 0.03, contender: 0.8 },
  'rebuild-pitch': { stock: 0.02, contender: -1.0 },
}

export const DRAFT_PROMPTS: DraftPrompt[] = [
  { id: 'workout', omen: 'A scout you don’t recognise is in the gym.', title: 'The private workout',
    text: 'One team asked for a closed-door session. The doors are locked. Nobody says what they want to see.',
    choices: [
      { label: 'Show everything', sub: 'Let it fly.', tags: ['secret-workout'] },
      { label: 'Hold something back', sub: 'Keep them guessing.', tags: ['humble'] },
      { label: 'Cancel it', sub: 'Your agent is furious.', tags: ['skipped-combine'] },
    ] },
  { id: 'combine', omen: 'The lights at the combine hum louder than they should.', title: 'Combine night',
    text: 'Every GM in the league is watching the drills. Your name is the one they keep writing down.',
    choices: [
      { label: 'Go all out', sub: 'Leave it on the floor.', tags: ['combine-shine'] },
      { label: 'Stay measured', sub: 'Nothing flashy.', tags: ['film-room'] },
      { label: 'Skip the scrimmage', sub: 'Rest the legs.', tags: ['skipped-combine'] },
    ] },
  { id: 'rumor', omen: 'Your phone buzzes at 3 a.m.', title: 'A whisper about your knee',
    text: 'Someone is saying something about your medicals. You can already hear the questions.',
    choices: [
      { label: 'Address it on camera', sub: 'Get ahead of it.', tags: ['loud'] },
      { label: 'Say nothing', sub: 'Let it blow over.', tags: ['injury-whispers'] },
      { label: 'Release your own tests', sub: 'Plain and boring.', tags: ['film-room'] },
    ] },
  { id: 'hometown', omen: 'The old gym smells the same.', title: 'Back where it started',
    text: 'The city wants a hometown hero. A banner has your face on it, a little crooked.',
    choices: [
      { label: 'Lean into it', sub: 'The cameras are rolling.', tags: ['hometown-buzz', 'loud'] },
      { label: 'Keep it quiet', sub: 'You’re here to work.', tags: ['humble'] },
    ] },
  { id: 'agent', omen: 'Your agent is smiling. That is never good.', title: 'The big call',
    text: 'He has a plan. Whatever it is, it involves a phone, a rumour, and a team you can’t name yet.',
    choices: [
      { label: 'Let him cook', sub: 'He knows people.', tags: ['agent-hype'] },
      { label: 'Do it your way', sub: 'You’d rather be judged on tape.', tags: ['film-room'] },
      { label: 'Tell the rebuilders you’ll stay', sub: 'A long-term pitch.', tags: ['rebuild-pitch'] },
    ] },
  { id: 'interview', omen: 'The room is colder than it should be.', title: 'The team interview',
    text: 'Four people at a long table. One of them has not looked up from their notes since you walked in.',
    choices: [
      { label: 'Charm them', sub: 'Big personality.', tags: ['loud'] },
      { label: 'Talk about winning', sub: 'Contenders will like that.', tags: ['humble', 'film-room'] },
      { label: 'Talk about building something', sub: 'Rebuilders will like that.', tags: ['rebuild-pitch'] },
    ] },
  { id: 'mentor', omen: 'An old vet leans on the rail and watches.', title: 'A word from a legend',
    text: 'He doesn’t introduce himself. He just says three words and walks away. You will remember them.',
    choices: [
      { label: 'Chase him down', sub: 'Ask what he meant.', tags: ['secret-workout'] },
      { label: 'Let it sit', sub: 'Some things ripen.', tags: ['humble'] },
    ] },
]

/** The three prompts this career's draft night asks, in order (deterministic for the save). */
export function pickPrompts(l: League): DraftPrompt[] {
  const rng = storyRng(l, 41)
  const pool = [...DRAFT_PROMPTS]
  const out: DraftPrompt[] = []
  while (out.length < 3 && pool.length) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0])
  return out
}

export function answerDraftPrompt(l: League, promptId: string, choice: number): void {
  const c = l.career
  if (!c || c.status !== 'draftNight') throw new GmError('Draft night is over.')
  const prompts = pickPrompts(l)
  const expected = prompts[c.draftAnswers.length]
  if (!expected || expected.id !== promptId) throw new GmError('That question isn’t next.')
  const ch = expected.choices[choice]
  if (!ch) throw new GmError('Pick one of the answers.')
  c.draftAnswers.push(choice)
  c.draftTags.push(...ch.tags)
}

const strength = (l: League, teamId: string): number => {
  const top = teamPlayers(l, teamId).map(ovr).sort((a, b) => b - a).slice(0, 8)
  return top.length ? top.reduce((s, v) => s + v, 0) / top.length : 0
}

/** Neutral pick order for the 60 slots: weakest teams first with some lottery-style luck; round 2 repeats it. */
function pickOrder(l: League, rng: Rng): string[] {
  const ranked = Object.keys(l.teams)
    .map((id) => ({ id, v: strength(l, id) + rng.normal(0, 1.5) }))
    .sort((a, b) => a.v - b.v || (a.id < b.id ? -1 : 1))
    .map((x) => x.id)
  return [...ranked, ...ranked]
}

/**
 * Runs draft night: his stock (Career OVR, the tags he picked, a little luck) sets a slot, team interest nudges which
 * nearby slot, then he joins that team on the rookie scale and the league starts following him.
 */
export function resolveCareerDraft(l: League, rng: Rng): { slot: number; teamId: string } {
  const c = l.career
  if (!c || c.status !== 'draftNight') throw new GmError('Draft night is over.')
  if (c.draftAnswers.length < 3) throw new GmError('Answer all three questions first.')
  const p = l.players[c.playerId]
  const tags = c.draftTags.map((t) => DRAFT_TAGS[t] ?? {})
  const sum = (f: (t: (typeof tags)[number]) => number) => tags.reduce((s, t) => s + f(t), 0)

  const stock = 0.5 + (careerOvr(p) - 68) * 0.015 + sum((t) => t.stock ?? 0) + rng.normal(0, 0.09 + 0.04 * sum((t) => t.wild ?? 0))
  const target = Math.max(1, Math.min(60, Math.round(2 + (1 - stock) * 27)))

  const order = pickOrder(l, rng)
  const ranks = new Map(Object.keys(l.teams).sort((a, b) => strength(l, b) - strength(l, a)).map((id, i) => [id, 1 - i / Math.max(1, Object.keys(l.teams).length - 1)]))
  const interest = (slot: number) => {
    const t = l.teams[order[slot - 1]]
    const home = p.hometown && p.hometown.includes(t.city) ? 1 : 0
    return sum((x) => (x.contender ?? 0) * ((ranks.get(t.id) ?? 0.5) - 0.5) * 2) + sum((x) => (x.hometown ?? 0) * home) + rng.normal(0, 0.3) - 0.15 * Math.abs(slot - target)
  }
  let slot = target
  let best = -Infinity
  for (let s = Math.max(1, target - 3); s <= Math.min(60, target + 3); s++) {
    const v = interest(s)
    if (v > best) { best = v; slot = s }
  }

  const teamId = order[slot - 1]
  const roster = teamPlayers(l, teamId)
  if (roster.length >= ROSTER_MAX) {
    const worst = [...roster].sort((a, b) => ovr(a) - ovr(b))[0]
    worst.teamId = null
    worst.contract = null
    log(l, 'release', [teamId], [worst.id], `${tname(l, teamId)} cleared a spot for their first-round pick by releasing ${pname(worst)}.`)
  }

  const round: 1 | 2 = slot <= 30 ? 1 : 2
  const ds: DraftSlot = { pick: slot, round, teamId, pickId: '', playerId: p.id }
  const used = new Set(teamPlayers(l, teamId).map((q) => q.jersey))
  let jersey = p.jersey
  for (let i = 0; used.has(jersey) && i < 200; i++) jersey = pickJersey(rng)
  p.jersey = jersey
  p.teamId = teamId
  p.contract = { salary: rookieSalary(ds), expires: l.season + rookieYears(ds) }
  p.draft = { season: l.season, round, pick: slot, teamId }

  l.userTeamId = teamId
  l.teams[teamId].rotation.auto = true
  refreshRotation(l, teamId)
  log(l, 'draft', [teamId], [p.id], `${tname(l, teamId)} drafted ${pname(p)} (${p.pos}) at #${slot}.`)
  c.log.push({ season: l.season, text: `Drafted #${slot} by ${tname(l, teamId)}.` })
  c.status = 'active'
  return { slot, teamId }
}
