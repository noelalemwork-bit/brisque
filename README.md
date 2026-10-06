# Brisque

**Risk in superposition.** Armies split across possible futures, battles are qubits, and bombs are measurements.
Every outcome is decided by a real quantum measurement, by default certified random bits from an IBM quantum
computer, fetched live through the [Moth Quantum](https://mothquantum.com) Atlas API.

**Play:** https://brisque.noelnegash.workers.dev (desktop browser · hotseat, CPU or online with voice) ·
Built for Moth Hack 2026. New players: **Tutorial** on the home screen teaches every move in a few minutes
against a gentle sparring CPU.

## Rules

A procedurally generated island of 42 territories in 6 continents. Each turn:

| | |
|---|---|
| **Income** | `max(3, ⌊certain territories ÷ 3⌋)` troops, plus a bonus for every continent you hold *with certainty*. Probable land pays nothing. |
| **Deploy** | Up to 10 troops onto land you certainly hold. |
| **Move** | Up to 5 moves to a neighbour. Into an enemy, it starts a battle; out of one, it retreats (one troop stays). |
| **Split** | Once a turn: troops go to *one of two* places, 50/50. Both futures exist until something looks. Splitting uncertain troops again gives 25%, 12.5%… |
| **Bomb** | 5 slots, 3-turn recharge. Measures an uncertain territory in reach. One outcome becomes real, and every future that disagrees vanishes, including entangled ones elsewhere. |

A battle is unresolved until measured; each side wins with probability equal to its share of the troops. At the end
of a round, **decoherence** measures splits older than 3 rounds and battles older than 2. The winner holds the most
territory *with certainty* at the round limit, or is the last one standing.

The engine is an exact many-worlds ensemble: every branch is tracked with its full history, so entanglement,
reconvergence and cascading collapses are exact ([`docs/GAME-DESIGN.md`](docs/GAME-DESIGN.md),
full controls in [`docs/GAMEPLAY.md`](docs/GAMEPLAY.md)).

## Quantum

**Every collapse is a circuit.** The outcome odds are amplitude-encoded into a circuit (Möttönen state
preparation: uniformly controlled RY + CNOT, exported as OpenQASM 2); a two-army battle is a single
`RY(2·asin√p)`. One shot picks the outcome. Aiming a bomb previews the outcomes and the circuit that will run; the
result card shows the bitstring read and whose result it was. Press **Q** for the quantum log of every
measurement and Moth job.

| Mode (setup screen) | Decides collapses with |
|---|---|
| **Moth · live IBM QPU** (default online) | Certified QPU bits streamed during the match (comet-qrng, Bell test S > 2); bits fetched earlier bridge the first minutes |
| Moth · IBM QPU pool | Certified QPU bits shipped with the build (offline) |
| Moth · live circuits | The collapse circuit itself, run on Moth each time; falls back to QPU bits if Moth is down |
| Quantum Forge | The circuit on [Quantum Forge](https://quantum.dev)'s WebAssembly simulator, in the browser |

### Moth Atlas API

Every call goes through one client, [`mothClient`](src/shared/quantum/backend.js) (submit → poll with backoff → result),
in the browser via the Worker proxy ([`worker/src/room.js`](worker/src/room.js)) and in Node for the pre-render tools.

| Endpoint | Used for |
|---|---|
| `POST /engines/{id}/process` | Submitting every job below (with `input_files` for chained engines) |
| `GET /jobs/{id}/status`, `GET /jobs/{id}/result` | Polling and results; phases feed the quantum log ([`ui/quantumPanel.js`](src/client/ui/quantumPanel.js)) |
| `POST /assets`, `POST /assets/{id}/complete`, `GET /assets/{id}/download` | Uploading images and downloading file outputs ([`tools/prerender/moth.mjs`](tools/prerender/moth.mjs)) |
| `GET /me` | Checking the route to Moth before a live game ([`quantum.js`](src/client/quantum.js) `connectMoth`) |

| Engine | In Brisque | Where | When |
|---|---|---|---|
| `comet-qrng-v1` | Certified IBM QPU random bits decide collapses (Bell test S > 2) | [`quantum.js`](src/client/quantum.js) `createLivePool`, [`qrng.js`](src/shared/quantum/qrng.js), [`fetch-qrng.mjs`](tools/moth/fetch-qrng.mjs) | live + bundled |
| `coin-toss-v1` | Who opens the game | [`quantum.js`](src/client/quantum.js) `chooseFirst` | live |
| `tomography-api-v2` | The collapse circuit itself, as OpenQASM ("live circuits" mode) | [`backend.js`](src/shared/quantum/backend.js) `mothBackend` | live |
| `graph-v1` | CPU temperaments: one qubit per CPU of an entangled state; ⟨Z⟩ aggression, ⟨X⟩ appetite for superposition, ⟨Y⟩ expansion, ⟨ZZ⟩ rivalry | [`quantum.js`](src/client/quantum.js) `temperaments`, [`bot.js`](src/shared/game/bot.js) | live |
| `qrc-train-v2` → `qrc-gen-v2` | Game over: a quantum reservoir learns the war's moves and predicts the next 16 | [`coda.js`](src/client/coda.js), [`ui/codaView.js`](src/client/ui/codaView.js) | live |
| `entanglement-shader-v1` | Iridescent film on troops in contested territory | [`pieces/pawns.js`](src/client/pieces/pawns.js), [`vfx/entangle.js`](src/client/vfx/entangle.js) | pre-rendered |
| `telablur-v1` → `qrc-image-v1` | Splits fork the frame: a quantum morph from one to two, sequenced by a quantum reservoir | [`vfx/post.js`](src/client/vfx/post.js) | pre-rendered |
| `blur-core-v1` | Static while a measurement is in flight; the bomb's shockwave | [`vfx/blast.js`](src/client/vfx/blast.js), [`vfx/post.js`](src/client/vfx/post.js) | pre-rendered |
| `deep-fryer-v1` → `blur-v1` | The bomb blast sprite | [`vfx/blast.js`](src/client/vfx/blast.js) | pre-rendered |
| `qpixl-v1` | Torn-row glitch on detonation, through a noisy device model | [`vfx/blast.js`](src/client/vfx/blast.js) | pre-rendered |
| `tamagotchi-v1` | Steane-code error correction, for the decoherence lesson | [`qec-sweep.mjs`](tools/moth/qec-sweep.mjs), *How to play → The quantum inside* | pre-rendered |

Pre-rendered outputs ship with their exact parameters, job ids and timings in
[`public/generated/manifest.json`](public/generated/manifest.json) (pipeline: [`tools/prerender/`](tools/prerender/README.md)).
Measured latencies: [`docs/MOTH-ENGINES.md`](docs/MOTH-ENGINES.md). The workflow end to end, executed: [`notebook/`](notebook/README.md).

### Game-over prediction (quantum reservoir computing)

At game over, every accepted move becomes a token (`player:action`, e.g. `1:split`). `qrc-train-v2` trains a
5-qubit quantum reservoir on that sequence (8-move windows, 40 epochs, 1000 shots) and returns the model as an asset;
`qrc-gen-v2` warms it up on the last 8 moves and samples the next 16. The card shows the war's last moves, then the
prediction, in each player's colour. It runs live in Moth modes only (~6 credits, 1–2 minutes) and the quantum log
shows both jobs. In tests the reservoir learned the turn order (runs of one player's moves, then the next).
Code: [`coda.js`](src/client/coda.js), [`ui/codaView.js`](src/client/ui/codaView.js).

### Engine status

| Status | Engines |
|---|---|
| **Live during play** (Moth modes) | `comet-qrng-v1`, `coin-toss-v1`, `graph-v1`, `qrc-train-v2` → `qrc-gen-v2`, `tomography-api-v2` (live-circuits mode; timed out on every job on 5 Oct, so it falls back to QPU bits) |
| **Pre-rendered** (outputs ship in `public/generated/`) | `entanglement-shader-v1`, `telablur-v1` → `qrc-image-v1`, `blur-core-v1`, `deep-fryer-v1` → `blur-v1`, `qpixl-v1`, `tamagotchi-v1` |
| **Tried, not in the game** | `tessa-image-v1` (timed out on Moth's side), `qdrive-api-v1` (tested; graph-v1 suited the temperaments better) |

### Quantum Forge

The *Quantum Forge* mode runs each collapse circuit on Quantum Forge's qubit build (RY → `y(θ/π)`, CX → `flip`
conditioned on the control), lazily loaded. `npm run check:forge` verifies the sampled odds match the targets.

### Braiding

The worldline braid uses Moth's [majorana-lattice](https://github.com/moth-quantum/majorana-lattice) (Wootton):
when two splits' worldlines link, a stabilizer simulation of Majorana modes fuses them to a fermion (ψ), and
unlinked ones fuse to vacuum (1). `npm run check:majorana` checks it against Ising anyon theory.

## Built on Moth's work

CPU temperaments revisit Wootton's [*A quantum procedure for map generation*](https://arxiv.org/abs/2005.10327)
(2020), live. The glitch and the iridescent film take ingredients from Moth's
[actually-quantum-moon](https://github.com/moth-quantum/actually-quantum-moon) into new roles: a measurement in
flight, and troops locked in a contested battle. How to play → *The quantum inside* teaches each rule as physics.

## Stack

Plain JavaScript (ES modules) · three.js + Vite · Cloudflare Worker with Durable Objects (static hosting, rooms,
matchmaking, WebRTC signalling and a budgeted Moth proxy; Moth's CORS admits only its own origin and the key never
reaches the browser) · Quantum Forge (WASM) · Python notebook.

```bash
npm install
npm run dev          # http://localhost:5180
npm run build        # static build in dist/ (relative URLs)
npm run build:itch   # release/brisque-web.zip
cd worker && npx wrangler deploy
```

Live Moth calls need a key in a `.env` outside the repo, read only by Node (dev proxy, tools, Worker secret).
Checks: `npm run check:map | check:quantum | check:game | check:pawns | check:branching | check:forge | check:majorana`.

```
src/shared/   engine, map generator, circuits + sampler (browser and Node)
src/client/   stage, pieces, VFX, HUD, quantum modes, Majorana braid
worker/       Cloudflare Worker      tools/   checks, browser drivers, Moth pre-render pipeline
notebook/     the Moth workflow      docs/    rules, design, engine measurements
```

## Credits

Music and sound effects by [Aya Emara](https://aya863.itch.io/) · game design and quantum expertise by _sirocco369 · quantum backends by Moth Quantum and IBM Quantum · Powered by Quantum Forge
(Quantum Native) · majorana-lattice by James Wootton (Apache-2.0) · three.js, Vite, d3-delaunay, simplex-noise.
