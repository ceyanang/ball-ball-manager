# Talent level, rating grades, scouting blurbs, in-season progress, dark theme — Design

A follow-up to Milestone 1. Items marked **(call)** are Claude's proposals, which the owner approved in conversation ("go with your picks").

## Why
The owner wants a league that feels stacked: good starters and a real bench. They want to read a player at a glance (colours, letter grades and a short write-up), and to watch players rise and fall *during* a season, not only between seasons. Watching growth and decline is the core fun of the game. They also want a dark, grey UI.

## Goals
1. **Talent level:** most starters are OVR 76+, and the average bench player (rotation spots 6–12) is about 70+.
2. **Rating floor of 40 (call):** every individual rating and OVR is between 40 and 99.
3. **Free agents (call):** they sit around 60–68 OVR, so they're still usable backups.
4. **Colour-coded ratings:** bar and number colour runs on a continuous scale from **dark red at 40**, through orange and yellow, to **dark green at 99**.
5. **Letter grades:** the standard US scale.
   - A+ 97+ · A 93–96 · A− 90–92
   - B+ 87–89 · B 83–86 · B− 80–82
   - C+ 77–79 · C 73–76 · C− 70–72
   - D+ 67–69 · D 63–66 · D− 60–62
   - F <60

   Grades are shown next to every rating and OVR. Potential uses the same scale.
6. **Scouting blurb** on each player page: 1–3 sentences generated from ratings (strengths, weakness, archetype) and, once he has played, from his season stats. Purely algorithmic and deterministic per player.
7. **In-season progress (owner chose both directions):**
   - Every 10 days of the regular season, each rostered player may change.
   - Young players trend up, toward but never above their potential. Players 31+ can dip. Most ticks change nothing, and a change is usually 1–2 OVR.
   - Rough season totals: age ≤ 23 average about +2 to +4 OVR, and age 33+ about −1 to −3 **(call)**.
8. **Where changes show:**
   - A "Progress report" panel on Home: the user's team's changes, plus the league's biggest risers and fallers.
   - "+3 this season" (or "−2") on the player page.
   - The OVR chart gains a "Now" point when the current value differs from the season start.
9. **Dark grey UI** everywhere. It replaces the light theme and is not a toggle. The orange accent stays for actions, and team colours stay on headers **(call)**.

## Non-goals
Offseason progression, retirements, and the rest of Milestone 2. A light-mode toggle. Changing existing leagues' talent levels.

## Constraints
- **Sim realism:** the existing realism tests must stay green after the talent shift. That means about 105–115 PPG, FG% 44–49, and leaders around 25–36 PPG, so the sim gets recalibrated.
- **Existing saves:**
  - Save `version` goes from 1 to 2, because the `League` gains `progress` events. The migration adds `progress: []`.
  - Older leagues keep their old rating levels.
  - Import accepts version 1 and 2 and migrates.
- **No AI.** Blurbs are template-based.

## Approaches considered
- **A. Shift the whole generator up (chosen) (call):** raise the default OVR distribution, generate the initial league in tiers (star, starter, bench, deep bench), and move the sim's rating pivot (currently 60) to the new league average. It's the simplest way to keep sim balance while ratings rise.
- **B. Display-only rescale** (show OVR + 15): rejected. It's fake, and it would break the 40-floor and grade meaning.
- **C. In-season progress as cosmetic text only:** rejected. The owner wants ratings to really change, which changes results.

## Left to the builder
- Exact tier targets.
- The sim pivot constant and tuning.
- Blurb templates and wording.
- The colour stops (they must read on the dark surface).
- Exact progression probabilities, within the season-total targets above.
