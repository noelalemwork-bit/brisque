# Presenting and shipping Brisque

## Links
- **Play:** https://brisque.noelnegash.workers.dev (game + online backend, one Cloudflare Worker)
- **Trailer:** `release/brisque-trailer.mp4` (45 s, 1080p30, soundtrack). Re-record with `node tools/record-video.mjs [out] [seconds] [menuSeconds]` while `npm run dev` runs.
- **itch.io upload:** `release/brisque-web.zip` (`npm run build:itch`)

## itch.io
1. New project → **Kind of project: HTML** → upload `release/brisque-web.zip` → tick **This file will be played in the browser**.
2. Embed options: viewport **1280 × 800** or larger, enable **Fullscreen button**, and **Click to launch in fullscreen** (recommended).
3. Online play works from itch: the build calls the Worker by its full URL, and the Worker allows itch's game
   origins (`html-classic.itch.zone`, legacy `v6p9d9t4.ssl.hwcdn.net`). No cookies are used (seat tokens only),
   so there is no CSRF surface; the origin allowlist plus tokens is the protection.
4. Voice chat needs microphone permission. If an embed can't ask for it, the game says so and points players to the
   full site. Everything else (local play, online play, music) works in the embed.

Why the zip rather than an iframe to the deployment: the zip is served by itch itself, keeps working if the Worker
changes, and is what jam judges expect. (An iframe page would work too, but it adds a second nested frame that also
needs `allow="microphone; autoplay; fullscreen"`.)

## Audio
Music and sound effects by **Aya Emara** (https://aya863.itch.io/): the *CS Remix* on menus, the *electronic theme* from game start
through the midgame, and the *classical theme* for the endgame (the last 40% of the round limit, or a player holding
40% of the map with certainty). Tracks crossfade over 2.5 s. Aya's *Click* plays on buttons and *boom sound* on
bomb impacts; other effects use a soft built-in synth until more files exist (add them in `public/audio/manifest.json`).
Master volume knob and mute toggle sit bottom right on every screen and remember their setting.
Source files were loudness-normalised to −16 LUFS and encoded to MP3 (about 11 MB total).

## Demo script (2–3 minutes)
1. **Home screen:** a real four-CPU match plays behind the menu (attract mode), with the menu music.
2. **Play local** → you + 2 CPU → start. Point out: names per continent theme, pawns, owner-coloured ground.
3. **Split** 50/50 into an enemy: ghost pawns in two places, metaball ground, a worldline tube over the terrain,
   and the braid strand in the right panel.
4. **Bomb** it: the bomb falls in your colour; the outcome comes from IBM QPU randomness (collapse panel, top left);
   losers are blasted out, and the entangled partner territory evaporates.
5. **Online:** Quick match on two machines, join voice, mute someone (they grey out but still ripple).
6. Close on the numbers: exact many-worlds engine (502/502 exactness checks), real hardware randomness from IBM,
   and serverless multiplayer on the Cloudflare free plan.
