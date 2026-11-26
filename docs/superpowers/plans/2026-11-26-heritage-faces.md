# Heritage-aware Names & Faces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every generated person rolls a heritage first; names and faces both come from it, and old saves are re-skinned from their names.

**Architecture:** Heritage (5 buckets) is encoded in the low 3 bits of `faceSeed`, so the ~20 `<Face seed=…>` call sites need no changes. `engine/face/heritage.ts` owns the type, encode/decode and the weighted roll; `names.ts` gets tagged per-bucket pools; `generateFace` reads per-bucket weight tables; new SVG parts add variety for every bucket; a v11→v12 migration recomputes `faceSeed` from names.

**Tech Stack:** React + TypeScript + Vite, Vitest, pure-TS engine using `Rng` (no `Math.random`).

**Spec:** `docs/superpowers/specs/2026-11-26-heritage-faces-design.md`

## Global Constraints

- Buckets: `american | african | asian | latino | european`. Roll weights: american 50%, the other four 12.5% each (tunable constants).
- ~12% of new players are "mixed": face follows the rolled heritage, one name part comes from another bucket (usually american).
- Heritage is rolled **first**; name and face come from it. It is only *inferred from a name* in the save migration (surname bucket wins; if the surname is american/generic, the first name decides; untagged names = american).
- No caricature: no slit-line eyes, no sensei beards/moustaches, no heritage-coded costume items. Asian eyes: slightly narrower/sharper, gently upturned, soft lid line, same drawing style as other eyes.
- Cornrows/braids/locs: common on african, fairly common on darker-skinned american, rare on latino, never on asian/european.
- Light eye colours only for european/american (rarely latino). Dyed hair colours ~3% in every bucket.
- Engine rules: no React/DOM/`Math.random` in `src/engine/`; face code uses its own `Rng`, never the league RNG; saves stay JSON-serialisable.
- No change to ratings, sim results or engine randomness beyond name/face picking.
- Run `npm test` and `npm run typecheck` before every ship; ship per `CLAUDE.md` (merge to `main`, check the Deploy workflow is green).

## Review Focus

