# Brisque — quantum Risk

Jam game for **Moth Hack 2026** (26 Sept – 5 Oct PT, winners 7 Oct) + Global Quantum Game Jam (closed 27 Sept)
(theme: *quantum braiding*, secondary; likely visual). Challenge list and how we hit each one:
[`docs/OBJECTIVES.md`](docs/OBJECTIVES.md).

## Stack
- **Plain JS (ES modules), no TypeScript.** three.js + Vite client, Node + `ws` server.
- `src/shared/` runs on both sides: no DOM, no three.js, no `Math.random` (use `rng.js`).
- `src/client/` three.js stage, menus/HUD, local matches. `src/server/` optional WS rooms (dev / future online).

## Game
- Docs: [`GAMEPLAY.md`](docs/GAMEPLAY.md) (player rules + controls), [`GAME-DESIGN.md`](docs/GAME-DESIGN.md)
  (quantum model, problems, balance data), [`MOTH-ENGINES.md`](docs/MOTH-ENGINES.md) (every engine, emu vs QPU,
  measurements), [`ONLINE.md`](docs/ONLINE.md) (hosting, Trystero plan, voice hooks).
- Engine: `src/shared/game/` (many-worlds ensemble with exact histories (`parts`), probability layers + layered `take`, causal branch history: heads / trails / history; CPU bot). Client: `app.js` screens → `match/local.js`
  (engine in browser, hotseat + CPU) → `game/session.js` (event playback) + `ui/` (HUD, SVG board layer, menus).
