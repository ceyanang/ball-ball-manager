import type { Ratings } from '../../types'
import { bench, buff, chem, event, fans, healthy, morale, rest, starter, teamBuff, teamFans, train, vet, young, type Spec } from './helpers'

/** "I want to work on X": approve (he improves, maybe at a cost), decline (he may do it anyway), or make him earn it. */
const trainSpec = (skill: keyof Ratings, label: string, line: string): Spec => ({
  id: `req-train-${skill}`, when: 'day', request: true, emoji: '🏋️', weight: 1.5, cooldownDays: 40,
  who: (p) => healthy(p) && p.age <= 31 && p.ratings[skill] < 82,
  title: (n) => `${n.last} wants to work on his ${label}`,
  text: (n) => `${n.full} knocks on your door: "${line}" He wants extra gym time and a coach assigned to it.`,
  choices: [
    { label: 'Approve it', emoji: '✅', out: [
      [3, 'good', (n) => `${n.last} puts in the hours. His ${label} is noticeably better.`, (id) => [train(id, skill, 2), morale(id, 4)]],
      [1, 'good', (n) => `${n.last} is a gym rat now. Big jump in ${label}.`, (id) => [train(id, skill, 3), morale(id, 6)]],
      [2, 'bad', (n) => `${n.last} overdoes it and is exhausted for a few games.`, (id) => [train(id, skill, 1), buff(id, 'energy', -25, 3)]],
    ] },
    { label: 'Not now', emoji: '🙅', out: [
      [3, 'bad', (n) => `${n.last} is annoyed. "Fine."`, (id) => [morale(id, -7)]],
      [1, 'good', (n) => `${n.last} trains on his own anyway. Tiny gains, and he respects you for being honest.`, (id) => [train(id, skill, 1), morale(id, 1)]],
    ] },
    { label: 'Earn it first', emoji: '🪜', out: [
      [2, 'good', (n) => `${n.last} grinds in practice. The locker room notices.`, (id) => [train(id, skill, 1), chem(2)]],
      [2, 'bad', (n) => `${n.last} feels you don't believe in him.`, (id) => [morale(id, -5), chem(-1)]],
    ] },
  ],
})

