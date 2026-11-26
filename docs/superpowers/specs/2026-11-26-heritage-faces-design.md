# Heritage-aware names & faces — design

## Why
Randomized players mix names and looks at random: an Asian-sounding name with a blond afro, or a "Kofi" with a bowl cut. It happens often enough to break immersion. The owner (who is Asian and fine with realistic features) wants names and faces that make sense together, while still allowing the variety real life has.

## Goals
- Every generated person (player, coach, story persona) has a **heritage** (5 buckets) that drives name pools *and* face rolls.
- Faces fit the heritage: skin tone range, hair style (e.g. cornrows/braids/locs are common on African and some American players, rare elsewhere), hair colour, eye shape, facial hair tendencies.
- **New art for every bucket** (hair, eyes, a few noses/mouths/heads where useful), not just Asian.
- Existing saves get fixed too: heritage is inferred from the existing name, so old players are re-skinned by the new rules.
- **Heritage is rolled first**, then name and face are both drawn from it. Starting weights (tunable constants): american 45%, african 22%, latino 13%, asian 10%, european 10%.
- ~12% of players are "mixed": the face follows the rolled heritage, but one name part comes from another bucket (usually american, e.g. "Hiro Williams", "Jamal Kim"), as happens in real life.

## Non-goals / anti-goals
- No caricature. No slit-line "squint" eyes, no sensei-style beards/moustaches, no costume items tied to a heritage. Asian eyes are slightly smaller / sharper / gently upturned with a soft lid line, drawn in the same style as the other eyes.
- No hard locks. Every style keeps a small chance outside its home buckets so it never looks like a lookup table, except where it would read as a costume.
- No change to ratings, sim results or any engine randomness outside face/name picking.

## Buckets
`american`, `african`, `asian`, `latino`, `european`.

| Bucket | Names | Skin (12 tones, 0 light … 11 dark) | Hair |
|---|---|---|---|
| american | generic US names; default for any untagged name | any (weights favour the middle) | any; darker skin leans textured styles |
| african | Yoruba/Igbo/Akan/Swahili/Francophone-African names (Okafor, Kofi, Diallo…) | mostly 7–11, a few 5–6 | mostly textured: afro, fade, twists, locs, braids/cornrows |
| asian | East/SE/South Asian names (Tanaka, Kim, Nguyen, Patel, Hiro…) | mostly 0–4, some 5–6 | straight/black: bowl, curtains, undercut, buzz, slick-back; no cornrows/braids/locs |
| latino | Spanish/Portuguese names (Cruz, Alejandro, Silva…) | 1–8 | straight/wavy/slick; pompadour; occasional fade/braids at low rate |
| european | Slavic/Nordic/Germanic/Mediterranean (Kovac, Giannis, Larsen…) | 0–5 | straight/wavy/curly; lighter colours common; no cornrows/locs |

Hair colour: asian/african/latino almost always very dark; european and american get the full natural range; dyed colours stay rare (~3%) in every bucket. Eye colour: light eyes only for european/american (and rarely latino). Facial hair: same overall rate, but style weights differ a little per bucket.

## How it fits the code
- **Name tagging:** `engine/data/names.ts` gets explicit per-bucket lists for first and last names (non-American buckets enumerated; everything untagged = american). Helpers: `rollHeritage(rng)`, `pickName(rng, heritage)` → `{firstName, lastName}`, and `heritageOfName(first, last)` (migration only).
  - **New players:** `rollHeritage(rng)` runs first; then first and last name come from that bucket, with the ~12% mixed case swapping one part. Face heritage = the rolled heritage (never re-inferred).
  - **Old saves only (migration):** heritage is inferred from the name. Surname bucket wins; if the surname is american/generic, the first-name bucket decides.
  - New pools are added where the lists are thin (esp. asian and african surnames, latino and european first names).
- **Heritage travels in `faceSeed`:** `Face` only receives `seed` + `age` at ~20 call sites. Instead of threading a new prop everywhere, the low 3 bits of `faceSeed` encode the heritage and `generateFace` decodes it. `faceSeed` is therefore (random high bits | heritage code).
- **`generateFace(seed)`** is rewritten to take weighted per-bucket tables for skin, hair, hairColor, eyes, eyeColor, brows, nose, mouth, head, facialHair. Draw order inside is free to change (all faces are re-rolled by design); it stays deterministic and uses only its own RNG.
- **New art in `ui/face/parts.tsx` / `colors.ts`:** hair styles for each bucket (asian: bowl, curtains, undercut, textured crop, slick-back; african: high-top, waves, short twists, taper; latino: pompadour, slick wavy; european: side-part, man-bun, curly top, long wavy), a few new eye variants (soft, slightly upturned/narrower, no slit lines), plus a couple of extra noses/mouths. `FACE_VARIANTS` counts grow accordingly.
- **Save migration:** bump `League.version` 9 → 10. Migration recomputes each player's and coach's `faceSeed` from their name (`heritageOfName`), keeping the high bits so each person keeps a stable identity. Nothing else in the save changes.
- **Other `Face` users** with bare seeds (story personas, award records, `Stories.tsx`) get heritage the same way; the builder checks where those seeds come from and makes sure they are heritage-tagged at creation (or default to american).

## Approaches considered
1. **Heritage in the face seed + tagged name pools (chosen).** No new props, no save-shape change beyond one migration, fixes old saves.
2. Store `heritage` on every person and pass it as a prop. Cleaner type, but touches ~20 components and the save shape for little gain.
3. Derive heritage from the name at render time. No migration, but a lookup per render and ambiguous for mixed names; the seed approach is cheaper and exact.

## Testing
- Unit: `rollHeritage` weights and `pickName` mix rate; `heritageOfName` rules; `generateFace` distribution per bucket over a large sample (skin range, forbidden hair styles never appear for asian/european, african mostly textured); determinism; mixed-name rate ≈ 12%; heritage rolled first never changes the face seed's decoded bucket.
- Visual: extend the existing `/dev/faces` gallery with a heritage filter and review a grid per bucket (screenshot) before shipping.
- Migration test: a v9 league loads, every `faceSeed` decodes to the heritage of that person's name.
- `npm test` and `npm run typecheck` must pass; then ship per CLAUDE.md.

## Left to the builder
Exact per-style weights, the SVG paths of the new parts, how many new name entries to add (aim for several dozen per non-american bucket), and the 3-bit code assignment. Any style/eye drawn should be eyeballed in the gallery and softened if it reads as a stereotype.