- **Live at https://brisque.noelnegash.workers.dev** (`cd worker && npx wrangler deploy` after `npm run build`; wrangler 4 is a devDependency and is logged in via OAuth).
- **Local play is fully client-side**: no server needed. Online backend = **Cloudflare Worker (serves dist/ too) + Room / Lobby Durable Objects**
  (`worker/`, hibernating WebSockets, relay/snapshots/signalling, budgeted Moth proxy (per room + global daily cap in the Lobby DO's `budget` instance), optional JaaS JWTs). It does
  NOT run the engine (the host browser does). `src/server/` (Node WS) is legacy/dev. Client uses the Worker when built with
  `VITE_BRISQUE_API=<worker url>`.
- Pieces (`src/client/pieces/`): `pawns.js` (instanced pawns: cluster when certain, bouncing particles in the
  smooth `territory.hull` when uncertain), `ground.js` (owner tint; metaballs calibrated so area share = probability),
  `bomb.js` (mesh bomb that hovers until the measurement lands).
- Test hooks: `?quick` (you vs 2 CPU), `?quick=cpu` (autoplay), `&instant`, `&rounds=N`, `&q=moth-stream|moth-qpu-pool|moth-live|quantum-forge|emulator`, `&fakemoth` (dev: synthetic Moth jobs for the panel).
- Quantum panel (`ui/quantumPanel.js`, key Q): circuit, odds, Moth job phases and background Atlas jobs, fed by `quantumTrace` in `quantum.js`.
- CPU temperaments (`quantum.temperaments`): one qubit per CPU of a graph-v1 state (emulator fallback) → `botAction(…, traits)`
  (⟨Z⟩ aggression, ⟨X⟩ superposition, ⟨Y⟩ expansion, ⟨ZZ⟩ rivals). No traits = original bot, so checks stay deterministic.
- Game-over prediction (`coda.js`, `ui/codaView.js`, silent): `state.log` → `player:action` tokens → qrc-train-v2 → qrc-gen-v2
  (tokens come back in the final `/status` `result`, not in the state file). Moth modes only; ~6 credits per game.
- Audio: only Aya Emara's curated music and sound effects + the built-in synth ship. Moth SFX candidates and the VST plugins live outside this repo in `../brisque-extra/` (separate projects, never in the game).

## Audio / presentation
- Music + SFX by Aya Emara (aya863.itch.io) in `public/audio/` (manifest.json maps phases menu/early/late and SFX names; missing SFX use the synth in `src/client/audio/audio.js`). Volume/mute dock bottom right (`ui/audioDock.js`).
- Home screen runs an attract-mode CPU match (`?noattract` disables it). `?capture` swaps in a virtual clock (`src/client/capture.js`) for frame-perfect video: `node tools/record-video.mjs`.
- Ship: `npm run build:itch` → `release/brisque-web.zip` (real ZIP via `tools/zip.mjs`: GNU tar on PATH writes tar files named .zip, which itch rejects). See [`docs/PRESENTATION.md`](docs/PRESENTATION.md).

## Commands
- `node tools/browser-quantum.mjs <url> [ms] [png]` logs every quantum trace event (real Moth calls in moth modes).
- `npm run dev`: Vite on **:5180** (strictPort; :5173 is taken by another project) + server on :8787, `/ws` proxied.
- `npm run check:map` (board invariants, 40 seeds) · `check:quantum` (simulator + amplitude encoding) · `check:game` (rules physics + fuzz + CPU games) · `check:pawns` (physics stress) · `check:branching` (layers, nesting, reconvergence, cascades, exactness fuzz, braid layout).
- `node tools/e2e-online.mjs [url]` plays two real browsers online (matchmaking, rooms, voice, state streaming); run against local `wrangler dev` (restart it after every `vite build`: it caches the asset manifest) or the live URL.
- `node tools/debug-cpu.js [games]` audits every CPU action's troop deltas. `node tools/check-worker.mjs` tests the Worker (run `wrangler dev --port 8788` in `worker/`).
- Dev builds (and any build with `?e2e`) expose `window.__brisque` ({ match, session, room, voice, stage }) for puppeteer; `node tools/browser-branching.mjs <dir>` drives a layered split scenario (picker / worldlines / braid); `node tools/browser-ui.mjs <dir> [w] [h]` screenshots the HUD at a given size.
- `node tools/browser.mjs <url> [png] [ms]` drives real Chrome via puppeteer-core with console capture. Prefer it over raw `--screenshot`.
  **`vite preview` ignores `--outDir`**: it always serves `dist/`.
- `npm run build:itch` → `release/brisque-web.zip` (static, relative URLs, refuses to package if a key is found).
  `npm run preview` serves `dist/` on :5190 with **no** proxy, a faithful static-hosting test.
- `npm run moth:qrng [qpu|emu] [jobs]` tops up `public/generated/qrng-qpu.json` (≈88 s, ~6 KB per QPU job).
  `npm run moth:bench` re-measures engine latency. Both spend credits.
- Headless screenshots: Chrome `--headless=new --use-angle=swiftshader --virtual-time-budget`. The PNG is written
  *after* the process exits, so use a fresh `--user-data-dir` and `Start-Process -Wait`. SwiftShader is slow, so use `&instant`.

## Rules that matter
- **Maps are seed-deterministic.** The server only sends `seed`; every client runs `generateMap(seed)`.
  Any change to `src/shared/mapgen` changes every existing board, so re-run `check:map`.
- **Quantum modes** (`src/client/quantum.js`): `moth-stream` (default with a Moth route: fresh comet-qrng QPU bytes streamed
  during the match, bundled pool as the bridge), `moth-qpu-pool` (bundled comet-qrng bytes, inverse CDF), `moth-live`
  (tomography-api-v2 per collapse, falls back to pool entropy), `quantum-forge` (quantum.dev WASM simulator, lazy-loaded,
  needs the visible "Powered by Quantum Forge" credit), `emulator` (our statevector). Who opens: `chooseFirst` = Moth
  coin-toss-v1 (12 s cap) or Quantum Forge. `npm run check:forge` verifies the Forge bit order.
  `MOTH_API_KEY` lives in `Noel/.env`, read only by Node (server, Vite dev proxy, tools). **Never ship it in a build.**
- **Moth API facts** (tested 2026-09-25, re-measured 2026-10-05 in MOTH-ENGINES.md; docs mirrored in `docs/moth-api/`, live at docs.mothquantum.com):
  base `https://api.mothquantum.com/api/v1`, Bearer key; jobs are async (submit, poll `/jobs/{id}/status`, `/result`),
  no webhooks; **5 s – 3 min per job, dominated by Moth's queue (emu ≈ qpu)**; 300 req/min per key; 1 credit per tomography run. `tomography-api-v2` runs
  our OpenQASM and its `I/Z`-only measurement key holds real computational-basis samples (little-endian, same as our
  simulator). Don't burn credits in loops: certain outcomes skip the backend (`sampler.js`).
- **Moth CORS only allows platform.mothquantum.com.** Browsers on itch / our site / localhost can't call the API
  directly. Dev uses Vite's `/moth` proxy (the key is added server-side, dev only). The static build uses the bundled QPU pool.
- **Moth API calls are scarce and slow.** Pre-render everything that isn't a live game
  outcome (VFX masks, SFX) into `public/generated/`, keyed by params hash. See `tools/prerender/`.
- Circuits are JSON (`Circuit.toJSON`) and exportable to OpenQASM 2 (`toQASM`) for remote backends.

## Look (tuning knobs)
- Board: exactly **42 territories** (`MAP_DEFAULTS.territories`), 6 continents, 2 single-bridge continents.
- Terrain: `RELIEF` in `src/client/mapMesh.js`. Height = shore + peak·(coastDist/max)^exponent (flat lowlands, rises only near the centre).
  Sandy beach skirt flows out under the water; `beachWidth`, `sandWidth`.
- Water: `src/client/water.js`, custom toon shader. Stepped bands, no specular or reflections, white crest dashes, shore foam rings
  from a baked coast-distance texture (`MAX_DIST` must match in both files).
- Art target: soft and pastel like Bad North (VSM soft shadows, high sky fill, NeutralToneMapping).
