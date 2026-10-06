# Moth Hack 2026 objectives → Brisque

Source: hack.mothquantum.com. Deadline 5 Oct 2026 (PT); judged on quality of execution, depth of quantum and Atlas
usage, and originality, relative to each tier. Submission form: https://airtable.com/appsrkUE9iVgeGsH5/pagdAHP56ovMdYX7x/form

## Engines in use in the game (14)

| Engine | Where | How |
|---|---|---|
| comet-qrng-v1 | game, every collapse | Live certified QPU randomness streamed during the match; bundled QPU pool as bridge and offline fallback |
| coin-toss-v1 | game start | Who opens the game, one live toss per bit |
| tomography-api-v2 | game ("live circuits"), notebook | Each battle's OpenQASM state-prep circuit, 1 shot (engine down on 5 Oct: falls back to QPU entropy) |
| entanglement-shader-v1 | 3D pieces | R/T lookup tables drive the iridescent film on troops in contested territory (split troops are translucent by their probability) |
| deep-fryer-v1 → blur-v1 | bomb impact | Chained: fried blast frames, then a quantum blur ramp → 8-frame sprite sheet |
| telablur-v1 | bomb detonation, splits | Glitch streaks for the screen-space glitch burst; full-screen post effects: ONE lobe morphed to TWO at 4 strengths (split "reality forks" double image) and a superposed cloud morphed to a point at 3 strengths (collapse pinch at detonation) |
| qpixl-v1 | bomb detonation | Torn-row offsets encoded through a noisy fake_marrakesh device |
| blur-core-v1 | bomb hover, detonation | Shot-noise "quantum static" while the measurement is in flight; quantum-blurred shockwave rings that push the whole frame outward at detonation, scaled by the outcome's entropy |
| telablur-v1 → qrc-image-v1 | splits | Chained: the telablur fork frames are the vocabulary of a quantum reservoir that learns the fork/rejoin cycle and generates 96 frames; every split plays a window of that generated order (including the reservoir's own stutters) |
| tamagotchi-v1 | physics page | Steane-code error-correction survival curve (decoherence lesson) |
| graph-v1 | game start, notebook | CPU temperaments + rivalries from one entangled state (after Wootton 2020); entangled territory graph |
| qrc-train-v2 → qrc-gen-v2 | game over | A quantum reservoir learns the war's moves and predicts the next 16 |

Parameters, job ids and timings: `public/generated/manifest.json`, `audio-src/moth-jobs.json`,
`public/generated/tamagotchi-v1/qec.json`, `notebook/runs/`. Tessa (`tessa-image-v1`) timed out on Moth's side on
5 Oct; its recipe is ready (`node tools/prerender/run.mjs tessa-board`).

The separate audio project in `../brisque-extra` (never in the game) also used otoc-echo-v1, retrocausal-echo-v1
and qrc-audio-v1.

## Challenges

| # | Challenge (tier, prize) | What we submit | Status |
|---|---|---|---|
| 1 | One image, one engine (B, £100) | Board screenshot and blast sheet through blur-v1, before/after + params (`release/submission/one-image/`) | ready |
| 2 | Make it audible (B, £100) | Separate project in `../brisque-extra/` (Moth-rendered SFX, not in the game) | optional |
| 3 | Three dimensions (B, £100) | Entanglement Shader LUTs on the 3D board, in the trailer | ready |
| 4 | Moving image (I, £150) | Trailer (`release/brisque-trailer.mp4`) | ready |
| 5 | Quantum game (I, £150) | The game: https://brisque.noelnegash.workers.dev (GQGJ closed 27 Sept) | ready |
| 6 | Daisy Chain (I, £150) | 14 engines above, each with a job in the game, plugin, notebook or physics page | ready |
| 7 | Make a VST or AU (I, £150) | Separate project in `../brisque-extra/` (Film and Split plugins in progress) | in progress |
| 8 | Make a web app (I, £150) | The game calls Atlas live through the Worker proxy (comet-qrng, coin-toss, tomography) | ready |
| 9 | Quantum-native 1 (E, £200) | This repo | ready |
| 10 | Quantum-native 2 (E, £200) | `notebook/brisque_moth_workflow.ipynb` (+ HTML export) | ready |
| 11 | FQxI (guest, £150) | "How to play → The quantum inside": measurable battle qubit, QEC chart, every rule as physics | ready |
