# Moth engines: what exists, what we measured, how Brisque uses them

Sources: the live OpenAPI spec (`https://api.mothquantum.com/openapi.json`, 62 paths, 36 engine endpoints), the docs site
(mirrored in `docs/moth-api/`) and our own runs on 2026-09-25 (`tools/moth/bench-2026-09-25.json`, `tools/moth/fetch-qrng.log`).
The spec lists engines the docs site doesn't have yet: **`comet-qrng-v1`**, `qrc-image-v1`, and the `blur-v0` /
`entanglement-shader-v0` / `tamagotchi-v0` versions. It also exposes `POST /engines` (create your own engine) and `showcases`.

## Emulator vs IBM QPU

Most engines take `mode: "emu" | "qpu"` (Tessa/QPIXL call it `machine`).

| | **emu** (Aer simulator on Moth's workers) | **qpu** (IBM Heron hardware: ibm_marrakesh, ibm_kingston, …) |
|---|---|---|
| Physics | exact, noiseless (`aer`). Optional `fake_<chip>` noise models mimic a real chip | real device: gate, readout and decoherence noise. Deep circuits drift from the ideal |
| Randomness | classical pseudo-randomness. comet labels it `simulator-baseline`, **uncertified** | Born-rule randomness. comet certifies it (`hardware-accounted`) and a Bell test proves entanglement |
| Latency (2026-09-25) | **5 s → 165 s** for the *same* tomography job, depending on Moth's queue | **74–94 s** end to end, of which only **2–3 QPU-seconds** was hardware time |
| Reproducible | yes (seeds) | no |
| Access | any key | coin-toss / comet use Moth's shared IBM account. **graph-v1 QPU needs your own IBM token + instance** |
| Size | ≤ 20 qubits (comet emu cap) | up to the device (156 qubits); we used 108 |
| Cost | credits per run (1–2) | the same credits, plus IBM time on Moth's allocation |

What that means in practice:
- **On 25 Sept the job queue was the bottleneck, not the hardware.** Coin-toss took 74 s on the emulator and 74 s on
  ibm_marrakesh. Tomography emu jobs ranged from 5 s at 19:04 to 165 s at 19:33. Design for "seconds to minutes" in
  both modes.
- **The Moth emulator adds nothing mathematically over our in-browser emulator.** It runs the same statevector
  maths, but over the network. Its value is integration evidence (web-app / daisy-chain challenges), not better
  outcomes.
- **The QPU is what makes the game quantum**, and it's too slow per move. So Brisque takes QPU randomness *ahead
  of time* (comet pool, shipped with the game) and keeps per-move live circuits optional.
- **Noise matters for circuits, not for the RNG.** A collapse circuit on real hardware returns slightly wrong
  odds. comet's extractor removes bias from its output, so pool draws are uniform. For fairness the pool is the
  better QPU path; for "watch a circuit run on hardware" the live path is better.

## Measurements (2026-09-25, evening of the Moth Hack opening)

| Run | Engine | Mode | End to end | Result |
|---|---|---|---|---|
| collapse, 1 shot | tomography-api-v2 | emu | 5 s · 18 s · 165 s | a correct sample from our QASM |
| collapse, 4096 shots | tomography-api-v2 | emu | 165 s | `00` 51% `01` 43% `10` 6%, **target 50/44/6** ✓ (our encoding is right on Moth) |
| coin, 1 shot | coin-toss-v1 | emu | 74 s | heads |
| coin, 16 shots | coin-toss-v1 | qpu (ibm_marrakesh) | 74 s | 9 H / 7 T |
| QRNG 12q × 1024 | comet-qrng-v1 | emu | 22 s | 64 B, uncertified |
| QRNG 12q × 4096 + Bell | comet-qrng-v1 | qpu (ibm_marrakesh) | 94 s | **0 B**: counts readout loses shot order, and the extractor's `log2(shots!)` penalty ate the entropy. Bell S = 2.71 |
| QRNG 100q × 1000 + Bell (×4) | comet-qrng-v1 | qpu (marrakesh, kingston) | 80–88 s, 2 QPU-s each | **4.2–8.2 KB each, `hardware-accounted`**, Bell S = 2.38–2.64 (all > 2) |
| battle as graph targets | graph-v1 | emu | 8 s | returned `00` 100% for a 50/44/6 target ✗ |

**comet tip:** use wide registers and few shots (≈100 qubits × 1000 shots). Narrow and long runs yield nothing.

## Re-measured 2026-10-05 (final day)

| Run | Engine | Mode | End to end | Result |
|---|---|---|---|---|
| collapse, 1 qubit, 1 shot (×3) | tomography-api-v2 | emu | 64 s | **`engine_timeout` every time**: the engine was down all afternoon. `moth-live` now falls back to QPU-pool entropy |
| coin, 1 shot | coin-toss-v1 | emu | 6 s idle · 25–60 s under load | `tails` |
| QRNG 12q × 1024 + Bell | comet-qrng-v1 | emu | 14 s | 64 B, Bell S = 2.83 |
| QRNG 20q × 8192, no Bell | comet-qrng-v1 | emu | 15–20 s | **4,096 B** (emu cap is 20 qubits *including* the 8 Bell-witness qubits) |
| QRNG 100q × 1000 + Bell | comet-qrng-v1 | qpu | > 3 min (IBM queue) | streamed into the live pool during play |

- Job **submission** alone took 2–3 s when idle and 10–13 s under load. Latency is Moth-side; the client polls at
  400 ms growing ×1.35 to 2.5 s, so it notices completion within one poll without hammering the key's rate limit.
- What this means for play: the default mode (`moth-stream`) never waits on Moth. It draws from bundled QPU bytes
  instantly while a fresh comet-qrng QPU job runs in the background, then switches to the live bytes. The circuit
  panel (Q) shows each job's submit / queue / run / fetch phases as they happen.

## Can graph-v1 encode collapses better? No, but it has a better job

graph-v1 (Moth's QuantumGraph) prepares a state from **Bloch-vector directions per qubit** plus **pairwise
Pauli correlations on graph edges**, then samples it and returns the *exact* tomography.
- A **single two-army battle** is representable: target `{Z: cos θ, X: sin θ}` is exactly our `RY(θ)`. It is no
  better than tomography-api-v2, which runs that same gate from our QASM.
- **Multi-outcome collapses aren't representable.** A target with mixed marginals (`Z0=0.11, Z1=0.89, ZZ=0`)
  came back as pure `|00⟩`. Pairwise targets can't express the uniformly controlled rotations the exact encoding
  needs. tomography-api-v2 (arbitrary QASM, verified above) stays the collapse engine.
- **Where graph-v1 fits: the board's entanglement network.** Territories become nodes (≤ 20 at once),
  adjacency becomes `coupling_map`, and each thread or *Entangler* card becomes a `relationship` (`ZZ = ±1`: "these
  two battles go the same way / opposite ways"). The result gives **per-territory Bloch vectors and per-edge
  correlations**, which is ideal data for the braid and entanglement visuals. The *Entangler* card maps directly
  onto one `relationship` edge. A QPU run needs our own IBM token.

## Every engine and its role in Brisque (daisy chain)

Live means during play. Pre-render means run once, results shipped in `public/generated/` with parameters
recorded (challenge 1 asks for them).

| Engine | In | Out | Brisque use | When |
|---|---|---|---|---|
| **comet-qrng-v1** | JSON | bytes + certificate | **QPU randomness pool that decides collapses** (shipped: 24 KB ≈ 6,000 collapses) | pre-fetched ✅ |
| **tomography-api-v2** | QASM | per-basis counts | **live collapse circuits** (`BRISQUE_QUANTUM=moth`, dev proxy) | live ✅ |
| graph-v1 | graph JSON | samples + exact tomography | entanglement map / Bloch glyphs; *Entangler* card | live (emu) / pre-render |
| coin-toss-v1 | JSON | heads/tails | who moves first; tie-breaks | live, cheap |
| qdrive-api-v1 | target expvals | circuit | cross-check our encoder: ask QDrive for the circuit with the battle's ⟨Z⟩ | pre-render / notebook |
| entanglement-shader-v1 | JSON | BSDF LUT file | iridescent film on superposed troop pieces | pre-render |
| tessa-image-v1 | image | image | continent textures, card art, avatar portraits (recipe `tessa-board` ready; `engine_timeout` on every try 5–6 Oct) | pre-render ✗ |
| blur-core-v1 | N-D grid | grid | **shipped:** shot-noise "quantum static" around a hovering bomb (64×64×8, 40k shots) and the detonation shockwave: 8 expanding rings quantum-blurred into a full-screen radial displacement (`vfx/post.js`), strength = the outcome's normalised entropy | pre-render ✅ |
| blur-v1 / blur-v0 | image | image | territory-capture transition masks | pre-render |
| telablur-v1 | image → image | image (one strength per job) | **shipped:** glitch streaks (detonation); ONE→TWO lobes at strengths 0.25/0.5/0.75/1 = the split's full-screen double image; superposed cloud→point at 0.35/0.7/1 = the collapse pinch. The middle strengths come back as tartan interference (the selector rotation acting on separable x/y pixel qubits), kept as is | pre-render ✅ |
| deep-fryer-v1 | image | image | bomb impact flash frames | pre-render |
| qpixl-v1 | float array | reconstruction | encode the island heightmap through a device ("quantum terrain" variant) | pre-render |
| qrc-image-v1 | image zip | GIF + state | **shipped (chained after telablur-v1):** the 5 fork frames are the reservoir's vocabulary, trained on the fork/rejoin cycle (20 tokens, `moderate`, seed 2026); it generated 96 frames whose order drives every split effect, stutters included. The engine needs > 16 training tokens; the GIF merges repeated frames, so dwell lengths are read back from frame delays | pre-render ✅ |
| qrc-audio-v1 | audio | WAV | soundtrack arrangement from stems | pre-render |
| qrc-midi-v1, blur-midi-v1 | MIDI | MIDI | music variations per continent / per game phase | pre-render |
| qrc-train-v2 + qrc-gen-v2 | tokens | model → sequence | train on a match's braid word, generate a per-match motif | post-game |
| retrocausal-echo-v1, otoc-echo-v1 | audio / JSON | audio / tap map | collapse and bomb SFX; the tap map is the core of the **VST** (challenge 7) | pre-render |
| labyrinth-v1 | level JSON | maze | (stretch) fog-of-war pattern / tunnel layout | — |
| tamagotchi-v1 | JSON | JSON | (stretch) avatar mood | — |

## Access from a static site (itch.io, your web page): CORS

`api.mothquantum.com` only returns `Access-Control-Allow-Origin` for `https://platform.mothquantum.com`. Tested:
itch (`html-classic.itch.zone`), `localhost` and arbitrary origins get no CORS headers, so **browsers block live
calls from our static build**. Handling:
- The static build ships the QPU randomness pool, so quantum outcomes work with zero calls and no key.
- Live circuits work in dev through Vite's `/moth` proxy, which adds the key on the server side, and through the Node
  server (`BRISQUE_QUANTUM=moth`).
- **Ask Moth** (Discord / Saturday's Atlas talk) to allowlist `https://html-classic.itch.zone` and our site's origin.
  Then "Moth · live circuits" works on itch with the player's own key, with no code change.
- Never ship our key. `npm run build:itch` refuses to package if it finds one.
