# Brisque game design (tentative)

Code: `src/shared/game/` (engine, pure JS, runs on server and client). Rule numbers: `src/shared/game/config.js`.
Checks: `npm run check:game` (scripted physics scenarios + randomized fuzz asserting conservation).

## 1. Quantum model: many worlds with exact histories

Tested by `npm run check:branching` (scenarios, randomised deep histories, braid layout).

**Worlds.** The board is a sparse set of complete classical boards. Each carries its *histories*:
`{ board, parts: [{ bits: {thread: 0|1}, p }] }`. When different histories reach the same board (a
coincidence), the worlds merge by concatenating parts, so no history is forgotten. Conditioning on a thread
("what if split #3 went left?") and collapsing one stay **exact** through merges, nested splits and cascades.
(The earlier model dropped the thread bit on merge. It gave 67/33 where the truth is 50/50; that's now a
regression test.)

| Event | Rule |
|---|---|
| deploy / move | applied in every world; a no-op where the troops aren't there. Worlds whose boards become identical merge (histories kept) |
| split | every world forks into two, always 50/50 (`rules.allowBias` re-enables a bias); the thread's branches are (q,0) and (q,1) |
| subdivide | splitting troops that exist only in some branches (a 50% layer) forks them again: 25%, 12.5%, ...; the new thread's **parent** is the branch that carried them |
| battle | a territory with two or more armies is contested and unresolved until measured; armies may join, and may retreat down to one troop |
| bomb (measure a territory) | outcomes are (exact cell contents x victor). P(contents) sums every history producing it; P(victor given contents) is proportional to troops^exponent from the troops actually present in those branches |
| decoherence (measure a thread) | keeps only the histories with the chosen bit; exact through merges |

**Layers.** One army in one territory can hold troops that exist in every branch plus troops that exist only in
some. Its counts across branches are nested thresholds, so the troops form **probability layers**, e.g. 3 certain +
6 at 50% + 2 at 12.5%. Moves and splits pick per layer (`take: [{ atLeast, n }]`). The picked layers move only in
branches where they exist, and every branch must keep at least one troop behind. Classical and quantum troops of one
colour arriving together simply stack as layers.

**Branch history (causal).** Each branch has *heads* (where its troops are) and a *trail* (the moves it made).
- A move **extends** branch (q,b) from X to Y when X is one of its heads and the move carries more troops, in
  expectation, where q=b than where q is the other branch. Moving only certain troops extends no branch.
- **Coincide**: both branches of a thread have a head on the same territory. Partial when the amounts differ (the
  thread stays live, and the territory holds a certain part plus a layer). Full when the boards become identical:
  the worlds merge and the thread **resolves as reconverged**.
- **Cross**: branches of different threads share a territory.
- **Collapse**: a branch loses all probability (killed by a measurement). **Cascade**: nested threads whose parent
  branch died lose their histories with it and resolve too.
- **Resolve**: the thread no longer changes anything observable (the conditional distribution over whole boards is
  the same for both branches).

**Randomised exactness checks.** Over random deep histories (up to 4 live nested threads, layered picks, merges):
after every bomb, each other territory's distribution equals its prior distribution conditioned on the outcome; after
every thread collapse, each territory equals its distribution conditioned on that branch. 151/151 exact.

## 2. Rules (Risk-filled where the brief is open)

**Setup.** 2–6 players. Each player gets `startTerritories` (4) random territories with 1 troop. The rest start
**empty** so there is land to expand into. Starting inventory follows Risk: 40/35/30/25/20 for 2–6 players.

**Turn.** Actions can happen in any order, within per-turn budgets:
- **Income** at turn start: `max(3, certainTerritories / 3)` plus continent bonuses. Only territory held with **certainty**
  counts, so superposition is a risk to your economy and collapsing things pays.
- **Deploy** up to 10 troops per turn (brief), only onto territory you hold with certainty. Inventory stays classical,
  so a deployment must exist in every world.
- **Move** (5/turn): n troops to an adjacent territory, leaving 1 behind (Risk). The target can be empty (occupy), yours
  (merge), enemy (battle starts) or contested (join it). Applied per world, so moving out of a superposed territory moves
  whatever is there in each branch.
- **Split** (1/turn): n troops go to destination A or B, where either may be the source ("stay put"). Bias is 25/50/75.
  Refused if it would exceed `maxWorlds` (64) branches.
- **Bomb**: 5 slots (brief). A used slot comes back after 3 of your own turns (brief). You can only bomb territory that is
  superposed or contested; there's nothing to learn from a certain one.
- **End turn.** At each round end, splits older than 3 rounds and battles older than 2 rounds decohere (auto-measure).
  This bounds branch growth and stops battles freezing forever.