- Any `faceSeed` (0, negative, > 2^31, fan/persona seeds, hand-edited saves) decodes to a valid heritage and renders without throwing.
- A name in no pool (custom/removed/typo'd) infers `american` in the migration, never throws.
- Every new hair/eye/nose/mouth index renders at every age (greying, receding hairline) and no table references an out-of-range index.
- `generateFace(seed)` is deterministic and independent of league RNG state; same seed twice gives identical specs.
- Every bucket's name pools are non-empty and a mixed-name pick never returns an empty/undefined part.
- Migration is idempotent (re-running on a v12 league changes nothing) and chains correctly from v9/v10 saves.

---

## File Structure

- Create `src/engine/face/heritage.ts` — `Heritage` type, weights, `encodeHeritage`, `decodeHeritage`, `rollHeritage`.
- Create `src/engine/face/tables.ts` — per-heritage weighted tables for skin, hair, hair colour, eyes, eye colour, brows, nose, mouth, head, facial hair.
- Modify `src/engine/data/names.ts` — tagged pools, `pickName`, `heritageOfName` (keep `FIRST_NAMES`/`LAST_NAMES` as unions).
- Modify `src/engine/face/face.ts` — heritage-driven `generateFace`; bump `FACE_VARIANTS`.
- Modify `src/ui/face/parts.tsx`, `src/ui/face/colors.ts` — new hair/eyes/nose/mouth (and any colours).
- Modify `src/engine/player/generate.ts`, `src/engine/coach/generate.ts`, `src/engine/stories/social.ts` — roll heritage first, encode into seed.
- Modify `src/save/migrate.ts`, `src/engine/types.ts`, `src/engine/league/create.ts` — version 12 migration.
- Modify `src/ui/FaceGallery.tsx` — heritage filter for review.
- Tests: `tests/engine/heritage.test.ts`, `tests/engine/names.test.ts`, `tests/engine/face.test.ts` (extend), `tests/engine/faceParts.test.ts`, `tests/save/heritageMigration.test.ts`.

---

### Task 1: Heritage core

**Files:**
- Create: `src/engine/face/heritage.ts`
- Test: `tests/engine/heritage.test.ts`

**Interfaces:**
- Produces:
  - `type Heritage = 'american' | 'african' | 'asian' | 'latino' | 'european'`
  - `const HERITAGES: readonly Heritage[]` (that order = codes 0–4)
  - `const HERITAGE_WEIGHTS: Record<Heritage, number>` (50 / 12.5 ×4)
  - `encodeHeritage(seed: number, h: Heritage): number` — keeps high bits, sets low 3 bits to the code, result ≥ 8 and ≤ 2^31−1
  - `decodeHeritage(seed: number): Heritage` — total function; codes 5–7, NaN, negatives and huge values → `'american'`
  - `rollHeritage(rng: Rng): Heritage` — weighted by `HERITAGE_WEIGHTS`

- [ ] **Step 1: Write failing tests** in `tests/engine/heritage.test.ts`: round-trip `decodeHeritage(encodeHeritage(s, h)) === h` for every `h` over 200 seeds; `encodeHeritage` result is an int in `[8, 2**31-1]`; `decodeHeritage` of `0, -5, NaN, 2**40, 5, 6, 7` returns a valid `Heritage` and never throws; over 20 000 `rollHeritage` draws from `Rng.fromSeed(1)` each bucket is within ±1.5 points of its weight.
- [ ] **Step 2: Run** `npx vitest run tests/engine/heritage.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement** the interface above in `heritage.ts`; roll via `rng.weighted(HERITAGES, (h) => HERITAGE_WEIGHTS[h])`.
- [ ] **Step 4: Run** the same command — expect PASS.
- [ ] **Step 5: Commit** `feat: heritage core (roll, encode, decode)`.

### Task 2: Tagged name pools

**Files:**
- Modify: `src/engine/data/names.ts`
- Test: `tests/engine/names.test.ts` (also confirm `tests/engine/data.test.ts` still passes)

**Interfaces:**
- Consumes: `Heritage`, `HERITAGES` (Task 1), `Rng`.
- Produces:
  - `NAME_POOLS: Record<Heritage, { first: string[]; last: string[] }>` — non-american pools enumerated explicitly; american = every other existing name. Existing exports `FIRST_NAMES`/`LAST_NAMES` stay as the de-duplicated unions of all pools.
  - `pickName(rng: Rng, heritage: Heritage): { firstName: string; lastName: string }` — ~88% both parts from `heritage`'s pool; otherwise one random part (chosen by the rng) comes from `american` (80%) or another random bucket (20%).
  - `heritageOfName(firstName: string, lastName: string): Heritage` — surname's bucket wins unless that bucket is `american`, then the first name's bucket; names in no non-american pool count as `american`.

- [ ] **Step 1: Write failing tests**: every bucket has ≥ 40 first and ≥ 40 last names (non-american) and american ≥ 200 each; no name appears in two buckets' pools; `FIRST_NAMES`/`LAST_NAMES` contain no duplicates; `heritageOfName('Hiro','Tanaka') === 'asian'`, `('Kofi','Williams') === 'african'`, `('Jamal','Kim') === 'asian'`, `('Zzz','Qqq') === 'american'`; over 10 000 `pickName(rng, 'asian')` calls ≈ 12% (±2 pts) have a part outside the asian pool and no part is ever empty/undefined, for every heritage.
- [ ] **Step 2: Run** `npx vitest run tests/engine/names.test.ts` — expect FAIL.
- [ ] **Step 3: Implement.** Tag existing names: African (e.g. Adebayo, Emeka, Kofi, Kwame, Chidi, Nnamdi, Osei, Sekou, Abara, Adeyemi, Okafor, Okeke, Nnaji, Nwosu, Oduya, Okonkwo, Oyelaran, Diallo, Kamara, Ugwu, Ibaka, Eze, Amadi, Ezeli, Adewale), Asian (Hiro, Kenji, Dev, Kiran, Chen, Kim, Nguyen, Park, Patel, Huang, Ikeda, Kapoor, Nakamura, Sato, Tanaka, Yamamoto, Yoon, Chaudhry…), Latino (Alejandro, Andres, Carlos, Diego, Javier, Jose, Luis, Pablo, Acosta, Alvarez, Cruz, Garcia, Gonzalez, Hernandez, Lopez, Martinez, Rodriguez, Silva…), European (Boban, Bojan, Dejan, Domantas, Giannis, Kristaps, Luka, Nikola, Lars, Bogdan, Kovac, Petrovic, Novak, Jovanovic, Kowalski, Larsen, Lindqvist, Zielinski, Stavros…). Then **add** new tagged names so the minimums above are met (real, common names; avoid caricature). Everything not tagged stays american.
- [ ] **Step 4: Run** `npx vitest run tests/engine/names.test.ts tests/engine/data.test.ts` — expect PASS.
- [ ] **Step 5: Commit** `feat: tag name pools by heritage, add pickName/heritageOfName`.

### Task 3: Generate people from heritage

**Files:**
- Modify: `src/engine/player/generate.ts:262-268`, `src/engine/coach/generate.ts:10-12`, `src/engine/stories/social.ts:26`
- Test: `tests/engine/player.test.ts` (extend)

**Interfaces:**
- Consumes: `rollHeritage`, `encodeHeritage`, `decodeHeritage` (Task 1); `pickName` (Task 2).
- Produces: players and coaches whose `faceSeed` decodes to the heritage their name was drawn from; story fans get `seed: encodeHeritage(rng.int(1, 2 ** 30), rollHeritage(rng))`.

- [ ] **Step 1: Write failing tests**: over 3 000 `generatePlayer` calls, `decodeHeritage(p.faceSeed)` frequencies match the weights (±3 pts); for players with no mixed part, `heritageOfName` equals the decoded heritage for ≥ 95% of non-american rolls; a generated coach's `faceSeed` decodes to a valid heritage and `faceSeed` stays an int in `[8, 2**31-1]`.
- [ ] **Step 2: Run** `npx vitest run tests/engine/player.test.ts` — expect FAIL.
- [ ] **Step 3: Implement**: in `generatePlayer` and `generateCoach` call `rollHeritage(rng)` → `pickName(rng, h)` → `faceSeed = encodeHeritage(rng.int(1, 2 ** 31 - 1), h)` in place of the two `rng.pick` name calls and the raw seed roll. This shifts the league RNG stream for new leagues (accepted); if any test asserts on specific generated names/values, update its expectation.
- [ ] **Step 4: Run** `npm test` — expect PASS (fix expectation-only failures from the shifted stream).
- [ ] **Step 5: Commit** `feat: roll heritage first when generating players and coaches`.

### Task 4: Heritage-driven `generateFace`

**Files:**
- Create: `src/engine/face/tables.ts`
- Modify: `src/engine/face/face.ts`
- Test: `tests/engine/face.test.ts` (extend)

**Interfaces:**
- Consumes: `decodeHeritage`, `Heritage`.
- Produces: `FACE_TABLES: Record<Heritage, Partial<Record<VariantKey, { value: number; weight: number }[]>>>` and per-key none-rates (bald, facial hair, accessory); `generateFace(seed): FaceSpec` signature unchanged, now `const h = decodeHeritage(seed)` then weighted picks from `FACE_TABLES[h]`, with a ~3% "wildcard" chance per key to draw from any valid variant (except the forbidden-hair rule below).
- Hair rule: cornrows/braids/locs (current indices 13 and 20; twists 12 only for african/american/latino-rare) have weight 0 for asian and european; for american they are weighted up when `skin >= 8`. Skin is rolled before hair so hair can depend on it.
- Starting table values use the **existing** variants only (new art comes in Task 5). Current hair index reading: 1–2 short, 3 flat-top, 4–5 afro, 6 curls/knots, 7 waves, 8 lined fade, 9 mohawk, 10 top-knot, 11 long, 12 twists, 13 cornrows/braids, 14 side-swept, 15 spiky, 16 tall box, 17 receded sides, 18 bun, 19 long straight, 20 locs, 21 swoop — verify each in the gallery and correct the table if a reading is wrong.
- Skin: european 0–5, asian 0–4 (some 5–6), latino 1–8, african mostly 7–11 (a few 5–6), american any (middle-weighted). Hair colour: african/asian/latino ≈ always 0–1 (very dark) bar the 3% dyed; european/american full natural range. Eye colour: dark for african/asian; light possible for european/american; rare for latino.

- [ ] **Step 1: Write failing tests** in `face.test.ts`: over 4 000 seeds per heritage (`encodeHeritage(i, h)`), assert — asian and european never get hair 13 or 20; asian skin ≤ 6 and ≥ 90% ≤ 4; african skin ≥ 5 and ≥ 85% ≥ 7; african hair is textured (4,5,6,12,13,20,16,1,2,8) in ≥ 80%; asian/african/latino natural hair colour index ≤ 1 in ≥ 95%; only european/american/latino-rare get eyeColor ≥ 3 (bar the 3% wildcard); `generateFace(s)` deep-equals itself for the same seed; all picks are within `[0, FACE_VARIANTS[k])`.
- [ ] **Step 2: Run** `npx vitest run tests/engine/face.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** tables and the new `generateFace` (own `Rng.fromSeed`, deterministic; remove the old `BASE_VARIANTS` extra-stream logic since all faces are intentionally re-rolled).
- [ ] **Step 4: Run** `npx vitest run tests/engine/face.test.ts` — expect PASS.
- [ ] **Step 5: Commit** `feat: heritage-driven face generation`.

### Task 5: New art for every bucket

**Files:**
- Modify: `src/ui/face/parts.tsx`, `src/ui/face/colors.ts` (only if a colour is needed), `src/engine/face/face.ts` (`FACE_VARIANTS`), `src/engine/face/tables.ts`
- Test: `tests/engine/faceParts.test.ts`

**Interfaces:**
- Consumes: Task 4 tables.
- Produces: new variant indices appended at the end of each existing range (never renumber) and bumped `FACE_VARIANTS`: 
  - **Hair** (≥ 2 new per bucket): asian — bowl, curtains, undercut, textured crop, slick-back; african — high-top, waves/360, short twists, taper fade; latino — pompadour, slicked wavy; european — side-part, man-bun, curly top, long wavy. Keep `recede` and `top` handling like existing styles.
  - **Eyes** (≥ 2 new): slightly narrower/gently upturned with a soft lid crease (no slit lines); plus one wide/rounder variant for variety.
  - **Nose/mouth/head**: ≥ 1 new each where it helps a bucket look distinct; tasteful, not exaggerated.
  - Tables updated so each new part is weighted into its home buckets (and only rarely outside; hair styles that would read as costume outside their bucket stay at 0).

- [ ] **Step 1: Write failing test** in `faceParts.test.ts` (render with `react-dom/server` `renderToStaticMarkup`): for every `k` in `FACE_VARIANTS` and every index `0..FACE_VARIANTS[k]-1`, the part renders (hair/facial hair/accessory index 0 may be empty; every other index must return non-empty markup) at `recede` 0, 0.5 and 1 and does not throw; every index in `FACE_TABLES` is `< FACE_VARIANTS[k]`; each bucket's table covers ≥ 6 distinct hair values.
- [ ] **Step 2: Run** `npx vitest run tests/engine/faceParts.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the new SVG parts (100×120 viewBox, same outline/stroke style as neighbours), raise `FACE_VARIANTS`, update tables.
- [ ] **Step 4: Run** `npx vitest run tests/engine/faceParts.test.ts tests/engine/face.test.ts` — expect PASS.
- [ ] **Step 5: Visual check** (Task 7's gallery filter makes this easy; may be deferred to Task 7 Step 3): any variant that reads as a stereotype gets redrawn before shipping.
- [ ] **Step 6: Commit** `feat: new hair, eyes and features for every heritage`.

### Task 6: Save migration v11 → v12

**Files:**
- Modify: `src/save/migrate.ts` (`CURRENT_VERSION`, new step after the `version === 10` block), `src/engine/types.ts:203` (`version: 12`), `src/engine/league/create.ts:174` (`version: 12`)
- Test: `tests/save/heritageMigration.test.ts`

**Interfaces:**
- Consumes: `heritageOfName` (Task 2), `encodeHeritage` (Task 1).
- Produces: `backfillHeritage(l: League): void` (exported from `src/engine/face/heritage.ts` or `migrate.ts`; set every player's and coach's `faceSeed = encodeHeritage(oldSeed, heritageOfName(first, last))`), applied in `migrateLeague` when `raw.version === 11` → `12`. High bits of each seed are preserved so identity stays stable. Idempotent.

- [ ] **Step 1: Write failing tests**: build a v11 league (e.g. via `createLeague` then set `version = 11` and scramble seeds), run `migrateLeague`, assert `version === 12`, every player/coach `decodeHeritage(faceSeed) === heritageOfName(first, last)`, `faceSeed >> 3` unchanged vs. the original, a second `migrateLeague` leaves seeds unchanged, a v9 save chains all the way to 12, and a player with a name in no pool becomes `american`.
- [ ] **Step 2: Run** `npx vitest run tests/save/heritageMigration.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the step and version bumps; update any test fixtures that hard-code version 11.
- [ ] **Step 4: Run** `npm test` and `npm run typecheck` — expect all PASS.
- [ ] **Step 5: Commit** `feat: v12 save migration re-skins players by name heritage`.

### Task 7: Gallery review, docs, ship

**Files:**
- Modify: `src/ui/FaceGallery.tsx` (heritage selector: seeds built with `encodeHeritage` for the chosen bucket, default "all"), `CLAUDE.md` (save version 9→12 wording, add a heritage/faces bullet)

- [ ] **Step 1: Add** the heritage filter to the gallery (dev route `/dev/faces`).
- [ ] **Step 2: Run** `npm run dev`, and with Playwright (pre-installed Chromium, `deviceScaleFactor: 1`) screenshot `/dev/faces` for each of the 5 buckets; read the images and check: skin ranges, hair rules (no cornrows on asian/european), eyes look natural and not caricatured, new styles all look good.
- [ ] **Step 3: Fix** anything off in tables/art (loop back to Tasks 4–5 changes), re-screenshot.
- [ ] **Step 4: Update** `CLAUDE.md`: save format is now version 12; add: "People have a `Heritage` (american/african/asian/latino/european) rolled first and stored in the low 3 bits of `faceSeed`; names come from `NAME_POOLS`, faces from `FACE_TABLES`; heritage is only inferred from a name in migrations."
- [ ] **Step 5: Run** `npm test && npm run typecheck && npm run build` — expect all PASS.
- [ ] **Step 6: Commit**, push the working branch, fast-forward `main`, `git push origin main`, confirm the "Deploy to GitHub Pages" run is green (fix before calling done), then tell the owner the site is updated.
