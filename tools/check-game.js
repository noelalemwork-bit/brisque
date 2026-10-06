// Rules-engine checks: scripted physics scenarios + a random fuzz with invariants after every action.
//   node tools/check-game.js [fuzzGames]
import { generateMap } from '../src/shared/mapgen/generate.js';
import { createEngine, territoryView, threadsView } from '../src/shared/game/index.js';
import { createSampler } from '../src/shared/quantum/sampler.js';
import { makeRng } from '../src/shared/rng.js';
import { prob } from '../src/shared/game/worlds.js';

const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${extra}`); if (!ok) process.exitCode = 1; };
const approx = (a, b) => Math.abs(a - b) < 1e-9;
const map = generateMap(3);
const N = map.territories.length;

// Conservation: in every branch, a player's troops on board + inventory == everything they were ever given.
function invariants(state, supplied) {
  const total = state.worlds.reduce((a, w) => a + prob(w), 0);
  if (!approx(total, 1)) return `probabilities sum to ${total}`;
  for (const w of state.worlds) {
    for (const p of state.players) {
      const onBoard = w.board.reduce((a, c) => a + (c[p.id] ?? 0), 0);
      if (onBoard + p.inventory !== supplied[p.id]) return `P${p.id} troops ${onBoard}+${p.inventory} != ${supplied[p.id]}`;
    }
    for (const c of w.board) for (const v of Object.values(c)) if (!(v > 0)) return `non-positive troops ${v}`;
  }
  return null;
}
const track = (supplied, events) => { for (const e of events) if (e.type === 'turnStarted') supplied[e.player] += e.income; };

// Hand-built position: player 0 at `a` with 9 troops, everything else empty unless placed.
function scenario(place) {
  const engine = createEngine(map, { startTerritories: 0 });
  const { state } = engine.createGame({ players: [{}, {}, {}], seed: 1 });
  // every player keeps a token troop somewhere uninvolved so nobody is eliminated mid-scenario
  const busy = new Set([a, ...map.territories[a].neighbors, ...place.map(([t]) => t)]);
  const spare = [...Array(N).keys()].filter((t) => !busy.has(t));
  state.players.forEach((p, i) => { state.worlds[0].board[spare[i]] = { [p.id]: 1 }; });
  for (const [t, cell] of place) state.worlds[0].board[t] = cell;
  return { engine, state };
}
const sampler = (seed) => createSampler({ rand: makeRng(seed).next });
const forced = (index) => async (probs) => ({ index: typeof index === 'function' ? index(probs) : index, source: 'forced', ms: 0 });

// pick a territory with two distinct neighbours that are also adjacent to nothing special
const a = map.territories.find((t) => t.neighbors.length >= 3).id;
const [b, c, d] = map.territories[a].neighbors;

{
  // split into two empty territories -> 50/50, perfectly anti-correlated; bombing one fixes the other.
  // The bomber is P1, holding a territory next to b (you may not bomb land that is only ever yours).
  const x = map.territories[b].neighbors.find((n) => n !== a && n !== c && !map.territories[a].neighbors.includes(n));
  const { engine, state } = scenario([[a, { 0: 9 }], [x, { 1: 2 }]]);
  let r = await engine.apply(state, { type: 'split', player: 0, from: a, to: [b, c], n: 6 }, { sample: sampler(1) });
  const vb = territoryView(r.state, b);
  const vc = territoryView(r.state, c);
  check('split: two branches', r.state.worlds.length === 2);
  check('split: 50/50 presence', approx(vb.presence[0], 0.5) && approx(vc.presence[0], 0.5));
  check('split: both territories entangled with the thread', vb.threads.length === 1 && vc.threads.length === 1);
  check('bomb rules: owner cannot bomb its own split', engine.validate(r.state, { type: 'bomb', player: 0, territory: b }) === 'that is your own territory');
  r.state.turn.current = 1;
  check('bomb rules: empty land cannot be bombed', engine.validate(r.state, { type: 'bomb', player: 1, territory: d }) !== null);
  r = await engine.apply(r.state, { type: 'bomb', player: 1, territory: b }, { sample: forced(0) });
  const occupied = r.state.worlds[0].board[b][0] === 6;
  check('bomb collapses the split everywhere', r.state.worlds.length === 1 && threadsView(r.state).length === 0);
  check('entangled partner resolved consistently', occupied ? !r.state.worlds[0].board[c][0] : r.state.worlds[0].board[c][0] === 6);
}

{
  // attack: 8 vs 4 -> contested; bomb -> victor keeps, loser returns to inventory
  const { engine, state } = scenario([[a, { 0: 9 }], [b, { 1: 4 }]]);
  let r = await engine.apply(state, { type: 'move', player: 0, from: a, to: b, n: 8 }, { sample: sampler(2) });
  const v = territoryView(r.state, b);
  check('attack creates a battle', v.contested === 1 && r.events.some((e) => e.type === 'contestStarted'));
  check('troops can withdraw from a battle (one stays, the battle goes on)', engine.validate(r.state, { type: 'move', player: 0, from: b, to: a, n: 1 }) === null);
  const inv1 = r.state.players[1].inventory;
  r = await engine.apply(r.state, { type: 'bomb', player: 0, territory: b }, { sample: forced(1) });
  const m = r.events.find((e) => e.type === 'measured');
  check('battle odds follow troop ratio', approx(m.outcomes[0].prob, 8 / 12) && approx(m.outcomes[1].prob, 4 / 12), JSON.stringify(m.outcomes.map((o) => o.prob.toFixed(3))));
  check('defender won (forced) -> attacker troops returned', r.state.worlds[0].board[b][1] === 4 && r.state.players[0].inventory - state.players[0].inventory === 8);
  check('loser inventory unchanged for winner', r.state.players[1].inventory === inv1);
}

{
  // split INTO an enemy: the battle only exists in one branch; bombing the battle also decides the split
  const { engine, state } = scenario([[a, { 0: 9 }], [b, { 1: 3 }]]);
  let r = await engine.apply(state, { type: 'split', player: 0, from: a, to: [a, b], n: 6 }, { sample: sampler(3) });
  const v = territoryView(r.state, b);
  check('quantum attack: battle with probability 1/2', approx(v.contested, 0.5));
  r = await engine.apply(r.state, { type: 'bomb', player: 0, territory: b }, { sample: forced((p) => p.length - 1) });
  const m = r.events.find((e) => e.type === 'measured');
  check('quantum attack outcomes: stay-home | P0 wins | P1 wins', m.outcomes.length === 3 && approx(m.outcomes.reduce((x, o) => x + o.prob, 0), 1), m.outcomes.map((o) => `${o.label}=${o.prob.toFixed(3)}`).join(' '));
  check('thread closed by the battle measurement', threadsView(r.state).length === 0);
}

{
  // three armies in one battle
  const e3 = map.territories[b].neighbors.find((x) => x !== a && !map.territories[a].neighbors.includes(x));
  const { engine, state } = scenario([[a, { 0: 9 }], [b, { 1: 3 }], [e3, { 2: 5 }]]);
  {
    let r = await engine.apply(state, { type: 'move', player: 0, from: a, to: b, n: 6 }, { sample: sampler(4) });
    r.state.turn.current = 2;
    r = await engine.apply(r.state, { type: 'move', player: 2, from: e3, to: b, n: 4 }, { sample: sampler(4) });
    r.state.turn.current = 0;
    r = await engine.apply(r.state, { type: 'bomb', player: 0, territory: b }, { sample: sampler(5) });
    const m = r.events.find((e) => e.type === 'measured');
    check('three-army battle: three outcomes 6:3:4', m.outcomes.length === 3 && approx(m.outcomes.find((o) => o.label.startsWith('P0')).prob, 6 / 13));
  }
}

// --- fuzz ---------------------------------------------------------------------------------------
const games = Number(process.argv[2] ?? 30);
let actions = 0;
let rejected = 0;
let maxWorlds = 0;
let measurements = 0;
let failures = 0;
for (let g = 0; g < games && !failures; g++) {
  const rng = makeRng(`fuzz:${g}`);
  // odd games are split-heavy to push the branch cap and decoherence
  const engine = createEngine(map, g % 2 ? { splitsPerTurn: 4, movesPerTurn: 8 } : {});
  const players = 2 + (g % 5);
  const created = engine.createGame({ players: Array(players).fill({}), seed: g });
  let state = created.state;
  const supplied = state.players.map(() => engine.rules.startInventory[players]);
  track(supplied, created.events);
  const sample = sampler(`fz${g}`);
  for (let step = 0; step < 400 && state.winner === null; step++) {
    const pid = state.turn.current;
    const t = rng.int(0, N - 1);
    const nb = map.territories[t].neighbors;
    // cumulative weights: deploy, move, split, bomb, (rest) endTurn
    const [wd, wm, ws, wb] = g % 2 ? [0.2, 0.4, 0.75, 0.8] : [0.25, 0.55, 0.7, 0.8];
    const roll = rng.next();
    const action =
      roll < wd ? { type: 'deploy', player: pid, territory: t, n: rng.int(1, 6) }
      : roll < wm ? { type: 'move', player: pid, from: t, to: rng.pick(nb), n: rng.int(1, 8) }
      : roll < ws ? { type: 'split', player: pid, from: t, to: rng.shuffle([t, ...nb]).slice(0, 2), n: rng.int(1, 8), bias: rng.pick([0.5, 0.25, 0.75]) }
      : roll < wb ? { type: 'bomb', player: pid, territory: t }
      : { type: 'endTurn', player: pid };
    if (engine.validate(state, action)) { rejected++; continue; }
    const r = await engine.apply(state, action, { sample });
    state = r.state;
    actions++;
    track(supplied, r.events);
    measurements += r.events.filter((e) => e.type === 'measured').length;
    maxWorlds = Math.max(maxWorlds, state.worlds.length);
    const err = invariants(state, supplied);
    if (err) { check(`fuzz game ${g} step ${step} ${action.type}`, false, err); failures++; break; }
  }
}
check(`fuzz: ${games} games, ${actions} actions (${rejected} rejected), ${measurements} measurements, max ${maxWorlds} branches`, failures === 0);

// --- CPU-only games must reach a winner under the shipped 30-round limit ------------------------------------------------------------
{
  const { botAction } = await import('../src/shared/game/bot.js');
  const results = [];
  for (let g = 0; g < 4; g++) {
    const engine = createEngine(map, { roundLimit: 30 });
    const rng = makeRng(`bot:${g}`);
    let { state } = engine.createGame({ players: Array(2 + (g % 3)).fill({ cpu: true }), seed: g });
    const sample = sampler(`bot${g}`);
    let steps = 0;
    while (state.winner === null && steps < 6000) {
      const a = { ...botAction(engine, map, state, rng), player: state.turn.current };
      const r = await engine.apply(state, a, { sample });
      state = r.state;
      steps++;
    }
    results.push({ players: state.players.length, winner: state.winner, rounds: state.turn.round, steps });
  }
  const done = results.filter((r) => r.winner !== null).length;
  check(`cpu games finish: ${done}/${results.length}`, done === results.length, results.map((r) => `${r.players}p:r${r.rounds}${r.winner === null ? '(unfinished)' : ''}`).join(' '));
}

// --- bomb reach: not adjacent and not entangled -> refused; entangled from afar -> allowed ------------
{
  // P0 splits from a into [a, b] where b holds P1; P2 sits far away and cannot reach b
  const { engine, state } = scenario([[a, { 0: 9 }], [b, { 1: 3 }]]);
  let r = await engine.apply(state, { type: 'split', player: 0, from: a, to: [a, b], n: 6 }, { sample: sampler(9) });
  // relocate P2's token somewhere not adjacent to b
  const w0 = r.state.worlds;
  const p2 = w0[0].board.findIndex((cell) => cell[2]);
  const far2 = map.territories.find((t) => t.id !== b && !t.neighbors.includes(b) && w0.every((w) => !Object.keys(w.board[t.id]).length)).id;
  for (const w of w0) { delete w.board[p2][2]; w.board[far2][2] = 1; }
  r.state.turn.current = 2;
  const reach = engine.validate(r.state, { type: 'bomb', player: 2, territory: b });
  check('bomb rules: out-of-range player refused', reach?.startsWith('out of range'), reach);
  r.state.turn.current = 0;
  check('bomb rules: entangled troops give reach', engine.validate(r.state, { type: 'bomb', player: 0, territory: b }) === null);
}

// --- measured outcomes are structured and complete (the HUD describes them without parsing) ------
{
  const { botAction } = await import('../src/shared/game/bot.js');
  const engine = createEngine(map, { roundLimit: 12 });
  const rng = makeRng('outcomes');
  let { state } = engine.createGame({ players: Array(4).fill({ cpu: true }), seed: 5 });
  const sample = sampler('outcomes');
  let seen = 0;
  const bad = [];
  while (state.winner === null) {
    const r = await engine.apply(state, { ...botAction(engine, map, state, rng), player: state.turn.current }, { sample });
    for (const e of r.events.filter((x) => x.type === 'measured')) {
      for (const o of e.outcomes) {
        seen++;
        if (e.qubit !== undefined) { if (o.branch !== 0 && o.branch !== 1) bad.push('branch outcome without a branch'); continue; }
        if (!o.cell || typeof o.cell !== 'object') bad.push(`no cell: ${o.label}`);
        else if (Object.values(o.cell).some((n) => !Number.isInteger(n) || n < 1)) bad.push(`bad counts: ${JSON.stringify(o.cell)}`);
        if (o.victor !== null && !o.cell?.[o.victor]) bad.push(`victor ${o.victor} not in ${JSON.stringify(o.cell)}`);
      }
    }
    state = r.state;
  }
  check(`measured outcomes are well-formed (${seen} checked)`, bad.length === 0 && seen > 20, bad.slice(0, 3).join('; '));
}
