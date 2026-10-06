# Brisque Worker (Cloudflare)

One Worker + one Durable Object class (`Room`). The host's browser runs the game engine; the Worker
only holds seats, relays messages, stores state snapshots, relays WebRTC voice signalling, and proxies
a budgeted slice of the Moth API with the secret key. Free-plan friendly: WebSocket Hibernation, so idle
rooms cost nothing, incoming messages bill 20:1 against the 100k/day Durable Object request allowance,
and outgoing messages are free.

## Deploy (once)

```bash
cd worker
npx wrangler login                     # the D1-only API token in Noel/.env cannot deploy Workers
npx wrangler secret put MOTH_API_KEY   # paste the key; never commit it
npx wrangler deploy                    # -> https://brisque.<account>.workers.dev
```
Then add your site's origin to `ALLOWED_ORIGINS` in `wrangler.toml`. `https://html-classic.itch.zone`
(itch's game iframe) is already there. Build the client against the Worker:
```bash
VITE_BRISQUE_API=https://brisque.<account>.workers.dev npm run build:itch
```

Optional voice through JaaS (8x8 Jitsi, free up to 25 monthly users): create an app at jaas.8x8.vc, then
`wrangler secret put JAAS_APP_ID`, `JAAS_KID` and `JAAS_PRIVATE_KEY` (PKCS#8 PEM; convert an RSA key
with `openssl pkcs8 -topk8 -nocrypt`). `POST /api/rooms/:code/jaas` then mints room-scoped RS256 JWTs.

## Local

```bash
cd worker && npx wrangler dev --port 8788    # reads secrets from worker/.dev.vars (gitignored)
node ../tools/check-worker.mjs               # 17 end-to-end checks
```

## API

| Route | Purpose |
|---|---|
| `POST /api/rooms` | new room code |
| `GET /api/rooms/:code/ws` | WebSocket: `hello`, `lobby`, `start`, `act`, `state`, `measuring`, `signal`, `ping` (see `src/room.js`) |
| `POST /api/rooms/:code/solo` | seat token for a single-device game that only needs the Moth proxy |
| `/api/rooms/:code/moth/*` | Moth proxy, header `x-brisque-token`; allowlist: tomography, comet-qrng, graph, coin-toss submissions, job status/result, `/me`; budget 300 submissions/day, 20/min per room |
| `POST /api/rooms/:code/jaas` | JaaS JWT for voice (if configured) |
