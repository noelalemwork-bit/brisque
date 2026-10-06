# Moth Hack 2026 submission text

Copy-paste material for the Airtable form. One project (the game), entered for each challenge it satisfies; the
audio plugins are a separate project in `../brisque-extra`.

- **Play:** https://brisque.noelnegash.workers.dev
- **Repo:** https://github.com/noelalemwork-bit/brisque
- **Videos:** `release/brisque-trailer.mp4` (cinematic) · `release/brisque-gameplay.mp4` (HUD, measurement cards, quantum log)
- **itch.io build:** `release/brisque-web.zip`

## Short description (all entries)

Brisque is Risk in superposition. Armies split across possible futures, battles are qubits rotated by the troop
ratio, and bombs are measurements that collapse a territory and everything entangled with it. Every outcome is a
real quantum measurement: by default, certified random bits from an IBM quantum computer streamed live through
Moth's comet-qrng engine during the match (Bell test S > 2). Aiming a bomb previews the outcomes and the circuit
that will decide them; the result card shows the bitstring read and whose result it was. A live Moth coin toss
picks who opens, CPU temperaments are read from one entangled state (graph-v1, after Wootton's 2020 quantum map
generation), troops locked in contested battles shimmer with the Entanglement Shader (split troops turn translucent by their odds), splits and bombs fork and pinch the whole
frame with Moth-made distortion, and at game over a quantum reservoir learns the war's moves and predicts the next
16. 14 Moth engines in all, plus Quantum Forge as an in-browser simulator mode. A tutorial teaches every move in a
few minutes against a gentle sparring CPU. Music and sound effects by Aya Emara (https://aya863.itch.io/).

## Builds on Moth's work (originality)
CPU temperaments revisit Wootton's "A quantum procedure for map generation" (2020) live on graph-v1; the bomb glitch
and the iridescent film take ingredients of Moth's actually-quantum-moon into new roles (a measurement in flight;
troops locked in a contested battle); the braid view runs Majorana fusion on Moth's majorana-lattice; and, like Space
Moths, one quantum output feeds several media (the match history is both the braid and the reservoir's training data).

## 1. One image, one engine
A screenshot of the Brisque board run through **blur-v1** (strength 0.3, reach 0.05, rx). Before/after and exact
parameters in `release/submission/one-image/` and `public/generated/manifest.json` (job `019c60a6…`).

## 3. Three dimensions
The **Entanglement Shader** on 3D troop pieces: entanglement-shader-v1's reflectance lookup tables drive an iridescent
film, with animated noise normals so the bands flow over each piece, on every troop in a contested territory; split
troops are translucent in proportion to their probability, so one piece can be both. The shading itself says
"this is a battle in superposition" and "this army might not be here". Code: `src/client/pieces/pawns.js`,
`src/client/vfx/entangle.js`.

## 4. Moving image
`release/brisque-trailer.mp4` and `release/brisque-gameplay.mp4`: frame-perfect captures of real matches whose
collapses were decided by IBM QPU randomness, with Moth-made effects (telablur-v1 → qrc-image-v1 frame forks on
splits; telablur-v1, blur-core-v1, deep-fryer-v1 → blur-v1 and qpixl-v1 on bombs) and the Entanglement Shader.

## 5. Quantum game
Brisque itself. Quantum mechanics is the rule set: superposition (split), the Born rule (battle odds = sin²(θ/2) of
an RY rotation), measurement and collapse (bombs), entanglement (threads that collapse together) and decoherence
(timers). Exact many-worlds engine; local hotseat/CPU, online matchmaking with voice.

## 6. Daisy Chain (14 engines in the game)
comet-qrng-v1 (live collapses), coin-toss-v1 (who opens), tomography-api-v2 (live collapse circuits), graph-v1 (CPU
temperaments and rivalries), qrc-train-v2 → qrc-gen-v2 (game-over prediction), entanglement-shader-v1 (troop film),
telablur-v1 → qrc-image-v1 (chained: the split fork morph, sequenced by a quantum reservoir), blur-core-v1 (static
while measuring; bomb shockwave), deep-fryer-v1 → blur-v1 (chained bomb blast), qpixl-v1 (glitch rows through a noisy
device model), tamagotchi-v1 (error-correction lesson). Every job's parameters and id are in the repo.

## 8. Make a web app
https://brisque.noelnegash.workers.dev calls the Atlas API live during play: a comet-qrng QPU job streams certified
random bytes into the game, coin-toss-v1 picks the opener, graph-v1 sets CPU temperaments, qrc-train/gen predict the
war's continuation, and "live circuits" mode sends each collapse's OpenQASM to tomography-api-v2. Calls go through a
budgeted Cloudflare Worker proxy (Moth's CORS only allows its own origin; the key never reaches the browser). The
quantum log (Q) shows every call's phases and latency.

## 9. Quantum-native 1
This repo: every game outcome goes through a quantum measurement, from amplitude encoding of arbitrary outcome
distributions (Möttönen state preparation → OpenQASM) to certified QPU randomness, plus a pre-render pipeline
(`tools/prerender/`) that processes the game's own images through Moth engines.

## 10. Quantum-native 2
`notebook/brisque_moth_workflow.ipynb` (HTML export alongside): battles as circuits (a Python port of the encoder,
byte-identical QASM to the game), tomography results vs targets, comet-qrng certificates and Bell values from the
shipped QPU pool, a graph-v1 entanglement run, and how each output feeds the game. Executed, outputs saved.

## 11. FQxI Challenge
In-game "How to play → The quantum inside": each rule explained as the physics it models, an interactive battle
qubit (sliders set the troop ratio, the Bloch vector rotates, "Measure ×100" samples it with IBM hardware
randomness), braiding (ψ and 1) on majorana-lattice, and an error-correction chart measured with Moth's tamagotchi-v1.
In game, the bomb preview and result cards teach how one circuit run picks one outcome.

## 2 / 7. Make it audible · Make a VST or AU (separate project)
`../brisque-extra`: the Film and Split plugins (Entanglement Shader data and certified QPU randomness), with audio
examples. Never part of the game. Details in that repo's README.