const S: Spec[] = [
  trainSpec('three', 'three-point shot', 'I want to work on my three.'),
  trainSpec('handle', 'ball handling', 'Defenders are picking my pocket. Let me work on my handle.'),
  trainSpec('pass', 'passing', 'I want to see the floor better. Passing drills?'),
  trainSpec('ins', 'inside game', 'I want to develop real post moves.'),
  trainSpec('perD', 'perimeter defense', 'I want to be the guy who locks up the best guard.'),
  trainSpec('ft', 'free throws', 'I keep missing free throws. I want to fix it.'),
  trainSpec('stam', 'conditioning', 'I get gassed. I need a conditioning program.'),
  trainSpec('iq', 'basketball IQ', 'I want to watch more film with the coaches.'),
  {
    id: 'req-dayoff', when: 'preGame', request: true, emoji: '🛌', weight: 1.5, cooldownDays: 25, who: starter,
    title: (n) => `${n.last} wants a day off`,
    text: (n) => `${n.full} says his knees are talking to him. "One night off. Please." The team is relying on him.`,
    choices: [
      { label: 'Give him the night off', emoji: '🛌', out: [
        [3, 'good', (n) => `${n.last} comes back refreshed and thanks you.`, (id) => [rest(id), morale(id, 8), buff(id, 'energy', 20, 3)]],
        [2, 'bad', (n) => `${n.last} was seen at a club. Fans are furious.`, (id) => [rest(id), fans(id, -8), morale(id, 2)]],
      ] },
      { label: 'No, we need you', emoji: '🙅', out: [
        [2, 'good', (n) => `${n.last} has a revenge game. 🔥`, (id) => [buff(id, 'shooting', 3, 1), morale(id, -4)]],
        [3, 'bad', (n) => `${n.last} sulks and the team feels it.`, (id) => [morale(id, -10), chem(-2)]],
      ] },
      { label: 'Limited minutes', emoji: '⏱️', out: [
        [3, 'neutral', () => 'A fair compromise. Nobody loves it.', (id) => [morale(id, 2)]],
        [1, 'good', (n) => `${n.last} is efficient and happy.`, (id) => [buff(id, 'energy', 15, 1), morale(id, 4)]],
      ] },
    ],
  },
  {
    id: 'req-minutes', when: 'preGame', request: true, emoji: '⏱️', weight: 1.5, cooldownDays: 25, who: bench,
    title: (n) => `${n.last} wants more minutes`,
    text: (n) => `${n.full} corners you after shootaround: "I'm better than that guy in front of me. Give me a shot."`,
    choices: [
      { label: 'Promise more minutes', emoji: '🤝', out: [
        [3, 'good', (n) => `${n.last} lights up. Practice energy is huge.`, (id) => [morale(id, 8), buff(id, 'shooting', 2, 3)]],
        [2, 'bad', () => 'The starters hear about it and don\'t love it.', (id) => [morale(id, 4), chem(-3)]],
      ] },
      { label: 'Tell him to earn it', emoji: '💪', out: [
        [2, 'good', (n) => `${n.last} is fired up. Extra effort in the gym.`, (id) => [buff(id, 'all', 2, 3)]],
        [3, 'bad', (n) => `${n.last} shuts down and mopes.`, (id) => [morale(id, -8)]],
      ] },
      { label: 'Ignore it', emoji: '🙉', out: [[1, 'neutral', () => 'He walks away muttering.', (id) => [morale(id, -3)]], [1, 'good', () => 'He shrugs it off. Pros gonna pro.', () => []]] },
    ],
  },
  {
    id: 'req-commercial', when: 'day', request: true, emoji: '📺', who: starter, cooldownDays: 40,
    title: (n) => `${n.last} was offered a commercial`,
    text: (n) => `A regional furniture chain wants ${n.full} for a TV spot. It's goofy. It pays. He wants your blessing.`,
    choices: [
      { label: 'Approve', emoji: '🎬', out: [[2, 'good', (n) => `${n.last}'s ad is hilarious. Everyone quotes it.`, (id) => [fans(id, 9), morale(id, 4)]], [2, 'bad', (n) => `The ad is embarrassing. ${n.last} is meme material.`, (id) => [fans(id, -6), morale(id, -2)]]] },
      { label: 'Decline', emoji: '❌', out: [[2, 'bad', (n) => `${n.last} loses the paycheck and the mood.`, (id) => [morale(id, -6)]], [1, 'good', (n) => `${n.last} focuses on the court. Locker room appreciates it.`, () => [chem(2)]]] },
      { label: 'Only if the team is in it', emoji: '👥', out: [[3, 'good', () => 'A team ad! The city loves it.', () => [chem(3), teamFans(4)]], [1, 'bad', () => 'Scheduling chaos. Half the team is mad.', () => [chem(-2)]]] },
    ],
  },
  {
    id: 'req-dog', when: 'day', request: true, emoji: '🐕', who: healthy, cooldownDays: 40,
    title: (n) => `${n.last} wants to bring his dog to practice`,
    text: (n) => `${n.full} says his dog "Biscuit" is a calming presence. Biscuit is a 90-pound Great Dane.`,
    choices: [
      { label: 'Biscuit joins', emoji: '🐶', out: [[3, 'good', () => 'Biscuit is the best teammate. Everyone smiles.', (id) => [chem(3), morale(id, 5)]], [1, 'bad', () => 'Biscuit eats a rookie\'s sandwich. Chaos.', () => [chem(-1)]]] },
      { label: 'No dogs', emoji: '🚫', out: [[2, 'bad', (n) => `${n.last} is crushed.`, (id) => [morale(id, -6)]], [1, 'neutral', () => 'He understands. Mostly.', () => []]] },
      { label: 'Biscuit visits on game day', emoji: '🏟️', out: [[2, 'good', (n) => `${n.last} and Biscuit steal the show. Fans love it.`, (id) => [fans(id, 6), teamFans(2)]], [1, 'bad', () => 'Biscuit runs onto the court mid-game.', () => [teamFans(-3)]]] },
    ],
  },
  {
    id: 'req-mentor', when: 'day', request: true, emoji: '🧑‍🏫', who: vet, cooldownDays: 40,
    needs: (c) => c.roster.some((p) => young(p)),
    title: (n) => `${n.last} wants to mentor a rookie`,
    text: (n) => `${n.full} says: "I wish I'd had someone like me when I was young." He wants a young guy to take under his wing.`,
    choices: [
      { label: 'Pair them up', emoji: '🤝', out: [[3, 'good', (n) => `${n.last} and the rookie click. Chemistry rises.`, (id) => [chem(3), morale(id, 4)]], [2, 'bad', () => 'Personalities clash. Two weeks of tension.', () => [chem(-3)]]] },
      { label: 'Let it happen naturally', emoji: '🌱', out: [[1, 'good', () => 'A friendship forms on its own.', () => [chem(2)]], [3, 'neutral', () => 'Nothing really happens.', () => []]] },
      { label: 'Have a coach handle it', emoji: '🧑‍🏫', out: [[2, 'bad', (n) => `${n.last} feels brushed off.`, (id) => [morale(id, -4)]], [1, 'good', () => 'The coach does fine.', () => [chem(1)]]] },
    ],
  },
  {
    id: 'req-captain', when: 'day', request: true, emoji: '🅲', who: vet, cooldownDays: 60,
    title: (n) => `${n.last} wants to be captain`,
    text: (n) => `${n.full} says the room needs a leader and that leader is him. Others in the room have opinions.`,
    choices: [
      { label: 'Make him captain', emoji: '🅲', out: [[2, 'good', (n) => `${n.last} leads by example. The room follows.`, (id) => [morale(id, 8), chem(3)]], [2, 'bad', () => 'The younger stars feel passed over.', (id) => [morale(id, 5), chem(-4)]]] },
      { label: 'Co-captains', emoji: '🫱‍🫲', out: [[3, 'good', () => 'A blended leadership group. Everyone is okay with it.', () => [chem(2)]], [1, 'neutral', () => 'Nothing changes. Okay.', () => []]] },
      { label: 'No captains', emoji: '🚫', out: [[2, 'bad', (n) => `${n.last} is hurt and distant.`, (id) => [morale(id, -7)]], [1, 'good', () => 'The team lives with it and bonds around it.', () => [chem(1)]]] },
    ],
  },
  {
    id: 'req-media', when: 'day', request: true, emoji: '🎙️', who: starter, cooldownDays: 30,
    title: (n) => `${n.last} wants to skip the media`,
    text: (n) => `${n.full} has had enough of post-game questions. He asks for a pass for the next few days.`,
    choices: [
      { label: 'Let him skip', emoji: '🙏', out: [[2, 'good', (n) => `${n.last} is relaxed. Less pressure.`, (id) => [morale(id, 6)]], [2, 'bad', () => 'The press says he is hiding something. Rumors fly.', (id) => [fans(id, -6)]]] },
      { label: 'Make him go', emoji: '📣', out: [[2, 'good', (n) => `${n.last} charms the press. Great quotes.`, (id) => [fans(id, 6)]], [2, 'bad', (n) => `${n.last} says something dumb on camera.`, (id) => [fans(id, -8), morale(id, -4)]]] },
      { label: 'Send the coach instead', emoji: '🧑‍💼', out: [[2, 'neutral', () => 'The coach handles it. Nobody remembers.', () => []], [1, 'good', () => 'The coach gives an unexpectedly great press conference.', () => [teamFans(3)]]] },
    ],
  },
  {
    id: 'req-number', when: 'day', request: true, emoji: '🔢', who: healthy, cooldownDays: 60,
    title: (n) => `${n.last} wants a new jersey number`,
    text: (n) => `${n.full} says his number is "bad energy" and wants to switch. The team store has 2,000 jerseys with the old one.`,
    choices: [
      { label: 'Approve the switch', emoji: '✅', out: [[2, 'good', (n) => `${n.last} feels reborn. New number, new him.`, (id) => [morale(id, 6), buff(id, 'shooting', 2, 2)]], [1, 'bad', () => 'The fans who bought the old jersey are mad.', (id) => [fans(id, -5)]]] },
      { label: 'Keep the number', emoji: '🙅', out: [[2, 'bad', (n) => `${n.last} insists the curse is real.`, (id) => [morale(id, -5)]], [1, 'neutral', () => 'He forgets about it by Tuesday.', () => []]] },
      { label: 'Let the fans vote', emoji: '🗳️', out: [[2, 'good', () => 'The vote is a big hit online.', (id) => [fans(id, 6), teamFans(2)]], [1, 'bad', () => 'The fans pick a joke number. Oh no.', (id) => [morale(id, -4)]]] },
    ],
  },
  {
    id: 'req-chef', when: 'day', request: true, emoji: '🥗', who: starter, cooldownDays: 45,
    title: (n) => `${n.last} wants a personal chef`,
    text: (n) => `${n.full} wants the team to pay for his personal chef to travel with the team. "It's for my performance."`,
    choices: [
      { label: 'Approve', emoji: '👨‍🍳', out: [[2, 'good', (n) => `${n.last} feels fantastic.`, (id) => [buff(id, 'energy', 15, 4), morale(id, 4)]], [2, 'bad', () => 'Everyone else wants a chef now.', () => [chem(-3)]]] },
      { label: 'Team chef for everyone', emoji: '🍱', out: [[3, 'good', () => 'Healthy meals for the whole team.', () => [teamBuff('energy', 6, 3)]], [1, 'bad', (n) => `${n.last} wanted HIS chef.`, (id) => [morale(id, -3)]]] },
      { label: 'Decline', emoji: '🙅', out: [[2, 'bad', (n) => `${n.last} rolls his eyes.`, (id) => [morale(id, -5)]], [1, 'good', () => 'The room respects the fairness.', () => [chem(1)]]] },
    ],
  },
  {
    id: 'req-family', when: 'day', request: true, emoji: '💐', who: healthy, cooldownDays: 60,
    title: (n) => `${n.last} wants to be home for a family moment`,
    text: (n) => `${n.full}'s sister is getting married this week. It would mean missing the next game.`,
    choices: [
      { label: 'Go, family first', emoji: '💐', out: [[3, 'good', (n) => `${n.last} is grateful. Deeply.`, (id) => [rest(id), morale(id, 10), chem(1)]], [1, 'bad', () => 'He misses the game and you miss him.', (id) => [rest(id), morale(id, 4)]]] },
      { label: 'Only if he flies back for the game', emoji: '✈️', out: [[2, 'good', () => 'He makes both. Barely.', (id) => [morale(id, 4), buff(id, 'energy', -15, 1)]], [1, 'bad', () => 'Flight chaos. He is wrecked.', (id) => [buff(id, 'all', -3, 1)]]] },
      { label: 'Ask him to stay', emoji: '🙅', out: [[3, 'bad', (n) => `${n.last} is hurt. The room thinks it was cold.`, (id) => [morale(id, -10), chem(-2)]], [1, 'good', () => 'He understands. A true pro.', () => []]] },
    ],
  },
]
export const REQUEST_EVENTS = S.map(event)
