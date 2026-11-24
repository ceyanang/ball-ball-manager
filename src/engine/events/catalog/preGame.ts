import { buff, chem, event, fans, healthy, morale, rest, starter, teamBuff, teamFans, teamMorale, vet, young, type Spec } from './helpers'

const S: Spec[] = [
  {
    id: 'pre-meal', when: 'preGame', emoji: '🍕', title: () => 'Pre-game meal debate',
    text: (n) => `Coach ${n.last} lets the team vote on the pre-game meal. The locker room is split between pizza, a "performance bowl", and nothing at all.`,
    choices: [
      { label: 'Order pizza', emoji: '🍕', out: [[3, 'good', () => 'Pizza night! Everyone is thrilled.', () => [teamMorale(4), chem(2)]], [2, 'bad', () => 'Too much cheese. The team feels sluggish.', () => [teamBuff('energy', -15, 1)]]] },
      { label: 'Performance bowls', emoji: '🥗', out: [[2, 'good', () => 'Clean energy: the team is flying.', () => [teamBuff('energy', 15, 2)]], [3, 'bad', () => 'Nobody likes the kale. Grumbling all around.', () => [teamMorale(-3), chem(-1)]]] },
      { label: 'Skip it', emoji: '🙅', out: [[1, 'neutral', () => 'Hungry but focused. Nothing changes.', () => []]] },
    ],
  },
  {
    id: 'pre-socks', when: 'preGame', emoji: '🧦', who: vet, title: (n) => `${n.last} lost his lucky socks`,
    text: (n) => `${n.full} swears he's never lost in his lucky socks. They're gone. He is spiraling.`,
    choices: [
      { label: 'Find him new ones', emoji: '🧦', out: [[2, 'good', (n) => `${n.last} says the new pair is even luckier.`, (id) => [morale(id, 6), buff(id, 'shooting', 3, 2)]], [2, 'bad', (n) => `The new socks itch. ${n.last} is miserable.`, (id) => [morale(id, -4)]]] },
      { label: 'Tell him it\'s superstition', emoji: '🧠', out: [[1, 'good', (n) => `${n.last} laughs and plays loose.`, (id) => [morale(id, 3)]], [3, 'bad', (n) => `${n.last} sulks. He feels disrespected.`, (id) => [morale(id, -7), fans(id, -2)]]] },
      { label: 'Let him play barefoot-ish', emoji: '🤷', out: [[1, 'neutral', () => 'He plays in mismatched socks. It is fine.', () => []], [1, 'good', (n) => `Mismatched ${n.last} goes off. A new ritual is born.`, (id) => [fans(id, 5)]]] },
    ],
  },
  {
    id: 'pre-taunt', when: 'preGame', emoji: '📱', who: starter, title: (n) => `${n.last} got roasted online`,
    text: (n) => `An opposing fan's post calling ${n.full} "overrated" has 40,000 likes. ${n.last} has the phone in his hand.`,
    choices: [
      { label: 'Let him clap back', emoji: '🔥', out: [[2, 'good', (n) => `${n.last} posts a perfect reply and plays angry.`, (id) => [buff(id, 'shooting', 4, 2), fans(id, 6)]], [3, 'bad', () => 'The reply goes viral for the wrong reasons.', (id) => [fans(id, -8), morale(id, -3)]]] },
      { label: 'Phone away', emoji: '📵', out: [[3, 'neutral', () => 'He takes the high road. Nothing changes.', () => []], [1, 'good', (n) => `${n.last} stays zen. The team respects it.`, () => [chem(2)]]] },
      { label: 'Reply as the team account', emoji: '🏢', out: [[2, 'good', () => 'The team account has jokes. The internet loves it.', () => [teamFans(5)]], [2, 'bad', () => 'The joke ages badly. Brand damage.', () => [teamFans(-6)]]] },
    ],
  },
  {
    id: 'pre-mascot', when: 'preGame', emoji: '🦄', title: () => 'The mascot wants a bigger stunt',
    text: () => 'The mascot has been training in secret and wants to dunk off a trampoline from the top of the tunnel tonight.',
    choices: [
      { label: 'Approve it', emoji: '🚀', out: [[2, 'good', () => 'The stunt is legendary. The arena erupts.', () => [teamFans(8), teamMorale(2)]], [2, 'bad', () => 'He misses the rim. And the trampoline. The crowd gasps.', () => [teamFans(-5)]]] },
      { label: 'Compromise: a safe stunt', emoji: '🛟', out: [[3, 'good', () => 'A tidy little show. Everybody smiles.', () => [teamFans(3)]], [1, 'neutral', () => 'Nobody remembers it.', () => []]] },
      { label: 'Say no', emoji: '🚫', out: [[1, 'neutral', () => 'The mascot sulks in the corner.', () => []], [1, 'bad', () => 'The mascot quits for the night. The crowd is flat.', () => [teamFans(-2)]]] },
    ],
  },
  {
    id: 'pre-anthem', when: 'preGame', emoji: '🎤', who: (p) => healthy(p), title: (n) => `${n.last} wants to sing the anthem`,
    text: (n) => `The scheduled singer got stuck in traffic. ${n.full} volunteered. He insists he "has pipes".`,
    choices: [
      { label: 'Let him sing', emoji: '🎶', out: [[1, 'good', (n) => `${n.last} NAILS it. Goosebumps.`, (id) => [fans(id, 12), morale(id, 6)]], [3, 'bad', (n) => `${n.last} cracks on the high note. It's rough.`, (id) => [fans(id, -6), morale(id, -4)]]] },
      { label: 'Play the recording', emoji: '📼', out: [[1, 'neutral', () => 'A fine recording. Nobody cares.', () => []]] },
      { label: 'Team sings together', emoji: '🫂', out: [[3, 'good', () => 'A chaotic, loud, delightful group sing.', () => [chem(4), teamFans(2)]], [1, 'bad', () => 'It sounds terrible and the crowd laughs.', () => [teamFans(-2)]]] },
    ],
  },
  {
    id: 'pre-sleep', when: 'preGame', emoji: '😴', who: young, title: (n) => `${n.last} overslept`,
    text: (n) => `${n.full} strolled in 20 minutes late with pillow marks on his face. The vets are watching how you handle it.`,
    choices: [
      { label: 'Fine him', emoji: '💸', out: [[2, 'good', (n) => `${n.last} gets the message. The vets nod.`, () => [chem(2)]], [2, 'bad', (n) => `${n.last} pouts. The room goes quiet.`, (id) => [morale(id, -6)]]] },
      { label: 'Laugh it off', emoji: '😂', out: [[2, 'good', (n) => `${n.last} promises to set three alarms. Team loves it.`, (id) => [morale(id, 4), chem(1)]], [2, 'bad', () => 'The vets feel nobody respects the rules now.', () => [chem(-3)]]] },
      { label: 'Make him carry the bags', emoji: '🧳', out: [[3, 'good', (n) => `${n.last} carries every bag with a smile. A bonding moment.`, () => [chem(3)]], [1, 'bad', (n) => `${n.last} is humiliated and tweets about it.`, (id) => [morale(id, -8), fans(id, -3)]]] },
    ],
  },
  {
    id: 'pre-haircut', when: 'preGame', emoji: '💈', who: starter, title: (n) => `${n.last}'s new look`,
    text: (n) => `${n.full} shows up with a brand-new haircut. The staff is unsure. The cameras love it. Do you comment?`,
    choices: [
      { label: 'Hype it up', emoji: '🔥', out: [[3, 'good', (n) => `${n.last} struts onto the floor. Confidence is up.`, (id) => [morale(id, 5), buff(id, 'shooting', 2, 2)]], [1, 'bad', () => 'It looks awful. The memes begin.', (id) => [fans(id, -5)]]] },
      { label: 'Roast it', emoji: '😈', out: [[2, 'good', () => 'Locker room cracks up. Great bonding.', () => [chem(3)]], [2, 'bad', (n) => `${n.last} doesn't find it funny.`, (id) => [morale(id, -6)]]] },
      { label: 'Say nothing', emoji: '🤐', out: [[1, 'neutral', () => 'Nobody mentions it. Everyone thinks about it.', () => []]] },
    ],
  },
  {
    id: 'pre-speech', when: 'preGame', emoji: '🎙️', title: () => 'Pre-game speech time',
    text: (n) => `Coach ${n.last} wants to give a speech but isn't sure what kind. The team is waiting.`,
    choices: [
      { label: 'Fiery motivation', emoji: '🔥', out: [[2, 'good', () => 'The room is on fire. The team is locked in.', () => [teamBuff('shooting', 2, 1), teamMorale(3)]], [2, 'bad', () => 'A little too intense. A few guys tighten up.', () => [teamBuff('shooting', -2, 1)]]] },
      { label: 'Crack a joke', emoji: '😆', out: [[3, 'good', () => 'Everybody is loose and laughing.', () => [chem(3), teamMorale(2)]], [1, 'bad', () => 'The joke bombs. Awkward silence.', () => [chem(-1)]]] },
      { label: 'Silence and a stare', emoji: '😶', out: [[1, 'good', () => 'Silence. Then roars. Weirdly effective.', () => [teamBuff('defense', 3, 1)]], [2, 'neutral', () => 'The team looks confused, then dresses.', () => []]] },
    ],
  },
  {
    id: 'pre-sneakers', when: 'preGame', emoji: '👟', who: starter, title: (n) => `${n.last} got custom sneakers`,
    text: (n) => `A sponsor sent ${n.full} limited-edition sneakers: glowing, loud, and rumored to be... too bouncy.`,
    choices: [
      { label: 'Wear them tonight', emoji: '✨', out: [[2, 'good', (n) => `${n.last} floats. The crowd goes nuts.`, (id) => [fans(id, 6), buff(id, 'shooting', 3, 1)]], [2, 'bad', (n) => `The soles are too slippery. ${n.last} struggles.`, (id) => [buff(id, 'shooting', -4, 1)]]] },
      { label: 'Save them for later', emoji: '📦', out: [[1, 'neutral', () => 'The sneakers sit in a box.', () => []]] },
      { label: 'Give them to a fan', emoji: '🎁', out: [[3, 'good', (n) => `${n.last} makes a kid's year. The internet melts.`, (id) => [fans(id, 8), teamFans(2)]], [1, 'bad', (n) => `The sponsor is mad at ${n.last}.`, (id) => [morale(id, -3)]]] },
    ],
  },
  {
    id: 'pre-halfcourt', when: 'preGame', emoji: '🎯', title: () => 'Half-court shot contest',
    text: () => 'A fan in the stands won tonight\'s half-court shot contest... and wants to challenge one of your players to a shooting duel.',
    choices: [
      { label: 'Accept the duel', emoji: '🥊', out: [[2, 'good', () => 'Your guy wins. The crowd loses it.', () => [teamFans(7)]], [2, 'bad', () => 'The fan drains it. Social media has a field day.', () => [teamFans(-5)]]] },
      { label: 'Politely decline', emoji: '🙏', out: [[1, 'neutral', () => 'No duel. No story.', () => []]] },
      { label: 'Invite him to practice', emoji: '🏀', out: [[2, 'good', () => 'He shows up and everybody has fun.', () => [teamFans(3), chem(1)]], [1, 'bad', () => 'He crushes the rookies in front of the staff.', () => [teamMorale(-2)]]] },
    ],
  },
  {
    id: 'pre-karaoke', when: 'preGame', emoji: '🎶', title: () => 'Karaoke on the team bus',
    text: (n) => `Somebody turned on a karaoke app on the bus. Coach ${n.last} is being pushed to take the mic.`,
    choices: [
      { label: 'Sing', emoji: '🎤', out: [[2, 'good', () => 'Coach sings an off-key classic. The bus is roaring.', () => [chem(4)]], [2, 'bad', () => 'The video leaks. Coach looks silly.', () => [teamFans(-2), chem(1)]]] },
      { label: 'Pass the mic to a rookie', emoji: '🫣', out: [[2, 'good', () => 'The rookie is a star. Surprise!', () => [teamMorale(3), chem(2)]], [2, 'bad', () => 'The rookie freezes. The bus teases him.', () => [teamMorale(-2)]]] },
      { label: 'Turn it off', emoji: '📴', out: [[1, 'neutral', () => 'A quiet ride. Slightly dull.', () => []]] },
    ],
  },
  {
    id: 'pre-b2b', when: 'preGame', emoji: '🥱', who: starter, title: (n) => `${n.last} looks drained`,
    text: (n) => `${n.full} has been grinding for weeks. He says he's fine. He is not fine.`,
    choices: [
      { label: 'Ice bath and nap', emoji: '🧊', out: [[3, 'good', (n) => `${n.last} bounces back. Fresh legs.`, (id) => [buff(id, 'energy', 20, 2), morale(id, 3)]], [1, 'neutral', () => 'A nap changes little.', () => []]] },
      { label: 'Push through', emoji: '😤', out: [[1, 'good', (n) => `${n.last} turns it on. A true warrior.`, (id) => [fans(id, 4)]], [3, 'bad', (n) => `${n.last} is sluggish all night.`, (id) => [buff(id, 'energy', -20, 1), morale(id, -3)]]] },
      { label: 'Rest him tonight', emoji: '🛌', out: [[2, 'good', (n) => `${n.last} sits and is grateful. Rested and ready.`, (id) => [rest(id), morale(id, 6)]], [1, 'bad', () => 'The fans wonder where he is. The crowd boos.', (id) => [rest(id), fans(id, -4)]]] },
    ],
  },
  {
    id: 'pre-tunnelfit', when: 'preGame', emoji: '🕶️', who: starter, title: (n) => `${n.last}'s tunnel fit is... a lot`,
    text: (n) => `${n.full} shows up in a full sequined suit and sunglasses for the walk into the arena. The cameras are already rolling.`,
    choices: [
      { label: 'Hype it up', emoji: '📸', out: [[3, 'good', (n) => `The fit goes viral. ${n.last} walks in ten feet tall.`, (id) => [fans(id, 8), buff(id, 'shooting', 2, 1)]], [1, 'bad', (n) => `The internet is merciless. ${n.last} is rattled.`, (id) => [fans(id, -5), buff(id, 'shooting', -2, 1)]]] },
      { label: 'Ask him to tone it down', emoji: '👔', out: [[2, 'neutral', () => 'He swaps to a plain hoodie. Grumbling.', (id) => [morale(id, -2)]], [1, 'bad', (n) => `${n.last} feels like you're killing his vibe.`, (id) => [morale(id, -6)]]] },
      { label: 'Wear a matching one', emoji: '🪩', out: [[2, 'good', () => 'Coach and player in sequins. The locker room loses it.', () => [chem(4), teamFans(3)]], [2, 'bad', () => 'You look ridiculous. So does the team, by association.', () => [teamFans(-3)]]] },
    ],
  },
  {
    id: 'pre-routine', when: 'preGame', emoji: '🔁', who: vet, title: (n) => `${n.last}'s routine got broken`,
    text: (n) => `Someone parked in ${n.full}'s spot and ate his pre-game banana. He has done the same routine for nine years. He is not okay.`,
    choices: [
      { label: 'Find him a banana. Now.', emoji: '🍌', out: [[3, 'good', (n) => `Banana secured. ${n.last} is at peace.`, (id) => [morale(id, 3)]], [1, 'bad', () => 'It\'s the wrong kind of banana.', (id) => [buff(id, 'shooting', -3, 1)]]] },
      { label: 'Tell him it\'s just a banana', emoji: '🙄', out: [[1, 'good', (n) => `${n.last} laughs at himself. Growth.`, (id) => [morale(id, 2)]], [2, 'bad', (n) => `${n.last} is in his own head all night.`, (id) => [buff(id, 'all', -3, 1), morale(id, -3)]]] },
      { label: 'Find the culprit', emoji: '🕵️', out: [[2, 'good', () => 'A rookie confesses. Everyone laughs it off.', () => [chem(2)]], [2, 'bad', () => 'The interrogation splits the room.', () => [chem(-3)]]] },
    ],
  },
  {
    id: 'pre-refs', when: 'preGame', emoji: '🦓', title: () => 'Tonight\'s refs call everything',
    text: (n) => `An assistant brings Coach ${n.last} a report: tonight's crew calls fouls on everything. Play it safe, or play through it?`,
    choices: [
      { label: 'Play clean, stay out of trouble', emoji: '🧼', out: [[2, 'good', () => 'Disciplined defense. Few fouls.', () => [teamBuff('defense', 2, 1)]], [2, 'bad', () => 'Too soft. They score at will.', () => [teamBuff('defense', -2, 1)]]] },
      { label: 'Attack the rim, get to the line', emoji: '🚀', out: [[2, 'good', () => 'Free throws for days.', () => [teamBuff('shooting', 3, 1)]], [2, 'bad', () => 'The refs swallow their whistles on your end, of course.', () => [teamBuff('energy', -10, 1)]]] },
      { label: 'Ignore the report', emoji: '🗑️', out: [[2, 'neutral', () => 'A normal game.', () => []], [1, 'good', () => 'The team plays loose.', () => [teamMorale(1)]]] },
    ],
  },
  {
    id: 'pre-sign', when: 'preGame', emoji: '🪧', who: starter, title: (n) => `A fan sign is roasting ${n.last}`,
    text: (n) => `Behind the visitors' bench, a giant sign mocks ${n.full}'s last missed free throw. It has a drawing. It's a good drawing.`,
    choices: [
      { label: 'Tell him to use it as fuel', emoji: '⛽', out: [[3, 'good', (n) => `${n.last} is locked in. Revenge mode.`, (id) => [buff(id, 'shooting', 3, 1)]], [1, 'bad', (n) => `${n.last} presses all night.`, (id) => [buff(id, 'shooting', -3, 1)]]] },
      { label: 'Ask security to take it down', emoji: '👮', out: [[1, 'neutral', () => 'The sign disappears. The crowd boos.', () => []], [2, 'bad', () => 'Now it\'s a story: "Team scared of a sign."', (id) => [fans(id, -4)]]] },
      { label: 'Have him sign the sign', emoji: '✍️', out: [[3, 'good', (n) => `${n.last} autographs it after warmups. Instant legend.`, (id) => [fans(id, 9)]], [1, 'bad', () => 'The fan refuses. Awkward.', (id) => [morale(id, -3)]]] },
    ],
  },
  {
    id: 'pre-analytics', when: 'preGame', emoji: '📊', title: () => 'The analytics guy has a plan',
    text: () => 'The new analytics hire slides a spreadsheet across the table: "Tonight we shoot only threes and layups. Nothing in between."',
    choices: [
      { label: 'Trust the math', emoji: '🧮', out: [[2, 'good', () => 'The threes are falling. The nerds were right.', () => [teamBuff('shooting', 3, 1)]], [2, 'bad', () => 'Brick city. The math was not right tonight.', () => [teamBuff('shooting', -3, 1)]]] },
      { label: 'Trust the vets', emoji: '🧓', out: [[2, 'good', () => 'The vets appreciate it.', () => [chem(2)]], [1, 'bad', () => 'The analytics guy sulks in the war room.', () => []]] },
      { label: 'Split the difference', emoji: '⚖️', out: [[2, 'neutral', () => 'A sensible game plan.', () => []], [1, 'good', () => 'A balanced attack. Nice.', () => [teamBuff('all', 1, 1)]]] },
    ],
  },
  {
    id: 'pre-shootaround', when: 'preGame', emoji: '💤', title: () => 'Shootaround or nap?',
    text: () => 'Late flight last night. The team is yawning. Do you hold the morning shootaround?',
    choices: [
      { label: 'Hold shootaround', emoji: '🏀', out: [[2, 'good', () => 'The rhythm is there.', () => [teamBuff('shooting', 2, 1)]], [2, 'bad', () => 'Heavy legs by the fourth quarter.', () => [teamBuff('energy', -10, 1)]]] },
      { label: 'Cancel, everyone naps', emoji: '😴', out: [[3, 'good', () => 'Fresh legs all night.', () => [teamBuff('energy', 12, 1)]], [1, 'bad', () => 'Rusty early. Very rusty.', () => [teamBuff('shooting', -2, 1)]]] },
      { label: 'Walkthrough only', emoji: '🚶', out: [[2, 'neutral', () => 'Fine. Nothing special.', () => []], [1, 'good', () => 'Just enough.', () => [teamBuff('all', 1, 1)]]] },
    ],
  },
]
export const PRE_GAME_EVENTS = S.map(event)
