import { isRivalGame } from '../../rivals/rivalry'
import { buff, chem, event, fans, grow, morale, rest, teamMorale, type Spec } from './helpers'

/** The followed player, and only him; `fit` also needs him healthy. */
const mine: Spec['who'] = (p) => !!p.careerBuild
const fit: Spec['who'] = (p) => !!p.careerBuild && !p.injury

const S: Spec[] = [
  {
    id: 'career-gym-night', when: 'day', career: true, emoji: '🏋️', who: fit, title: () => 'An empty gym and a free night',
    text: (n) => `The lights are still on in the practice gym. ${n.first}, nobody would know if you stayed late.`,
    choices: [
      { label: 'Put up threes until midnight', emoji: '🎯', out: [[3, 'good', () => 'Your stroke gets quieter and cleaner.', (id) => [grow(id, [['threePointShot', 3], ['midRangeShot', 1]], 'Extra gym night')]], [1, 'bad', () => 'You overdo it and your legs are heavy tomorrow.', (id) => [buff(id, 'energy', -15, 2)]]] },
      { label: 'Work on handles', emoji: '🏀', out: [[3, 'good', () => 'The ball finally feels glued to your hand.', (id) => [grow(id, [['ballHandle', 3], ['speedWithBall', 1]], 'Extra gym night')]], [1, 'neutral', () => 'A lot of dribbling, not much changes.', () => []]] },
      { label: 'Go home and sleep', emoji: '😴', out: [[2, 'neutral', () => 'Rest is a skill too.', (id) => [morale(id, 3)]], [1, 'bad', () => 'You lie awake wishing you had stayed.', (id) => [morale(id, -2)]]] },
    ],
  },
  {
    id: 'career-film-study', when: 'day', career: true, emoji: '🎞️', who: fit, title: () => 'Film session with the coach',
    text: (n) => `Coach ${n.last} sits you down in the dark room and clicks to your last three turnovers.`,
    choices: [
      { label: 'Study the offence', emoji: '📋', out: [[3, 'good', () => 'You start seeing the floor a half-step earlier.', (id) => [grow(id, [['shotIQ', 3], ['passIQ', 2]], 'Film study')]], [1, 'neutral', () => 'A lot of notes. Not a lot of lightbulbs.', () => []]] },
      { label: 'Study the defence', emoji: '🛡️', out: [[3, 'good', () => 'You can read a pick before it is set.', (id) => [grow(id, [['helpDefenseIQ', 3], ['passPerception', 2]], 'Film study')]], [1, 'bad', () => 'You get in your own head.', (id) => [morale(id, -3)]]] },
      { label: 'Ask for fewer clips', emoji: '🙅', out: [[2, 'neutral', () => 'The coach shrugs and moves on.', () => []], [1, 'bad', () => 'He remembers it.', (id) => [morale(id, -3)]]] },
    ],
  },
  {
    id: 'career-conditioning', when: 'day', career: true, emoji: '🏃', who: fit, title: () => 'Conditioning block',
    text: () => 'The strength staff has a brutal two-day program. It is optional. They say the real ones show up.',
    choices: [
      { label: 'Do the whole program', emoji: '💪', out: [[3, 'good', () => 'You can run forever now.', (id) => [grow(id, [['stamina', 3], ['hustle', 1]], 'Conditioning')]], [1, 'bad', () => 'You tweak something. You are limping.', (id) => [buff(id, 'energy', -20, 3)]]] },
      { label: 'Do half of it', emoji: '⚖️', out: [[3, 'good', () => 'A smart middle path.', (id) => [grow(id, [['stamina', 1]], 'Conditioning')]], [1, 'neutral', () => 'Nobody notices either way.', () => []]] },
      { label: 'Rest the legs', emoji: '🛌', out: [[2, 'good', () => 'Fresh legs for the next game.', (id) => [buff(id, 'energy', 20, 2)]], [1, 'neutral', () => 'You feel slightly guilty.', () => []]] },
    ],
  },
  {
    id: 'career-media-night', when: 'day', career: true, emoji: '🎤', who: mine, title: () => 'Media night',
    text: (n) => `A reporter wants ten minutes with you, ${n.first}. The cameras are already rolling.`,
    choices: [
      { label: 'Give them a story', emoji: '🔥', out: [[2, 'good', () => 'The clip goes everywhere. Fans love it.', (id) => [fans(id, 8), morale(id, 3)]], [2, 'bad', () => 'A joke lands wrong online.', (id) => [fans(id, -6)]]] },
      { label: 'Keep it humble', emoji: '🙏', out: [[3, 'good', () => 'Classy and quiet. People like it.', (id) => [fans(id, 3), grow(id, [['intangibles', 1]], 'Media night')]], [1, 'neutral', () => 'Nobody remembers it.', () => []]] },
      { label: 'Skip it', emoji: '🚪', out: [[1, 'neutral', () => 'The reporter finds someone else.', () => []], [1, 'bad', () => 'You get called "distant".', (id) => [fans(id, -3)]]] },
    ],
  },
  {
    id: 'career-rival-fire', when: 'preGame', career: true, emoji: '😤', who: fit, needs: (ctx) => !!ctx.game && isRivalGame(ctx.l, ctx.game),
    title: () => 'Rivalry night', text: (n) => `Tonight is personal. The whole arena knows it, ${n.first}.`,
    choices: [
      { label: 'Lock in', emoji: '🔒', out: [[3, 'good', () => 'You are calm and loud in the right ways.', (id) => [buff(id, 'shooting', 2, 1), grow(id, [['offensiveConsistency', 2]], 'Rivalry night')]], [1, 'bad', () => 'You press too hard.', (id) => [buff(id, 'shooting', -2, 1)]]] },
      { label: 'Talk trash', emoji: '🗣️', out: [[2, 'good', () => 'You get into their heads.', (id) => [buff(id, 'all', 2, 1), fans(id, 4)]], [2, 'bad', () => 'You get into your own.', (id) => [buff(id, 'shooting', -3, 1)]]] },
      { label: 'Treat it like any game', emoji: '😌', out: [[2, 'neutral', () => 'Steady.', () => []], [1, 'good', () => 'Calm wins.', (id) => [grow(id, [['intangibles', 1]], 'Rivalry night')]]] },
    ],
  },
  {
    id: 'career-mentor', when: 'day', career: true, emoji: '🧓', who: fit, needs: (ctx) => ctx.roster.some((p) => p.age >= 30 && !p.careerBuild),
    title: () => 'A veteran pulls you aside', text: () => 'The old head has been watching you for weeks. He says he has one thing to teach you, and only one.',
    choices: [
      { label: 'Learn how to score', emoji: '🏹', out: [[3, 'good', () => 'He shows you a counter you will use for years.', (id) => [grow(id, [['shotIQ', 2], ['midRangeShot', 2]], 'Mentor')]], [1, 'neutral', () => 'He mumbles. You pretend to follow.', () => []]] },
      { label: 'Learn how to defend', emoji: '🧱', out: [[3, 'good', () => 'Angles, not athleticism.', (id) => [grow(id, [['perimeterDefense', 2], ['defensiveConsistency', 2]], 'Mentor')]], [1, 'neutral', () => 'Mostly stories about 1998.', () => []]] },
      { label: 'Learn how to pass', emoji: '🎁', out: [[3, 'good', () => 'Hit the open man before he knows he is open.', (id) => [grow(id, [['passVision', 2], ['passAccuracy', 2]], 'Mentor')]], [1, 'bad', () => 'He thinks you are a ball hog and says so.', (id) => [morale(id, -3)]]] },
    ],
  },
  {
    id: 'career-injury-scare', when: 'postGame', career: true, emoji: '🩹', who: fit, title: () => 'Something does not feel right',
    text: (n) => `${n.first}, your knee is barking after that game. It might be nothing. It might not.`,
    choices: [
      { label: 'Play through it', emoji: '😬', out: [[2, 'good', () => 'It was nothing. Toughness noted.', (id) => [grow(id, [['hustle', 1], ['overallDurability', 1]], 'Played through')]], [2, 'bad', () => 'It gets worse. You need a couple of days.', (id) => [rest(id), morale(id, -3)]]] },
      { label: 'Sit one out', emoji: '🛑', out: [[3, 'good', () => 'Better safe than sorry.', (id) => [rest(id), morale(id, 2)]], [1, 'neutral', () => 'It was nothing, but you do not regret it.', (id) => [rest(id)]]] },
      { label: 'Get it checked', emoji: '🩻', out: [[3, 'good', () => 'A small strain, caught early.', (id) => [buff(id, 'energy', -10, 1)]], [1, 'bad', () => 'It is a real problem. You will be out a bit.', (id) => [rest(id), morale(id, -4)]]] },
    ],
  },
  {
    id: 'career-teammate-touches', when: 'postGame', career: true, emoji: '🤝', who: fit, title: () => 'A teammate wants more touches',
    text: () => 'After the game, a starter asks you straight out to move the ball more. It was not a joke.',
    choices: [
      { label: 'Move it more', emoji: '🔄', out: [[3, 'good', () => 'The offence flows. Everybody notices.', (id) => [chem(3), grow(id, [['passVision', 2], ['passIQ', 1]], 'Team play')]], [1, 'neutral', () => 'You pass up good shots and hear about it.', () => []]] },
      { label: 'Keep hunting shots', emoji: '🎯', out: [[2, 'good', () => 'Fans love a bucket-getter.', (id) => [fans(id, 5)]], [2, 'bad', () => 'The locker room hears you.', () => [chem(-3), teamMorale(-2)]]] },
      { label: 'Say you will think about it', emoji: '🤔', out: [[2, 'neutral', () => 'A noncommittal nod.', () => []], [1, 'bad', () => 'He took that personally.', () => [chem(-1)]]] },
    ],
  },
  {
    id: 'career-defense-coach', when: 'day', career: true, emoji: '🧤', who: fit, title: () => 'The defensive assistant has a drill',
    text: (n) => `The assistant coach says ${n.first} is "one drill away" from being a nightmare on defence.`,
    choices: [
      { label: 'Lateral quickness drill', emoji: '↔️', out: [[3, 'good', () => 'Your feet are lighter.', (id) => [grow(id, [['perimeterDefense', 3], ['agility', 1]], 'Defence drill')]], [1, 'bad', () => 'A groin tweak slows you down.', (id) => [buff(id, 'defense', -2, 2)]]] },
      { label: 'Rim protection drill', emoji: '⬆️', out: [[3, 'good', () => 'You time the jump better.', (id) => [grow(id, [['interiorDefense', 3], ['block', 1]], 'Defence drill')]], [1, 'neutral', () => 'Lots of contact, no breakthrough.', () => []]] },
      { label: 'Steals and hands', emoji: '🖐️', out: [[3, 'good', () => 'Quick hands, quicker eyes.', (id) => [grow(id, [['steal', 3], ['hands', 1]], 'Defence drill')]], [1, 'bad', () => 'You gamble too much in the next game.', (id) => [buff(id, 'defense', -3, 1)]]] },
    ],
  },
  {
    id: 'career-nerves', when: 'preGame', career: true, emoji: '😰', who: fit, title: () => 'Pre-game nerves',
    text: (n) => `${n.first}, your hands are shaking in the tunnel. The arena sounds enormous.`,
    choices: [
      { label: 'Breathe and visualise', emoji: '🧘', out: [[3, 'good', () => 'It all slows down.', (id) => [grow(id, [['offensiveConsistency', 2], ['intangibles', 1]], 'Pre-game routine')]], [1, 'neutral', () => 'You are still nervous.', () => []]] },
      { label: 'Call someone you trust', emoji: '📞', out: [[3, 'good', () => 'A few words are all it takes.', (id) => [morale(id, 5)]], [1, 'bad', () => 'They are in the middle of something.', (id) => [morale(id, -2)]]] },
      { label: 'Fake confidence', emoji: '😎', out: [[2, 'good', () => 'It sort of becomes real.', (id) => [buff(id, 'shooting', 1, 1)]], [2, 'bad', () => 'The mask slips in the first quarter.', (id) => [buff(id, 'shooting', -2, 1)]]] },
    ],
  },
  {
    id: 'career-shootaround', when: 'preGame', career: true, emoji: '🕗', who: fit, title: () => 'Morning shootaround',
    text: () => 'Nobody else is in the arena yet. Twenty minutes with a ball and a basket.',
    choices: [
      { label: 'Finish at the rim', emoji: '🔨', out: [[3, 'good', () => 'You find your touch around the basket.', (id) => [grow(id, [['layup', 2], ['closeShot', 1]], 'Shootaround')]], [1, 'neutral', () => 'Nothing special.', () => []]] },
      { label: 'Free throws, then free throws', emoji: '🎳', out: [[3, 'good', () => 'Automatic from the stripe.', (id) => [grow(id, [['freeThrow', 3]], 'Shootaround')]], [1, 'neutral', () => 'A very quiet twenty minutes.', () => []]] },
      { label: 'Stay in bed', emoji: '🛏️', out: [[2, 'neutral', () => 'You feel rested.', (id) => [buff(id, 'energy', 10, 1)]], [1, 'bad', () => 'You walk in late.', (id) => [morale(id, -2)]]] },
    ],
  },
  {
    id: 'career-strength-room', when: 'day', career: true, emoji: '🧱', who: fit, title: () => 'The weight room is open',
    text: () => 'The strength coach is short on training partners and long on opinions.',
    choices: [
      { label: 'Lift for power', emoji: '🏋️', out: [[3, 'good', () => 'You feel stronger on the block.', (id) => [grow(id, [['strength', 3], ['vertical', 1]], 'Weight room')]], [1, 'bad', () => 'Stiff for two days.', (id) => [buff(id, 'energy', -10, 2)]]] },
      { label: 'Mobility and speed', emoji: '💨', out: [[3, 'good', () => 'You feel quicker.', (id) => [grow(id, [['speed', 2], ['agility', 2]], 'Weight room')]], [1, 'neutral', () => 'A lot of foam rolling.', () => []]] },
    ],
  },
]

/** MyCareer events: only roll in career leagues; their choices grow named stats through the `grow` effect. */
export const CAREER_EVENTS = S.map(event)
