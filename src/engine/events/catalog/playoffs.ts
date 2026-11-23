import { buff, chem, event, morale, starter, teamBuff, teamFans, vet, young, type Spec } from './helpers'

const S: Spec[] = [
  {
    id: 'po-nerves', when: 'preGame', playoffsOnly: true, emoji: '😰', who: young, title: (n) => `${n.last} has playoff nerves`,
    text: (n) => `${n.full} hasn't slept. Playoff pressure is real and the crowd noise will be deafening.`,
    choices: [
      { label: 'Veteran pep talk', emoji: '🧓', out: [[3, 'good', (n) => `${n.last} calms down and plays free.`, (id) => [morale(id, 8), buff(id, 'shooting', 3, 1)]], [1, 'bad', (n) => `The speech backfires. ${n.last} stares at the floor.`, (id) => [morale(id, -5)]]] },
      { label: 'Let him sleep in', emoji: '😴', out: [[2, 'good', (n) => `A rested ${n.last} is sharp.`, (id) => [buff(id, 'energy', 20, 1)]], [2, 'bad', () => 'The late start throws off his routine.', (id) => [buff(id, 'shooting', -3, 1)]]] },
      { label: 'Treat it like any game', emoji: '🙂', out: [[2, 'neutral', () => 'A normal day. Mostly.', () => []], [1, 'good', () => 'It works. He is relaxed.', (id) => [morale(id, 4)]]] },
    ],
  },
  {
    id: 'po-beard', when: 'preGame', playoffsOnly: true, emoji: '🧔', who: vet, title: (n) => `${n.last} starts a playoff beard`,
    text: (n) => `${n.full} declares the team will grow playoff beards. Half the room is thrilled, half can't grow one.`,
    choices: [
      { label: 'Everybody in', emoji: '🧔', out: [[3, 'good', () => 'Bonding through facial hair. Superstitious power.', () => [chem(4)]], [1, 'bad', () => 'A rookie\'s beard is a disaster. Fans laugh.', () => [teamFans(-2)]]] },
      { label: 'Optional', emoji: '🤷', out: [[2, 'good', () => 'A stylish compromise.', () => [chem(2)]], [1, 'neutral', () => 'Nobody cares.', () => []]] },
      { label: 'No beards', emoji: '🪒', out: [[1, 'neutral', () => 'Clean-cut and professional.', () => []], [2, 'bad', (n) => `${n.last} is crushed.`, (id) => [morale(id, -6)]]] },
    ],
  },
  {
    id: 'po-crowd', when: 'preGame', playoffsOnly: true, emoji: '🏟️', title: () => 'The fans want towels',
    text: () => 'The front office wants to give out rally towels. The superstition crowd says it\'ll curse the team.',
    choices: [
      { label: 'Give out towels', emoji: '🧻', out: [[3, 'good', () => 'A sea of towels. The arena is a fortress.', () => [teamFans(6), teamBuff('all', 1, 2)]], [1, 'bad', () => 'Someone throws one on the court. Delay.', () => [teamFans(-2)]]] },
      { label: 'Not tonight', emoji: '🙅', out: [[1, 'neutral', () => 'The towels stay in the box.', () => []], [2, 'bad', () => 'The fans feel left out.', () => [teamFans(-4)]]] },
      { label: 'Gold towels for charity', emoji: '🥇', out: [[2, 'good', () => 'Classy, loud, sold out.', () => [teamFans(8)]], [1, 'bad', () => 'A pricing scandal.', () => [teamFans(-5)]]] },
    ],
  },
  {
    id: 'po-oneforall', when: 'preGame', playoffsOnly: true, emoji: '🔥', who: starter, title: (n) => `${n.last} wants to address the team`,
    text: (n) => `${n.full} asks to give a speech before tonight's game: "We've been here all year for this."`,
    choices: [
      { label: 'Let him speak', emoji: '🎙️', out: [[2, 'good', (n) => `${n.last} delivers. The team is on fire.`, (id) => [teamBuff('shooting', 3, 1), chem(3), morale(id, 4)]], [2, 'bad', () => 'Too much emotion. The team presses.', () => [teamBuff('shooting', -3, 1)]]] },
      { label: 'Coach speaks instead', emoji: '🧑‍🏫', out: [[3, 'neutral', () => 'A steady, even speech.', () => []], [1, 'bad', (n) => `${n.last} sulks quietly.`, (id) => [morale(id, -4)]]] },
      { label: 'Let the music play', emoji: '🎧', out: [[2, 'good', () => 'Headphones on. Locked in.', () => [teamBuff('all', 1, 1)]], [1, 'bad', () => 'Everybody\'s in their own world.', () => [chem(-2)]]] },
    ],
  },
]
export const PLAYOFF_EVENTS = S.map(event)
