# Pre-render pipeline (Moth Atlas engines → shipped assets)

Runs Moth engines once, offline, and ships their outputs in `public/generated/` so the static build
uses real engine output with **zero API calls and no key**. Every run is recorded in
[`public/generated/manifest.json`](../../public/generated/manifest.json) as
`{ recipe, engine, why, params, inputs (sha256), hash, files, job_id, ms, date }`: our evidence for
the judges (challenge 1 asks for the parameters).

```
node tools/prerender/run.mjs --list            # recipes
node tools/prerender/run.mjs --dry             # what would be submitted (no API calls)
node tools/prerender/run.mjs                   # run everything; cached recipes cost nothing
node tools/prerender/run.mjs es-peaked blur-blast
node tools/prerender/shots.mjs <outDir>        # puppeteer VFX check (needs vite on :5192)
```

- `moth.mjs`: minimal client: `submit`, `wait` (poll with backoff), `result`, `upload` (POST /assets →
  presigned PUT → /complete), `download` (presigned URL or /assets/{id}/download), `run` (all of it).
  Key from `Noel/.env` via `src/server/env.js`; never printed, never in client code.
- `run.mjs`: recipes, params-hash cache in `cache/<recipe>/<hash>/` (gitignored: raw outputs, inputs,
  meta), post-processing into `public/generated/<engine>/`, manifest. Independent recipes run in
  parallel; a recipe can consume another's output (`ctx.need`), which is the daisy chain. A submitted
  job id is saved in `pending.json` first, so an interrupted run resumes the job instead of paying again.
- `inputs.mjs`: seeded procedural inputs (blast sprite sheet, per-frame ramp mask, glitch bars / blocks,
  static grid, slab field). `img.mjs`: sharp helpers + a Radiance `.hdr` parser for the shader LUTs.

## Recipes and where they show up in the game

| Recipe | Engine | Output | Used by |
|---|---|---|---|
| `es-peaked` | entanglement-shader-v1 (`peaked`) | R/T LUT packed PNG + the engine's GLSL | iridescent film on superposed troop pieces (`pieces/pawns.js`), sampled exactly as the engine's GLSL does (3 wavelengths × film phase × incident angle, `vfx/entangle.js`) |
| `es-frustrated` | entanglement-shader-v1 (`frustrated`, interaction −1.5) | second LUT | contested metaball territories (mode 2) |
| `blur-blast` | blur-v1 + ramped per-frame mask | 8-frame blast sheet | bomb impact billboard + ground decal (`vfx/blast.js`) |
| `fry-blast` → `blur-fried` | deep-fryer-v1 → blur-v1 | fried + blurred sheet (preferred when present) | same; chain step 1 → 2 |
| `tela-glitch` | telablur-v1 (bars → blocks, horizontal) | glitch streak texture | screen glitch burst on detonation |
| `qpixl-slabs` | qpixl-v1 on `fake_marrakesh` | 20×20 noisy reconstruction | glitch row displacement (which bands tear, how far) |
| `core-static` | blur-core-v1, 64×64×8 grid, 40 000 shots | 8 frames of shot-noise static | "quantum static" around a bomb hovering while the measurement runs, and a faint static vignette |
| `tela-fork-{25,50,75,100}` | telablur-v1, one lobe → two lobes, one job per strength | `generated/telablur-v1/fork-sheet.png` (frame 0 = the source) | split "reality forks": the frame doubles into two chromatic ghosts along the move's prongs, each weighted by its branch's probability (`vfx/post.js`) |
| `qrc-fork` | qrc-image-v1 on the 5 fork frames (chain step 2) | `generated/qrc-image-v1/fork-seq.json` (96 generated tokens; GIF in `release/submission/`) | the order the fork frames play in, one window per split |
| `tela-collapse-{35,70,100}` | telablur-v1, superposed cloud → point | `generated/telablur-v1/collapse-sheet.png` | collapse pinch toward the impact at detonation |
| `core-shock` | blur-core-v1, 64×64×8 expanding rings, 40 000 shots | `generated/blur-core-v1/shock.png` | full-screen shockwave after the pinch; strength = outcome entropy |
| `blur-board` | blur-v1 on a match screenshot | `release/submission/one-image/` | "One image, one engine" submission (before/after + params) |
| `tessa-board` | tessa-image-v1 | same folder | retry when Tessa is up (it returned `engine_timeout` 3× on 2026-10-05) |

The full-screen effects are one quad drawn last that copies the frame it sits on
(`copyFramebufferToTexture`) and redraws it displaced; it is hidden (zero cost) when idle. Sheets are
assembled from `cache/_frames/` at the end of every run.

The VFX are texture-driven (`src/client/vfx/sources.js`): `setVfxSource(role, url)` swaps any source
(e.g. circuit-generated glitch frames) at runtime. Test hook: `?hover=<s>` forces the bomb to hover so
the waiting VFX can be seen offline.

Rules: never loop jobs without the cache; credits are scarce (1 per run). Deep-fryer and Tessa were
queued / timing out on 2026-10-05; `run.mjs` resumes or retries them when they come back.
