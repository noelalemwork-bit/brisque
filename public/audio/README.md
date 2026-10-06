# Audio (drop files here)

Put Aya Emara's files (https://aya863.itch.io/) in this folder, then name them in `manifest.json`:

```json
{
  "credits": "Music and sound effects by Aya Emara",
  "music": { "menu": "<soundtrack remix>.mp3", "early": "<electronic>.mp3", "late": "<classical>.mp3" },
  "sfx": { "click": "...", "deploy": "...", "move": "...", "split": "...", "battle": "...",
           "bombFall": "...", "bombHit": "...", "collapse": "...", "resolve": "...",
           "turn": "...", "yourTurn": "...", "win": "...", "reject": "...", "hover": "..." }
}
```
Any subset works; missing effects use the built-in synth. Music phases: `menu` (home and menus), `early`
(from game start through the midgame), `late` (endgame: the last 40% of the round limit, or a player holding
40% of the map with certainty). Tracks loop and crossfade.
