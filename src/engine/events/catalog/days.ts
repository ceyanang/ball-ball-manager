import { bench, buff, chem, event, fans, healthy, morale, starter, teamBuff, teamFans, teamMorale, vet, young, type Spec } from './helpers'

const S: Spec[] = [
  {
    id: 'day-outing', when: 'day', emoji: '🎳', title: () => 'Team outing',
    text: (n) => `Coach ${n.last} suggests a bowling night. Half the roster is in. The other half is "busy".`,
    choices: [
      { label: 'Go all in', emoji: '🎳', out: [[3, 'good', () => 'Strikes, laughs, and a lot of nachos.', () => [chem(4), teamMorale(2)]], [1, 'bad', () => 'Someone drops a ball on a foot.', () => [teamBuff('energy', -10, 1)]]] },
      { label: 'Optional attendance', emoji: '🤷', out: [[2, 'neutral', () => 'A small crowd shows up. Fine.', () => [chem(1)]], [1, 'bad', () => 'The ones who skipped feel judged.', () => [chem(-2)]]] },
      { label: 'Cancel it', emoji: '❌', out: [[1, 'neutral', () => 'Nothing happens.', () => []], [1, 'bad', () => 'The team says you hate fun.', () => [teamMorale(-3)]]] },
    ],
  },
  {
    id: 'day-charity', when: 'day', emoji: '🏥', who: healthy, title: (n) => `${n.last} visits a children's hospital`,
    text: (n) => `${n.full} offered to visit the local children's hospital. The press is circling.`,
    choices: [
      { label: 'Go with cameras', emoji: '📸', out: [[2, 'good', (n) => `Kids adore ${n.last}. The city glows.`, (id) => [fans(id, 10), teamFans(3)]], [2, 'bad', () => 'It feels like a PR stunt. Backlash.', (id) => [fans(id, -5)]]] },
      { label: 'Go quietly', emoji: '🤫', out: [[3, 'good', (n) => `${n.last} makes real memories. Quietly legendary.`, (id) => [morale(id, 6), chem(2)]], [1, 'neutral', () => 'A nice day. No headlines.', () => []]] },
      { label: 'Send the team', emoji: '🚌', out: [[2, 'good', () => 'Everybody comes. A genuine team moment.', () => [chem(4), teamFans(4)]], [1, 'bad', () => 'Scheduling headaches. Some are cranky.', () => [teamMorale(-2)]]] },
    ],
  },
  {
    id: 'day-hazing', when: 'day', emoji: '🎒', who: young, title: (n) => `Rookie hazing for ${n.last}`,
    text: (n) => `The vets want ${n.full} to carry a pink backpack and sing during warmups. Tradition, they say.`,
    choices: [
      { label: 'Allow the hazing', emoji: '🙈', out: [[3, 'good', (n) => `${n.last} is a good sport. Bonding achieved.`, () => [chem(3)]], [2, 'bad', (n) => `${n.last} is humiliated and quiet.`, (id) => [morale(id, -7)]]] },
      { label: 'Ban hazing', emoji: '🛑', out: [[2, 'good', (n) => `${n.last} is relieved. The vets grumble.`, (id) => [morale(id, 4), chem(-1)]], [1, 'bad', () => 'The vets say the team is going soft.', () => [chem(-3)]]] },
      { label: 'Pick a mild version', emoji: '🎤', out: [[3, 'good', (n) => `A cute karaoke set by ${n.last}. Everyone laughs.`, (id) => [chem(2), fans(id, 3)]], [1, 'neutral', () => 'It\'s awkward.', () => []]] },
    ],
  },
  {
    id: 'day-podcast', when: 'day', emoji: '🎧', who: starter, title: (n) => `${n.last} was invited on a podcast`,
    text: (n) => `${n.full} has a chance to be on a viral sports podcast. The host loves hot takes.`,
    choices: [
      { label: 'Go on', emoji: '🎙️', out: [[2, 'good', (n) => `${n.last} is hilarious. The clip is everywhere.`, (id) => [fans(id, 9)]], [2, 'bad', (n) => `${n.last} says something spicy about the league.`, (id) => [fans(id, -7), morale(id, -2)]]] },
      { label: 'Decline', emoji: '🙅', out: [[2, 'neutral', () => 'He stays focused.', () => []], [1, 'bad', (n) => `${n.last} feels you're holding him back.`, (id) => [morale(id, -4)]]] },
      { label: 'Send him with a media handler', emoji: '🧑‍💼', out: [[2, 'good', () => 'Polished and safe.', (id) => [fans(id, 4)]], [1, 'bad', () => 'He sounds like a robot.', (id) => [fans(id, -2)]]] },
    ],
  },
  {
    id: 'day-rivaltweet', when: 'day', emoji: '🐦', title: () => 'The rival team\'s account is trolling you',
    text: () => 'A rival\'s social media team has been trolling yours for a week. Your intern wants to hit back.',
    choices: [
      { label: 'Go savage', emoji: '😈', out: [[2, 'good', () => 'Your reply is perfect. The internet takes your side.', () => [teamFans(8)]], [2, 'bad', () => 'It flops. Embarrassing.', () => [teamFans(-6)]]] },
      { label: 'Wholesome reply', emoji: '😇', out: [[3, 'good', () => 'Kindness wins. Classy.', () => [teamFans(4)]], [1, 'neutral', () => 'Nobody notices.', () => []]] },
      { label: 'Ignore them', emoji: '🔇', out: [[1, 'neutral', () => 'The trolling fades.', () => []], [1, 'bad', () => 'Fans say your team is soft.', () => [teamFans(-2)]]] },
    ],
  },
  {
    id: 'day-coachfeud', when: 'day', emoji: '🤬', who: starter, title: (n) => `${n.last} and an assistant coach are feuding`,
    text: (n) => `${n.full} and an assistant coach had a heated disagreement over plays. The whole gym heard it.`,
    choices: [
      { label: 'Back the player', emoji: '🫡', out: [[2, 'good', (n) => `${n.last} feels heard. Fire in his eyes.`, (id) => [morale(id, 7), buff(id, 'shooting', 2, 2)]], [2, 'bad', () => 'The coaching staff feels undermined.', () => [chem(-3)]]] },
      { label: 'Back the coach', emoji: '🧑‍🏫', out: [[2, 'good', () => 'Order restored. The room respects the structure.', () => [chem(2)]], [2, 'bad', (n) => `${n.last} sulks and sits out the shootaround.`, (id) => [morale(id, -8)]]] },
      { label: 'Mediate a sit-down', emoji: '☕', out: [[3, 'good', () => 'A quiet coffee fixes everything.', () => [chem(3), teamMorale(1)]], [1, 'neutral', () => 'Nothing really changes.', () => []]] },
    ],
  },
  {
    id: 'day-videogames', when: 'day', emoji: '🎮', title: () => 'The great video game tournament',
    text: () => 'Players have organized a video game tournament in the lounge. Trash talk is fierce.',
    choices: [
      { label: 'Join in', emoji: '🕹️', out: [[2, 'good', () => 'Coach wins. Nobody lets him forget it.', () => [chem(4)]], [2, 'bad', () => 'You lose to a rookie. The locker room has a new king.', () => [chem(1), teamMorale(-1)]]] },
      { label: 'Sponsor the prize', emoji: '🏆', out: [[3, 'good', () => 'A trophy and a lot of smack talk.', () => [teamMorale(4)]], [1, 'bad', () => 'The tournament turns petty.', () => [chem(-2)]]] },
      { label: 'Ban it before games', emoji: '📵', out: [[1, 'good', () => 'Everybody is sharper at practice.', () => [teamBuff('all', 1, 3)]], [3, 'bad', () => 'The room feels like boot camp.', () => [teamMorale(-4)]]] },
    ],
  },
  {
    id: 'day-fanday', when: 'day', emoji: '📣', title: () => 'Fan appreciation day',
    text: () => 'The front office wants a fan appreciation day with an open practice. Players are not all excited.',
    choices: [
      { label: 'Open practice', emoji: '🏟️', out: [[3, 'good', () => 'The fans love it.', () => [teamFans(7)]], [1, 'bad', () => 'A fan heckles a rookie badly.', () => [teamMorale(-2)]]] },
      { label: 'Signings only', emoji: '✍️', out: [[2, 'good', () => 'Efficient and sweet.', () => [teamFans(4), chem(1)]], [1, 'neutral', () => 'Hands cramp. That\'s it.', () => []]] },
      { label: 'Skip it', emoji: '🙅', out: [[1, 'neutral', () => 'Quiet day.', () => []], [2, 'bad', () => 'The fans feel ignored.', () => [teamFans(-5)]]] },
    ],
  },
  {
    id: 'day-scuffle', when: 'day', emoji: '🥊', who: starter, title: (n) => `${n.last} got into a practice scuffle`,
    text: (n) => `${n.full} threw a shove during a scrimmage. It got heated. The gym went silent.`,
    choices: [
      { label: 'Fine and move on', emoji: '💸', out: [[2, 'neutral', () => 'Everyone moves on.', () => []], [2, 'bad', (n) => `${n.last} stews in silence.`, (id) => [morale(id, -5)]]] },
      { label: 'Turn it into a drill', emoji: '🛠️', out: [[2, 'good', () => 'The scrimmage gets fiery. Great energy.', () => [teamBuff('defense', 2, 2)]], [1, 'bad', () => 'Another scuffle breaks out.', () => [chem(-3)]]] },
      { label: 'Pair them up for lunch', emoji: '🍔', out: [[3, 'good', () => 'Burgers fix everything. They\'re besties now.', () => [chem(4)]], [1, 'neutral', () => 'A quiet, awkward meal.', () => []]] },
    ],
  },
  {
    id: 'day-dance', when: 'day', emoji: '💃', who: young, title: (n) => `${n.last}'s dance went viral`,
    text: (n) => `A clip of ${n.full} dancing in the tunnel has 2 million views. The team wants to lean in.`,
    choices: [
      { label: 'Lean in', emoji: '🕺', out: [[3, 'good', (n) => `${n.last} is a star. Merch idea incoming.`, (id) => [fans(id, 10), teamFans(2)]], [1, 'bad', () => 'It turns into a cringe-fest.', (id) => [fans(id, -4)]]] },
      { label: 'Ignore it', emoji: '🙈', out: [[1, 'neutral', () => 'The meme fades.', () => []], [1, 'bad', (n) => `${n.last} feels embarrassed.`, (id) => [morale(id, -4)]]] },
      { label: 'Team dance-off', emoji: '🎶', out: [[2, 'good', () => 'A wonderful, wobbly team dance.', () => [chem(3), teamFans(3)]], [1, 'bad', () => 'Somebody pulls a hammy.', () => [teamBuff('energy', -10, 1)]]] },
    ],
  },
  {
    id: 'day-vetadvice', when: 'day', emoji: '🧓', who: vet, title: (n) => `${n.last} gives an impromptu speech`,
    text: (n) => `${n.full} stands up in the locker room: "Let me tell you about my first season..." It's long.`,
    choices: [
      { label: 'Let him talk', emoji: '🗣️', out: [[3, 'good', (n) => `${n.last} inspires everyone. Chills.`, (id) => [morale(id, 4), chem(3)]], [2, 'bad', () => 'Forty minutes. Eyes glaze over.', () => [teamMorale(-2)]]] },
      { label: 'Cut it short', emoji: '✂️', out: [[2, 'neutral', () => 'Respectful, brief.', () => []], [1, 'bad', (n) => `${n.last} feels disrespected.`, (id) => [morale(id, -5)]]] },
      { label: 'Record it for social', emoji: '🎥', out: [[1, 'good', () => 'The clip goes viral. Inspiring.', () => [teamFans(5)]], [2, 'bad', () => 'It sounds out of context. Backlash.', () => [teamFans(-4)]]] },
    ],
  },
  {
    id: 'day-beachtrip', when: 'day', emoji: '🏖️', title: () => 'A beach day is proposed',
    text: () => 'Somebody suggests a team trip to the beach on an off day. The medical staff is nervous about sunburn.',
    choices: [
      { label: 'Go', emoji: '🌊', out: [[3, 'good', () => 'Sunshine, volleyball, vibes.', () => [chem(4), teamMorale(3)]], [1, 'bad', () => 'Half the team is sunburned.', () => [teamBuff('energy', -15, 2)]]] },
      { label: 'Indoor activity instead', emoji: '🏢', out: [[2, 'neutral', () => 'A pleasant, boring day.', () => [chem(1)]]] },
      { label: 'Practice instead', emoji: '🏀', out: [[1, 'good', () => 'A sharp practice.', () => [teamBuff('all', 1, 2)]], [3, 'bad', () => 'The team is grumpy.', () => [teamMorale(-3)]]] },
    ],
  },
  {
    id: 'day-cooking', when: 'day', emoji: '👨‍🍳', title: () => 'Team cooking class',
    text: () => 'The team nutritionist booked a cooking class. Nobody on the roster has ever used an oven.',
    choices: [
      { label: 'Everyone goes', emoji: '🍳', out: [[3, 'good', () => 'Burnt pasta, great memories.', () => [chem(4)]], [1, 'bad', () => 'Small kitchen fire. Everyone is fine. The chef is not.', () => [teamFans(-2)]]] },
      { label: 'Hire a real chef instead', emoji: '🧑‍🍳', out: [[2, 'good', () => 'The team eats like kings. Energy is up.', () => [teamBuff('energy', 8, 3)]], [1, 'bad', () => 'Too rich. Stomach aches everywhere.', () => [teamBuff('energy', -10, 1)]]] },
      { label: 'Skip it', emoji: '🍔', out: [[1, 'neutral', () => 'Fast food it is.', () => []], [1, 'bad', () => 'The nutritionist is heartbroken.', () => [teamMorale(-1)]]] },
    ],
  },
  {
    id: 'day-docuseries', when: 'day', emoji: '🎬', title: () => 'A streaming service wants a docuseries',
    text: () => 'A streaming giant wants behind-the-scenes access for a docuseries. Cameras everywhere, all season.',
    choices: [
      { label: 'Full access', emoji: '🎥', out: [[2, 'good', () => 'The show is a hit. Everyone is famous.', () => [teamFans(10)]], [2, 'bad', () => 'An argument airs on episode two. Ouch.', () => [chem(-4), teamFans(3)]]] },
      { label: 'Limited access', emoji: '🚪', out: [[2, 'good', () => 'A tasteful little show.', () => [teamFans(4)]], [1, 'neutral', () => 'Nobody watches it.', () => []]] },
      { label: 'No cameras', emoji: '🙅', out: [[2, 'good', () => 'The locker room stays a vault.', () => [chem(2)]], [1, 'bad', () => 'Fans say the team is boring.', () => [teamFans(-3)]]] },
    ],
  },
  {
    id: 'day-oldschool', when: 'day', emoji: '🏫', who: starter, title: (n) => `${n.last}'s old high school calls`,
    text: (n) => `${n.full}'s high school wants to retire his jersey at a ceremony. It's a long drive on a rest day.`,
    choices: [
      { label: 'Go, bring the team', emoji: '🚌', out: [[3, 'good', (n) => `A hometown hero day for ${n.last}.`, (id) => [morale(id, 7), chem(2), fans(id, 5)]], [1, 'bad', () => 'Long bus ride. Tired legs.', () => [teamBuff('energy', -10, 1)]]] },
      { label: 'He goes alone', emoji: '🚗', out: [[2, 'good', (n) => `${n.last} comes back glowing.`, (id) => [morale(id, 6)]], [1, 'bad', (n) => `${n.last} is wiped from the drive.`, (id) => [buff(id, 'energy', -15, 1)]]] },
      { label: 'Send a video message', emoji: '📹', out: [[1, 'neutral', () => 'A nice video. That\'s it.', () => []], [2, 'bad', (n) => `${n.last} wishes he'd been there.`, (id) => [morale(id, -4)]]] },
    ],
  },
  {
    id: 'day-pickup', when: 'day', emoji: '🏞️', who: healthy, title: (n) => `${n.last} was spotted playing pickup`,
    text: (n) => `A video shows ${n.full} playing streetball at a public park. Dunking on strangers. The medical staff is sweating.`,
    choices: [
      { label: 'Ban it', emoji: '🚫', out: [[2, 'neutral', () => 'He stops. Grudgingly.', (id) => [morale(id, -2)]], [1, 'bad', (n) => `${n.last} feels like a prisoner.`, (id) => [morale(id, -6)]]] },
      { label: 'Let him hoop', emoji: '🏀', out: [[2, 'good', (n) => `${n.last} is the people's champ. The city loves him.`, (id) => [fans(id, 9), morale(id, 4)]], [1, 'bad', (n) => `${n.last} rolls an ankle a little. Nothing serious.`, (id) => [buff(id, 'energy', -20, 2)]]] },
      { label: 'Make it a team event', emoji: '🎉', out: [[3, 'good', () => 'The whole team shows up at the park. Viral.', () => [teamFans(6), chem(2)]], [1, 'bad', () => 'Chaos. The crowd gets too big.', () => [teamFans(-2)]]] },
    ],
  },
  {
    id: 'day-yoga', when: 'day', emoji: '🧘', title: () => 'A yoga instructor offers sessions',
    text: () => 'A famous yoga instructor offers to work with the team. The big men look terrified.',
    choices: [
      { label: 'Mandatory yoga', emoji: '🤸', out: [[2, 'good', () => 'Bendy, relaxed, recovered.', () => [teamBuff('energy', 10, 3)]], [2, 'bad', () => 'Pulled muscles and a lot of complaining.', () => [teamMorale(-3)]]] },
      { label: 'Optional yoga', emoji: '🙂', out: [[2, 'good', () => 'A few converts. Nice.', () => [teamMorale(1)]], [1, 'neutral', () => 'Nobody shows up.', () => []]] },
      { label: 'No thanks', emoji: '🙅', out: [[1, 'neutral', () => 'Nothing changes.', () => []], [1, 'bad', () => 'The training staff thinks you\'re old-school.', () => [chem(-1)]]] },
    ],
  },
  {
    id: 'day-mascot', when: 'day', emoji: '🐻', who: bench, title: (n) => `${n.last} wants to wear the mascot suit`,
    text: (n) => `${n.full} has asked to secretly be the mascot at the next home game. He has a whole routine planned.`,
    choices: [
      { label: 'Let him do it', emoji: '🧸', out: [[3, 'good', (n) => `The reveal at halftime brings the house down. ${n.last} is a legend.`, (id) => [fans(id, 10), chem(2)]], [1, 'bad', () => 'He trips down the stairs in the suit. On camera.', (id) => [fans(id, -4), buff(id, 'energy', -15, 1)]]] },
      { label: 'Absolutely not', emoji: '🙅', out: [[2, 'bad', (n) => `${n.last} is genuinely sad about it.`, (id) => [morale(id, -5)]], [1, 'neutral', () => 'He laughs it off.', () => []]] },
      { label: 'Only at a charity event', emoji: '💝', out: [[2, 'good', () => 'The kids adore it.', (id) => [morale(id, 4), teamFans(3)]], [1, 'neutral', () => 'Small crowd. Still cute.', () => []]] },
    ],
  },
]
export const DAY_EVENTS = S.map(event)
