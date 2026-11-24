import type { EventCtx } from '../types'
import { bench, buff, chem, event, fans, morale, starter, teamBuff, teamFans, teamMorale, young, type Spec } from './helpers'

const won = (c: EventCtx) => !!c.userGame?.won
const lost = (c: EventCtx) => !!c.userGame && !c.userGame.won
const margin = (c: EventCtx) => c.userGame?.margin ?? 0

const S: Spec[] = [
  {
    id: 'post-blowout-win', when: 'postGame', emoji: '🎉', needs: (c) => won(c) && margin(c) >= 18, title: () => 'A blowout win!',
    text: (n) => `The team crushed it. The locker room is loud. Coach ${n.last}, how do you handle the party?`,
    choices: [
      { label: 'Celebrate big', emoji: '🥳', out: [[3, 'good', () => 'A great night. The team is high on life.', () => [teamMorale(5), chem(3)]], [2, 'bad', () => 'Things got out of hand. A few sore heads tomorrow.', () => [teamBuff('energy', -15, 1)]]] },
      { label: 'Stay humble', emoji: '🧘', out: [[2, 'good', () => 'Focused. Hungry. Locked in for the next one.', () => [teamBuff('defense', 2, 3)]], [2, 'neutral', () => 'The room deflates a little. Fine.', () => [teamMorale(-1)]]] },
      { label: 'Film session at midnight', emoji: '🎞️', out: [[1, 'good', () => 'Everyone learns something. Respect for the grind.', () => [chem(2), teamBuff('all', 1, 3)]], [3, 'bad', () => 'Nobody wanted that. Rolling eyes everywhere.', () => [teamMorale(-4)]]] },
    ],
  },
  {
    id: 'post-blowout-loss', when: 'postGame', emoji: '😵', needs: (c) => lost(c) && margin(c) >= 18, title: () => 'A humiliating loss',
    text: () => 'That was ugly. The locker room is dead silent. Somebody has to say something.',
    choices: [
      { label: 'Players-only meeting', emoji: '🗣️', out: [[2, 'good', () => 'The vets speak up. Honesty clears the air.', () => [chem(4), teamMorale(2)]], [2, 'bad', () => 'It turns into a shouting match.', () => [chem(-4)]]] },
      { label: 'Early-morning practice', emoji: '⏰', out: [[2, 'good', () => 'The team responds with a sharp, focused practice.', () => [teamBuff('defense', 3, 2)]], [3, 'bad', () => 'The team is exhausted and bitter.', () => [teamMorale(-5), teamBuff('energy', -15, 1)]]] },
      { label: 'Give them the day off', emoji: '🏖️', out: [[2, 'good', () => 'A reset day does wonders.', () => [teamMorale(6)]], [2, 'bad', () => 'The media calls it soft. Fans fume.', () => [teamFans(-5)]]] },
    ],
  },
  {
    id: 'post-clutch-win', when: 'postGame', emoji: '😮‍💨', needs: (c) => won(c) && margin(c) <= 4, title: () => 'A nail-biting win',
    text: () => 'The team survived by the skin of its teeth. The bench is jumping, the starters are wiped.',
    choices: [
      { label: 'Praise the grit', emoji: '💪', out: [[3, 'good', () => 'Confidence soars.', () => [teamMorale(4), chem(2)]], [1, 'bad', () => 'It goes to their heads. Complacency creeps in.', () => [teamBuff('defense', -2, 2)]]] },
      { label: 'Point out the mistakes', emoji: '📝', out: [[2, 'good', () => 'The team sharpens up.', () => [teamBuff('all', 1, 3)]], [2, 'bad', () => 'Nobody likes a lecture after a win.', () => [teamMorale(-3)]]] },
      { label: 'Ice cream for everybody', emoji: '🍦', out: [[3, 'good', () => 'Pure joy.', () => [chem(3)]], [1, 'neutral', () => 'Ice cream is ice cream.', () => []]] },
    ],
  },
  {
    id: 'post-clutch-loss', when: 'postGame', emoji: '💔', needs: (c) => lost(c) && margin(c) <= 4, title: () => 'A heartbreaker',
    text: () => 'The team lost on a coin-flip finish. Players are devastated. Some blame the last possession.',
    choices: [
      { label: 'It was nobody\'s fault', emoji: '🫶', out: [[3, 'good', () => 'The team rallies. No finger-pointing.', () => [chem(3), teamMorale(2)]], [1, 'bad', () => 'Some feel accountability is missing.', () => [chem(-2)]]] },
      { label: 'Break down the last play', emoji: '📋', out: [[2, 'good', () => 'Clear lessons. Better prepared.', () => [teamBuff('all', 1, 3)]], [2, 'bad', () => 'You accidentally single out a young guy.', () => [chem(-3)]]] },
      { label: 'Move on, no talking', emoji: '🚪', out: [[1, 'neutral', () => 'Everyone goes home quietly.', () => []], [1, 'bad', () => 'Resentment simmers.', () => [teamMorale(-3)]]] },
    ],
  },
  {
    id: 'post-dinner', when: 'postGame', emoji: '🍽️', who: starter, needs: won, title: (n) => `${n.last} wants to buy the team dinner`,
    text: (n) => `After a win, ${n.full} announces he's buying a steakhouse dinner. The rookies' eyes light up.`,
    choices: [
      { label: 'Say yes', emoji: '🥩', out: [[3, 'good', (n) => `${n.last} picks up the check and a leader is born.`, (id) => [morale(id, 5), chem(3), fans(id, 2)]], [1, 'bad', () => 'Someone posts the receipt. Awkward.', (id) => [fans(id, -3)]]] },
      { label: 'Split the bill', emoji: '🧾', out: [[2, 'neutral', () => 'A fine dinner. A lot of math.', () => []], [1, 'good', () => 'Everybody feels like part of it.', () => [chem(2)]]] },
      { label: 'Team curfew instead', emoji: '🌙', out: [[1, 'good', () => 'The team sleeps well.', () => [teamBuff('energy', 10, 2)]], [3, 'bad', (n) => `${n.last} rolls his eyes.`, (id) => [morale(id, -4)]]] },
    ],
  },
  {
    id: 'post-rant', when: 'postGame', emoji: '🗯️', who: starter, needs: lost, title: (n) => `${n.last} is fuming`,
    text: (n) => `${n.full} is stomping through the tunnel and the cameras are rolling. A press-room rant looks likely.`,
    choices: [
      { label: 'Let him speak his mind', emoji: '📣', out: [[2, 'good', (n) => `${n.last} says what everyone's thinking. Fans love the honesty.`, (id) => [fans(id, 8), chem(1)]], [3, 'bad', (n) => `${n.last} throws a teammate under the bus.`, (id) => [fans(id, -5), chem(-4)]]] },
      { label: 'Cool him down first', emoji: '🧊', out: [[3, 'good', (n) => `${n.last} calms down and gives a classy answer.`, (id) => [morale(id, 3), fans(id, 3)]], [1, 'bad', (n) => `${n.last} resents being managed.`, (id) => [morale(id, -4)]]] },
      { label: 'Skip the press room', emoji: '🚷', out: [[2, 'neutral', () => 'The story fades by morning.', () => []], [1, 'bad', () => 'The press says the team is hiding.', () => [teamFans(-3)]]] },
    ],
  },
  {
    id: 'post-fan-item', when: 'postGame', emoji: '🧢', needs: (c) => !!c.userGame, title: () => 'A fan threw a hat on the court',
    text: () => 'A fan tossed an expensive hat during the final possession. Security wants a decision.',
    choices: [
      { label: 'Ban him', emoji: '🚫', out: [[2, 'good', () => 'The crowd cheers the zero-tolerance policy.', () => [teamFans(3)]], [2, 'bad', () => 'It was a kid. Terrible optics.', () => [teamFans(-6)]]] },
      { label: 'Give the hat back with a signature', emoji: '✍️', out: [[3, 'good', () => 'A viral wholesome moment.', () => [teamFans(5)]], [1, 'neutral', () => 'Nobody cares.', () => []]] },
      { label: 'Ignore it', emoji: '🙈', out: [[1, 'neutral', () => 'The hat disappears.', () => []]] },
    ],
  },
  {
    id: 'post-jerseyswap', when: 'postGame', emoji: '👕', who: starter, needs: won, title: (n) => `${n.last} was asked for a jersey swap`,
    text: (n) => `The opposing star wants to swap jerseys with ${n.full} on the court. Cameras are everywhere.`,
    choices: [
      { label: 'Go for it', emoji: '🤝', out: [[3, 'good', (n) => `${n.last} and the star share a classy moment.`, (id) => [fans(id, 6)]], [1, 'bad', (n) => `The star was just using ${n.last} for content.`, (id) => [fans(id, -2), morale(id, -2)]]] },
      { label: 'Decline politely', emoji: '🙏', out: [[2, 'neutral', () => 'Respect on both sides.', () => []], [1, 'bad', () => 'It reads as arrogant.', (id) => [fans(id, -4)]]] },
      { label: 'Auction the jersey for charity', emoji: '🏷️', out: [[2, 'good', () => 'The auction goes wild. Great PR.', (id) => [fans(id, 8), teamFans(3)]], [1, 'bad', () => 'Auction scandal over the pricing.', () => [teamFans(-3)]]] },
    ],
  },
  {
    id: 'post-gameball', when: 'postGame', emoji: '🏀', who: young, needs: won, title: (n) => `${n.last} wants the game ball`,
    text: (n) => `Rookie ${n.full} wants to keep the game ball. The vets say it's tradition to earn it.`,
    choices: [
      { label: 'Give it to him', emoji: '🎁', out: [[3, 'good', (n) => `${n.last} beams. Confidence boost.`, (id) => [morale(id, 8), buff(id, 'shooting', 2, 2)]], [2, 'bad', () => 'The vets feel disrespected.', (id) => [morale(id, 3), chem(-3)]]] },
      { label: 'Let vets decide', emoji: '🗳️', out: [[2, 'good', () => 'A teachable moment. Fair and fun.', () => [chem(3)]], [2, 'bad', (n) => `${n.last} gets the ball... after a 10-minute hazing.`, (id) => [morale(id, -4)]]] },
      { label: 'Put it in the trophy case', emoji: '🏆', out: [[1, 'neutral', () => 'The ball sits in a glass case. Nobody argues.', () => []]] },
    ],
  },
  {
    id: 'post-benchmob', when: 'postGame', emoji: '🪑', who: bench, needs: won, title: (n) => `${n.last} celebrated too hard`,
    text: (n) => `${n.full}, who barely played, did a wild celebration on the bench and fell off his chair. It's already a meme.`,
    choices: [
      { label: 'Roll with it', emoji: '😂', out: [[3, 'good', (n) => `${n.last} becomes the team's mascot-in-spirit.`, (id) => [fans(id, 8), morale(id, 5)]], [1, 'bad', () => 'Starters think it\'s disrespectful.', () => [chem(-2)]]] },
      { label: 'Make him stop', emoji: '🛑', out: [[1, 'good', () => 'Discipline restored. Everyone is serious.', () => [chem(1)]], [3, 'bad', (n) => `${n.last} is deflated.`, (id) => [morale(id, -5)]]] },
      { label: 'Make it a team celebration', emoji: '🎊', out: [[2, 'good', () => 'The whole bench goes wild. Tradition born.', () => [chem(4)]], [1, 'bad', () => 'A teammate sprains a thumb dancing.', () => [teamBuff('energy', -10, 1)]]] },
    ],
  },
  {
    id: 'post-ejected', when: 'postGame', emoji: '🟥', needs: lost, title: (n) => `Coach ${n.last} got ejected`,
    text: (n) => `After a missed call, Coach ${n.full} was tossed. The league may fine him. The team loves the fire.`,
    choices: [
      { label: 'Back the coach', emoji: '🙌', out: [[2, 'good', () => 'The team loves that the coach has their back.', () => [chem(3), teamMorale(3)]], [2, 'bad', () => 'The league fines the team.', () => [teamFans(-2)]]] },
      { label: 'Apologize publicly', emoji: '🙏', out: [[2, 'neutral', () => 'The story dies down.', () => []], [1, 'bad', () => 'The players feel the coach caved.', () => [chem(-2)]]] },
      { label: 'Frame the ref\'s whistle', emoji: '🖼️', out: [[1, 'good', () => 'A hilarious stunt. The fans eat it up.', () => [teamFans(6)]], [2, 'bad', () => 'The league is not amused.', () => [teamFans(-4)]]] },
    ],
  },
  {
    id: 'post-celebrate-star', when: 'postGame', emoji: '⭐', who: starter, needs: won, title: (n) => `${n.last} is the talk of the town`,
    text: (n) => `${n.full} was incredible tonight. Local radio wants him on air. He wants to go.`,
    choices: [
      { label: 'Go on air', emoji: '📻', out: [[3, 'good', (n) => `${n.last} charms the city.`, (id) => [fans(id, 8), morale(id, 3)]], [2, 'bad', (n) => `${n.last} says something spicy about a teammate.`, (id) => [fans(id, -3), chem(-3)]]] },
      { label: 'Send the whole team', emoji: '👥', out: [[2, 'good', () => 'A fun, chaotic radio hit.', () => [teamFans(4), chem(2)]], [1, 'neutral', () => 'Nobody remembers it.', () => []]] },
      { label: 'Not tonight', emoji: '😴', out: [[1, 'neutral', () => 'He goes home to sleep.', () => []], [2, 'bad', (n) => `${n.last} is annoyed.`, (id) => [morale(id, -4)]]] },
    ],
  },
  {
    id: 'post-gamewinner', when: 'postGame', emoji: '🎯', who: starter, needs: (c) => won(c) && margin(c) <= 3, title: (n) => `${n.last} wants credit for the game-winner`,
    text: (n) => `${n.full} is telling every reporter the late bucket was "all him". A teammate set the screen and is not thrilled.`,
    choices: [
      { label: 'Let him have his moment', emoji: '🌟', out: [[2, 'good', (n) => `${n.last} is all over the highlights.`, (id) => [fans(id, 8), morale(id, 4)]], [2, 'bad', () => 'The screener stews. The room notices.', () => [chem(-3)]]] },
      { label: 'Praise the screen in the presser', emoji: '🧱', out: [[3, 'good', () => 'The team-first message lands.', () => [chem(3)]], [1, 'bad', (n) => `${n.last} feels upstaged.`, (id) => [morale(id, -4)]]] },
      { label: 'Say nothing', emoji: '🤐', out: [[2, 'neutral', () => 'The news cycle moves on.', () => []], [1, 'bad', () => 'A little grumbling in the locker room.', () => [chem(-1)]]] },
    ],
  },
  {
    id: 'post-hotseat', when: 'postGame', emoji: '🔥', needs: lost, title: (n) => `Coach ${n.last} is asked about his job`,
    text: () => 'After the loss, a reporter asks if you think you\'ll be fired. The room goes quiet. The cameras zoom in.',
    choices: [
      { label: 'Laugh it off', emoji: '😂', out: [[2, 'good', () => 'A great line. The clip goes viral for the right reasons.', () => [teamFans(4)]], [1, 'bad', () => 'It reads as not caring.', () => [teamFans(-4)]]] },
      { label: 'Defend your players', emoji: '🛡️', out: [[3, 'good', () => 'The locker room hears about it and loves it.', () => [teamMorale(4), chem(2)]], [1, 'bad', () => 'Fans call it excuses.', () => [teamFans(-3)]]] },
      { label: 'Walk out', emoji: '🚪', out: [[1, 'good', () => 'Weirdly iconic.', () => [teamFans(2)]], [2, 'bad', () => 'The league office is not amused. Neither are the fans.', () => [teamFans(-6)]]] },
    ],
  },
  {
    id: 'post-flight', when: 'postGame', emoji: '✈️', needs: (c) => !!c.userGame, title: () => 'The team plane is delayed',
    text: () => 'Mechanical issue. The plane is stuck on the tarmac for four hours. The team is stuck with it.',
    choices: [
      { label: 'Book a hotel for the night', emoji: '🏨', out: [[2, 'good', () => 'Everyone sleeps. Crisis averted.', () => [teamBuff('energy', 8, 1)]], [1, 'bad', () => 'The hotel is terrible. Nobody sleeps anyway.', () => [teamBuff('energy', -10, 1)]]] },
      { label: 'Wait it out, order pizza', emoji: '🍕', out: [[2, 'good', () => 'An impromptu party on the plane.', () => [chem(3)]], [2, 'bad', () => 'Grumpy, cramped, exhausted.', () => [teamBuff('energy', -12, 1), teamMorale(-2)]]] },
      { label: 'Charter a different plane', emoji: '💸', out: [[2, 'good', () => 'Home in time for bed.', () => [teamMorale(2)]], [1, 'bad', () => 'It\'s a tiny plane. Turbulence. Screaming.', () => [teamMorale(-3)]]] },
    ],
  },
  {
    id: 'post-refrant', when: 'postGame', emoji: '📢', who: starter, needs: (c) => lost(c) && margin(c) <= 6, title: (n) => `${n.last} wants to blast the refs`,
    text: (n) => `${n.full} is heading for the microphones and says he's going to "tell the truth" about tonight's officiating.`,
    choices: [
      { label: 'Let him speak', emoji: '🎙️', out: [[2, 'good', (n) => `Fans love ${n.last}'s fire.`, (id) => [fans(id, 6), morale(id, 4)]], [2, 'bad', (n) => `The league fines ${n.last}. He is fuming.`, (id) => [morale(id, -6)]]] },
      { label: 'Pull him aside first', emoji: '🤚', out: [[2, 'good', () => 'He cools down. Smart quotes only.', (id) => [morale(id, 1)]], [1, 'bad', (n) => `${n.last} says you muzzled him.`, (id) => [morale(id, -5)]]] },
      { label: 'You take the heat instead', emoji: '🧯', out: [[2, 'good', () => 'Your players see you have their back.', () => [teamMorale(3), chem(2)]], [1, 'bad', () => 'You get fined. The front office sighs.', () => [teamFans(-2)]]] },
    ],
  },
  {
    id: 'post-rookieblame', when: 'postGame', emoji: '😔', who: young, needs: lost, title: (n) => `${n.last} blames himself`,
    text: (n) => `${n.full} is sitting alone at his locker, still in uniform. He thinks the loss is on him.`,
    choices: [
      { label: 'Talk to him yourself', emoji: '🫂', out: [[3, 'good', (n) => `${n.last} leaves feeling better.`, (id) => [morale(id, 7)]], [1, 'neutral', () => 'He nods a lot. Hard to tell.', () => []]] },
      { label: 'Send a vet over', emoji: '🧓', out: [[2, 'good', () => 'The vet shares his own rookie horror stories. Bonding.', (id) => [morale(id, 5), chem(2)]], [1, 'bad', () => 'The vet is not great at pep talks.', (id) => [morale(id, -3)]]] },
      { label: 'Let him sit with it', emoji: '🪑', out: [[1, 'good', (n) => `${n.last} comes back hungry.`, (id) => [buff(id, 'all', 2, 2)]], [2, 'bad', (n) => `${n.last} spirals.`, (id) => [morale(id, -6)]]] },
    ],
  },
]
export const POST_GAME_EVENTS = S.map(event)
