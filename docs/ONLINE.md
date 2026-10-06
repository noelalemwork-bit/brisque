# Online play

**Live:** https://brisque.noelnegash.workers.dev (the Worker serves the game and the backend).

## Architecture

```
 browser (static game)                     Cloudflare Worker "brisque"
 ┌──────────────────────────┐   wss   ┌─────────────────────────────────────────────┐
 │ host: engine + quantum    │◀───────▶│ Lobby DO (global)  quick-match queue          │
 │ guests: mirror + act      │◀───────▶│ Room DO (per code) seats, relay, snapshot,    │
 └──────────────────────────┘         │   voice signalling, budgeted Moth proxy       │
          ▲  WebRTC audio (peer-to-peer; signalled through the Room)                   │
                                       │ ASSETS  the game itself (dist/)               │
                                       └─────────────────────────────────────────────┘
```

- **Barebones:** the Worker never runs the game engine. The host's browser does, exactly as in a local game
  (`match/online.js` wraps `match/local.js`). Rooms relay `act` (guest → host) and `state` / `measuring`
  (host → everyone) and keep the latest state as a snapshot for reconnects.
- **Free plan:** Durable Objects use WebSocket Hibernation, so idle rooms cost nothing. Incoming messages bill
  20:1 against 100k requests/day (about 2M game messages); outgoing messages are free.
- **Host:** before the game, the lowest online seat is host (reconnects included). `start` pins the host to the
  starter, since that browser runs the engine.
- **Reconnect:** `hello` with the stored seat token resumes the seat and returns the start config and the latest
  state, so a guest who reloads drops straight back into the game.
- **Moth:** the key is a Worker secret. Browsers call `/api/rooms/:code/moth/*` with a seat token; the proxy allows
  only collapse, QRNG, graph and coin-toss submissions plus job polling, at most 300/day and 20/min per room.

## Flows

- **Quick match:** `/api/matchmake` (Lobby DO) queues players by party size (2 or 4) and hands everyone the same
  new room code; the first to arrive becomes host.
- **Private room:** Create room shows a 5-letter code; others join with it.
- **Lobby:** seats with online and speaking indicators, host-added CPU players, voice join/mute, host starts.
  Game settings (quantum mode, round limit, defeated troops) come from the host's saved local setup.

## Voice

**Opt-in:** nothing touches the microphone until you press **Join voice** (lobby, or the sidebar button above the
avatar rail in game). Each other player's avatar has a speaker button to mute them: they go grey, but their ripples
keep animating so you can see when they talk. Your own avatar has a mic button to mute yourself (the others then hear
silence). **Leave voice** in the sidebar hangs up.

WebRTC audio mesh (`online/voice.js`): the lower seat of each pair offers, and SDP/ICE travel as `signal`
messages through the Room. STUN via Cloudflare and Google; there is no TURN relay yet, so strict mobile NATs may fail
to connect. Levels of every speaker (0..1) drive the avatar ripples in game and the seat glow in the lobby.
JaaS (Jitsi) remains an option: the Worker can mint its JWTs (`/api/rooms/:code/jaas`) once `JAAS_*` secrets exist.

## Tested (live, 2026-09-26)

`node tools/e2e-online.mjs https://brisque.noelnegash.workers.dev` runs two real browsers with fake microphones:
matchmaking pairs them (about 10 s), exactly one host, WebRTC voice connects both ways with audio flowing, the game
starts identically for both, and three alternating host and guest turns stream with identical state. Voice is off
until joined; muting a player from their avatar silences them while their level still flows and their avatar greys
out; self-mute makes the others hear silence; the sidebar button leaves and rejoins voice. A private room
is then created and joined by code. `node tools/check-worker.mjs <url>` runs 17 API checks (relay, host-only
messages, reconnect with snapshot, host election, signalling, Moth proxy guardrails, CORS).

## Deploy

```bash
npm run build                       # same-origin build (the Worker serves it)
cd worker && npx wrangler deploy    # uploads dist/ + the Worker
printf '%s' "$MOTH_API_KEY" | npx wrangler secret put MOTH_API_KEY   # once
```
For itch.io, build against the Worker: `VITE_BRISQUE_API=https://brisque.noelnegash.workers.dev npm run build:itch`
(itch's iframe origin is already allowed).

## Known limits

- Host migration mid-game isn't supported: if the host leaves during a game, guests keep the last state but
  nobody runs the engine. (Before the game, host hand-over works.)
- No TURN relay for voice yet (Cloudflare Realtime TURN would be the one addition).
- A host could cheat on quantum outcomes; running the engine in the Room is the upgrade path (it needs more Worker CPU).
