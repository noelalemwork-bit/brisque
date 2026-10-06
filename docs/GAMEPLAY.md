# Brisque: how to play

Brisque is Risk played in superposition. You conquer a procedurally generated island of 42 territories in
6 continents. Your armies can also be **split across possible futures**, and those futures are resolved by
**collapsing** them, with outcomes drawn from real quantum measurements.

## Playing online

**Play online → Quick match** pairs you with others (1 vs 1 or 4 players), or **Create room** gives a code for
friends to join. Voice chat is opt-in: press **Join voice** in the lobby or the sidebar button in game. Mute anyone with the
speaker button on their avatar (they turn grey but still ripple when they talk, so you know when to unmute them),
or mute yourself with the mic button on yours. In the lobby, and the host can add
CPU players and start. The host's browser runs the game, and everyone sees every move as it happens.

## Setup

- **Players**: 2–6, each **Human** (hotseat, sharing this device) or **CPU**. Pick names and colours in the
  local-game editor.
- **Map**: every map number is a different island. ↻ rolls a new one.
- **Start**: each player gets 4 random territories with 1 troop each. Everything else starts empty.
  Reserve troops by player count: 2p 36 · 3p 31 · 4p 26 · 5p 21 · 6p 16 (Risk's 40/35/30/25/20, minus the 4 placed).
- **Game length**: 20 / 30 / 50 rounds, or play until one player remains. At the round limit, whoever holds
  the most territory **with certainty** wins.
- **Defeated troops**: return to reserve (default), half return, or destroyed (classic Risk). See the balance note.
- **Quantum**: which machine decides the collapses (see *Quantum modes* below).

## A turn

The active player's avatar slides out of the left-hand rail and bobs. The turn has one flow, and actions can
come in any order within the turn's budgets:

1. **Income** (automatic): `max(3, ⌊certain territories ÷ 3⌋)` troops, plus a **continent bonus** for every
   continent you hold entirely **with certainty**. Territory that is only *probably* yours pays nothing.
2. **Deploy** (up to **10** per turn) from your reserve onto territory you hold with certainty.
3. **Move** (up to **5** per turn) troops to a neighbouring territory, always leaving 1 behind:
   - **empty**: you occupy it;
   - **yours**: the armies merge;
   - **enemy**: a **battle** starts (see below);
   - **a battle already there**: you join it.
   - **out of a battle**: you can retreat into a neighbouring territory. At least one troop stays, so the battle goes on.
4. **Split** (**1** per turn), the quantum move: send troops to **one of two** places at once, always **50/50**.
   Splitting troops that are already uncertain halves them again, so odds of 25%, 12.5%, ... come from nesting.
   Either destination may be the source itself ("stay put"). Until something collapses it, both futures exist.
   The board shows ghosts with their probabilities, and a **thread** appears in the right-hand panel.
5. **Bomb** (5 slots, each **recharges over 3 of your turns**): **collapse** a territory. Targeting rules: it must be
   **occupied** and **uncertain**, **not purely yours** (someone else could be there), and **in reach**: next to
   land you hold with certainty, or a place where your own troops may be too, entangled with someone else's.
   Your own splits into empty land can't be bombed by you; opponents or decoherence resolve them. On a collapse one outcome becomes real, and every possibility that disagrees vanishes, including
   entangled possibilities elsewhere on the board.
6. **End turn**.

At the end of each full round, **decoherence** kicks in. A split older than 3 rounds collapses on its own, and so
does a battle older than 2 rounds.

## Reading the board

- **Ground colour** is the occupier. Certain territory has a full-strength wash of the owner's colour. Territory an
  army only *might* hold, with no competition, gets the same wash **desaturated by that probability**.
- **Contested possibilities** (two or more armies could be there) are painted with **metaballs** around the pawns.
  Each colour covers exactly its share of the territory: its presence probability, or its odds in a battle.
  Colour changes grow outward from the territory's centre.
- **Pawns** are one per troop, up to 16 per army per territory. Certain armies stand in a tidy cluster. Uncertain
  ones **wander and bounce inside the territory**, mingling with rivals, and are **translucent** in proportion to
  their probability (a 25% troop is fainter than a 50% one). Troops in a **contested** territory shimmer with an
  iridescent film (Moth's Entanglement Shader); a split troop in a battle is both.
- **Worldlines on the map**: every live split draws a glowing tube over the terrain, from where it started to every
  territory it could be in now. Threads sharing a route wind around each other.
- **Pills** float above each territory. A solid pill is a certain count. A dashed pill shows the troops that army
  *could* have there, with the chance it is there at all written **above** it. **⚔** marks a battle. Small dots are the threads the
  territory is entangled with.
- **Worldlines** (right panel): each split is a strand, born at ● and ending at ✕ when it collapses. When
  threads interact they cross, alternating over and under, so a busy game weaves.

## Collapse, visually

A bomb falls trailing its owner's colour. If the outcome takes a while (live Moth circuits), it hovers, fuse
sparking. On impact the result is applied: losing pawns in the target are blasted outward, tumbling and fading.
Possibilities that vanished elsewhere (entangled territories) evaporate upward, and ground colours regrow from each
centre.

## Battles

When two or more armies occupy one territory it becomes **contested**. More armies can join, and any side can
retreat troops to a neighbour, always leaving at least one. It stays unresolved until it collapses.

On collapse, each army's chance of winning is its **share of the troops** (8 vs 4 → 67% / 33%). The victor keeps
the territory with all its troops. The losers' troops go back to their owners' reserves (or are partly or fully
destroyed, per the setup option).

## Layers: certain and uncertain troops

The same army can have troops in a territory that exist in **every** future plus troops that exist only in
**some**. For example, you split 6 troops "stay or go", so the ones that stayed exist in half the futures. The
game groups them into **layers**: 4 certain + 9 at 50%. Pawns show it too: certain pawns in full colour,
uncertain ones faded by their probability.

When you select a source, a **troop picker** floats above the action bar: one slider per layer you can move, set
to everything but one troop. Layers with nothing movable are simply not shown. Choose how many to send from each layer. The picked uncertain troops
only move in the futures where they exist. Every future must keep at least one troop behind.

**Subdividing:** split uncertain troops again and they fork further: 50% becomes 25% + 25%, then 12.5%, and so on.
The new thread nests under the branch it came from.

## Superposition, entanglement, collapse

- **Split** 6 troops from A into "B or C", and you get two futures: {B has 6} and {C has 6}. Their tooltips
  show 50% each, and both are **entangled** with the same thread.
- **Bomb B** and the universe picks one future. If B turns out empty, C holds the 6. Nothing needs to be
  resolved separately.
- **Split into an enemy** ("stay home or attack") and the battle exists in only one future. One bomb then decides
  both *whether* the attack happened and *who won* (for example: stayed home 50%, attack won 44%, attack lost 6%).
- **Coincidence**: a thread's two branches can take different roads and meet. If they arrive with the same troops,
  the futures merge and the thread resolves ("reconverged"). If the amounts differ, the territory holds the common
  part for certain plus the rest as a layer, and the thread lives on.
- **Cascade**: collapsing a branch also removes every thread nested inside it.
- When moves involve several threads, those threads **braid**. The right-hand panel draws each live thread as a
  strand, and every interaction twists two strands over each other.
- **Moving out of a superposed territory** moves whatever is there in each future.
- **Deploying** needs certainty, because your reserve is always real.

## How a bomb decides

A bomb looks at one territory and makes it real. The game lists every distinct thing the territory could contain,
**adds up the probability of every history that leads to it** (two different routes to the same contents count
together), and splits each battle by troop share:

> P(outcome) = P(the territory holds exactly these armies) × P(this army wins | those armies)
>
> P(army wins | armies) = its troops ÷ all troops present **in that future**

Certain and uncertain troops only matter through the futures they exist in. **Worked example.** You hold 3 certain
+ 6 at 50% (the 6 exist only in the future where your split stayed home). You attack 5 defenders, sending 2 of the
certain and all 6 uncertain. The defender's territory now has two possible contents:

| Future (50% each) | Battle | You win | They win |
|---|---|---|---|
| your 6 stayed home, so you arrive with 8 | 8 vs 5 | 50% × 8/13 = **30.8%** | 50% × 5/13 = **19.2%** |
| they didn't, so you arrive with 2 | 2 vs 5 | 50% × 2/7 = **14.3%** | 50% × 5/7 = **35.7%** |

Your overall odds are 45.1%. Not 8/13 or 2/7, and not the odds of your average (5 vs 5). The bomb also decides
*which* future is real, so the other territories tied to that split resolve too.

**The circuit.** Those four probabilities are loaded into real qubits and measured once. With 4 outcomes that takes
2 qubits, with outcome i read as the bits (q1 q0):

```
ry(1.5708) q[1];          // q1: which future. P(q1 = 1) = 14.3% + 35.7% = 50%  -> angle 2·asin(√0.5) = π/2
ry(1.6758) q[0];          // q0: who wins, rotated by an angle that depends on q1:
cx q[1],q[0];             //   q1 = 0 (8 vs 5): 2·asin(√(19.2/50))  = 1.338
ry(-0.3379) q[0];         //   q1 = 1 (2 vs 5): 2·asin(√(35.7/50))  = 2.014
cx q[1],q[0];             //   (a uniformly controlled rotation: RY((a+b)/2), CX, RY((a-b)/2), CX)
measure q -> c;
```

A plain two-army battle is a single `ry` on one qubit. Up to 4 outcomes use 2 qubits and up to 8 use 3, with
the same rule repeated per level. On **Emulator** this circuit runs in your browser; on **Moth live circuits** it
runs on Moth's service. On **IBM QPU randomness** a certified hardware random number picks the outcome with exactly
these probabilities.

## Strategy

The maths above makes some plays strictly better than others.

- **Only certainty pays.** Income and continent bonuses count certain territory only. A position that is "probably
  yours" earns nothing, so collapse your good bets before your turn ends. Opponents may bomb them first.
- **Bomb what you're ahead in.** Before bombing, add up your *win share* over the futures (the table above). Above
  50%, bombing now locks in the edge; below it, wait, reinforce the battle, or let decoherence roll the dice later.
  Bomb mode's dashed rings show everything else that will collapse with it, so check you aren't also resolving a
  split that currently favours you.
- **Attack with certain troops, scout with uncertain ones.** A battle weighs only the troops present in each
  future. Uncertain troops add a lot to the good future and nothing to the bad one, so 2 certain + 6 at 50% wins
  45% against 5, while 5 certain wins 50%. When a single battle matters, send certain troops.
- **Splits are free options.** A "stay | attack" split starts a battle in only one future. If the attack goes
  badly you can retreat from the battle or leave it for decoherence, and your stay branch still holds home. Against
  an opponent who can't reach the target with a bomb, the split resolves on its own after 3 rounds.
- **Your own splits are bomb-proof.** You can't bomb territory that only you could occupy, and an opponent can only
  bomb it if their troops are adjacent or entangled there. Splitting into empty interior land is a safe way to hold
  ground in two places for a while (but it earns nothing until it collapses).
- **Subdividing spreads thin.** Each nesting halves the odds (25%, 12.5%, ...). Deep branches rarely win battles,
  but they force opponents to spend bombs to find you.
- **Retreat instead of dying.** A battle you're losing badly can be abandoned down to one troop. Pull the rest back
  to certain land, where they can be reinforced and pay income.
- **Mind the rules you picked.** If defeated troops return to reserve (default), attacking costs only tempo, so play
  aggressively. If they're destroyed (classic Risk), only take battles above about 60%.
- **Clocks.** Splits decohere after 3 rounds and battles after 2. Plan bombs around those deadlines: a collapse you
  trigger lands on your turn, while a decoherence lands whenever the round ends.

## Winning

- **Elimination**: a player with no troops on the board in any future is out.
- **Conquest**: hold every territory with certainty, or be the last player standing.
- **Round limit**: the most territory held with certainty wins.

## Controls

| Input | Action |
|---|---|
| Click your territory | select it as the source |
| **← / →** | switch action (deploy, move, split, bomb); greyed-out ones are skipped |
| **↑ / ↓** | more / fewer troops |
| Click a neighbour | move / attack (the arrow preview shows your odds) |
| Shift+click, then click | split between those two targets (click the source itself for "stay") |
| **S**, then source, target, target | split (keyboard route) |
| Right-click your territory | deploy +1 (Shift: +5) |
| **D**, then click | deploy the selected count |
| **B**, then click | bomb. Dashed rings show every territory the bomb would also collapse |
| **1–9**, **0** (all), **+ / −**, Alt+wheel | troop count (of the focused layer) |
| **Tab / Shift+Tab** | focus the next / previous troop layer (layered sources) |
| troop picker | drag a slider, or use **0** / **all** beside it |
| **Space / Enter** | end turn |
| **Esc** | cancel; press again to pause |
| **C** | centre the camera on the selection |
| Drag / wheel | orbit / zoom |

## Quantum modes

| Mode | What decides a collapse | Speed | Where it works |
|---|---|---|---|
| **Emulator** | the collapse circuit runs on an exact statevector simulator in your browser | instant | everywhere |
| **Moth · IBM QPU randomness** | certified hardware randomness from IBM quantum computers (Moth `comet-qrng`), fetched in advance and shipped with the game | instant | everywhere (≈6,000 collapses per bundle) |
| **Moth · live circuits** | each collapse's circuit is sent to Moth (`tomography-api-v2`) and measured once | 5 s – minutes | dev server, or an origin Moth allowlists (plus your key) |

Every collapse is a real circuit. A two-army battle is one `RY(θ)` rotation with θ set by the troop ratio.
Outcomes with 3–4 possibilities use an exact 2-qubit amplitude encoding. The collapse panel says which machine
decided each outcome.

## Balance note (tentative rules)

With CPU players, the design-brief rule (defeated troops return to reserve) never ended a 3-player game within 150
rounds. Classic Risk (troops destroyed) finished every test game in 48–132 rounds. The round limit guarantees an
ending either way. Numbers: `docs/GAME-DESIGN.md`.