**Battle resolution** (brief): the victor's troops stay and losers' troops return to inventory (`returnFraction` 1).
**Elimination**: no troops on the board in any world. **Win**: last player standing, or certain ownership of all 42 territories.

## 3. Controls

Full table in [`GAMEPLAY.md`](GAMEPLAY.md#controls). Implemented in `src/client/game/controller.js`, with modes
move / deploy / split / bomb and live SVG previews: a move arrow with battle odds, a split fork with %, and bomb
crosshair rings on every territory entangled with the target.

## 4. Braiding

Each split is a **thread** with two **branches**. The braid is drawn per branch from `state.history` (fork, extend,
cross, coincide, collapse, resolve). Three places to use it:
1. **Braid panel** (`ui/braidLayout.js`, pure and tested): one strand per branch, time flowing **up**. Nested splits fork off their parent strand, crossings weave (over/under alternates per strand), coincidences link the two branches, and collapses end in a cross, resolutions in a dot.
2. **On the map** (`pieces/worldlines.js`): each live branch's travelled edges as terrain-hugging tubes (branch 1 dashed, brightness = probability), helices where routes are shared, rings at coincidences, halos for branches that stayed.
3. **Moth engines**: the braid word and thread history make a compact per-match input for SFX/VFX (Atlas audio, QRC MIDI).

## 5. Client architecture

The engine returns `events` in order: `turnStarted deployed moved split contestStarted braided bombed measured
threadsClosed worlds turnEnded roundEnded eliminated gameOver`.
- `src/client/app.js`: screen flow (home → local setup → game → game over / pause), with the 3D board behind menus.
- `src/client/match/local.js`: engine in the browser, hotseat + CPU seats (`shared/game/bot.js`). This is the
  **match interface** online play will reuse ([`ONLINE.md`](ONLINE.md)).
- `src/client/game/session.js`: plays each event batch as animation, then shows the new state. CPU turns wait
  on that playback. Animation speed is Normal / Fast / Instant.
- `src/client/ui/`: `screens.js` (menus), `hud.js` (avatar rail, banner, action bar, bombs, braid panel,
  tooltip, collapse panel), `boardLayer.js` (SVG badges, previews and FX re-projected from 3D every frame) and
  `icons.js` (placeholder SVG art).
- `src/client/quantum.js`: quantum modes (Emulator / Moth QPU randomness pool / Moth live circuits).

## 6. Problem points

1. **Moth latency: 5 s to 3 min per job, and it's the queue, not the hardware.** Measured on 2026-09-25: the same
   tomography emu job took 5 s at one point and 165 s later; coin-toss took 74 s on both emu and QPU. See
   [`MOTH-ENGINES.md`](MOTH-ENGINES.md). **Resolved for play** with the *quantum entropy pool*: 24 KB of certified
   IBM-QPU randomness (comet-qrng, ≈6,000 collapses) ships with the game, and collapses map a pool draw onto the outcome
   distribution by inverse CDF. That's instant, works on static hosting, and needs no key. Live per-collapse circuits
   remain available (dev proxy / server), with local fallback. Still open: *bomb flight time* as a mechanic, so live
   circuits could be the default where CORS allows.
2. **No per-sample engine.** Nothing on Moth returns raw samples of an arbitrary circuit. `tomography-api-v2` accepts our
   QASM and its `I/Z`-basis measurement counts are real samples, which is what `backend.js` uses. It also runs X/Y bases
   we don't need. Ask Moth whether a plain `run circuit → counts` engine exists or is planned.
3. **Interference isn't used yet.** Amplitudes are real and positive and worlds never cancel, so the game is
   currently classical probability run on a quantum sampler. Judges may notice. The natural fix is an ordnance that
   applies a phase to one branch plus a "recombine" split: re-merging a thread with H makes branches interfere, so a
   branch can become impossible. This needs complex amplitudes in `worlds.js`, a contained change.
4. **No attrition means no cost to attacking, and games never end.** CPU sweep (`tools/sim-balance.js`, 3 CPU
   players, 4 maps, 150-round cap):

   | Defeated troops | Finished | Rounds |
   |---|---|---|
   | return to reserve (brief) | 0/4 | — |
   | 50% return | 0/4 | — |
   | 50% return + Lanchester (`battleExponent` 2) | 1/4 | 100 |
   | destroyed (classic Risk) | 4/4 | 48, 52, 96, 132 |

   Shipped: the brief's rule stays the default, a **setup option** picks the alternatives, and a **round limit**
   (default 30; most certain territory wins) guarantees an ending. Recommendation: make "destroyed" the default.
5. **Decoherence of merged worlds is approximate.** When two branches become identical they merge, and the thread bit
   stops mattering. Measuring that thread later keeps the merged world with its full weight. That's harmless for play but
   not exact.
6. **Reconnects.** Seats are tied to the socket. A dropped player can't rejoin yet; a seat token is needed.
7. **Branch cap and cost.** The cap is 64 worlds × 42 territories. Game state is broadcast whole after every action
   (tens of KB at worst). Fine for now; send diffs if rooms get large.
8. **Hidden information.** Everyone sees every branch's odds. Fog of war over superpositions could be a strong mode.

## 7. Open questions

- **Start**: random 4 territories plus empty land (current), full Risk deal (no empties), or players choosing capitals?
- **Budgets**: 5 moves and 1 split per turn, or "each troop moves once per turn" (Risk-like but costly to track per world)?
- **Bombs on certain territory**: forbidden now. Should they instead kill troops (a classical bomb)?
- **Battle odds**: proportional (current), Lanchester-square, or Risk-dice odds with a defender edge?
- **Can battles be reinforced?** Currently a contested territory accepts more armies (they join the battle and shift the
  odds) but nothing can leave it. Is that the intended "rotate the qubit further"?

## 8. Card suggestions (earned by *certainly* capturing a territory in a turn, like Risk)

| Card | Gate | Effect |
|---|---|---|
| Hadamard | H | a split with any bias or reaching two territories away |
| Entangler | CNOT | link two of your battles: they resolve with the same luck (both won or both lost) |
| Phase | Z | flip the sign of one branch; with a recombine, cancel it (interference, problem 3) |
| Teleport | — | move troops to any territory entangled with one of yours |
| Shield | — | +2 rounds of coherence for one thread |
| Observer | M | collapse a territory without spending a bomb, but only your own |

Three cards trade for bonus troops (Risk sets: 4, 6, 8, 10, …).

## 9. Lessons from Risk: Global Domination (proposal, not yet implemented)

Risk: Global Domination (SMG Studio) is the reference digital Risk. Its structure, mapped onto Brisque:

| RGD mechanic | How it works there | Brisque adaptation | Why |
|---|---|---|---|
| **3 phases**: Draft → Attack → Fortify | draft troops + trade cards, then attack freely, then **one** fortify move | **Draft** (income, cards, deploy ≤ 10) → **Attack** (moves, splits, bombs) → **Fortify** (one free classical move along a chain of your *certain* territories) | clearer turns and UI (the action bar follows the phase); fortify gives consolidation without spending attack budget |
| **Cards**: one per turn if you conquered ≥ 1 territory; sets of 3 (same or all different); must trade at 5 | the main source of late-game troops | earn a card if you **certainly** captured a territory this turn (a reason to collapse, not just superpose); three quantum suits (H, CNOT, Z) | ties card income to measurement, the core tension |
| **Progressive trade-ins**: 4, 6, 8, 10, 12, 15, then +5 each | escalating reinforcements force a decisive endgame | same curve, *or* trade a set for an ordnance from §8 (Entangler, Phase, Shield, Teleport) | **this is how Risk ends games**, and our sweep shows Brisque doesn't end without attrition (§6.4). Escalating card troops plus attrition should finish games without a round limit |
| **Fixed trade-ins**: per-set values | calmer games | option in setup | parity with RGD settings |
| **+2 on a traded card's territory** | if you hold it | same, only if held with certainty | small certainty incentive |
| **Captured cards** on elimination | take the victim's hand | same | rewards finishing players off |
| **Continent bonuses** tuned to defensibility (Australia +2 with 1 entry, Asia +7 with many borders) | bonus tracks the number of entry points, not only size | bonus ≈ 0.8 × border territories + size / 4; single-bridge continents stay cheap to hold, so a low bonus | our current `ceil(size/2) − bridge` ignores exposure |
| **Balanced blitz** | dice variance smoothed toward expected losses | an "exact odds" setting (current) vs "Lanchester" (`battleExponent` 2) | same knob, player-facing |
| **Blizzards** (impassable territories) | map modifier | reuse sunk cells; the land bridges already do this job | map variety for free |
| **Portals** (linked distant territories) | map modifier | **entangled portal pairs**: two far territories share one qubit, so collapsing one fixes the other | a native quantum modifier |
| **Capital Conquest** | protect your capital, take others' | capitals can never be superposed; win by holding all capitals | shorter games, clearer goals |
| **Fog of war** | you see only your borders | enemy threads' odds hidden until measured | measurement becomes reconnaissance |
| **Secret missions** | private objectives | e.g. "end with 3 live threads", "collapse 5 enemy battles" | quantum-flavoured goals |

**Suggested first slice:** phases + cards (progressive) + the continent-bonus formula + classic attrition as the
default. Then rerun `tools/sim-balance.js` and aim for 3-player CPU games that finish in 20–40 rounds with no round limit.
