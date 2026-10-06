// Branching audit: layered troops, nested splits, reconvergence, cascades, battles over mixed layers,
// branch history (heads / trails / coincide / cross / collapse / resolve), and exactness of every
// collapse against conditional probabilities, including randomised deep histories.
//   node tools/check-branching.js [fuzzGames]
import { generateMap } from '../src/shared/mapgen/generate.js';
import { createEngine, territoryView } from '../src/shared/game/index.js';
import { branchProb, cellKey, layers, prob, probGiven } from '../src/shared/game/worlds.js';
import { createSampler } from '../src/shared/quantum/sampler.js';
import { makeRng } from '../src/shared/rng.js';
import { braidLayout } from '../src/client/ui/braidLayout.js';
import { botAction } from '../src/shared/game/bot.js';
const histories = []; // every final state, for the braid layout checks

let failures = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${extra}`); if (!ok) { failures++; process.exitCode = 1; } };
const approx = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const forced = (pick) => async (probs) => ({ index: typeof pick === 'function' ? pick(probs) : pick, source: 'forced', ms: 0 });
const random = (seed) => createSampler({ rand: makeRng(seed).next });

// --- find a map with the shapes the scenarios need -----------------------------------------------------
//   A–B, A–C, B–D, C–D (a diamond: two routes that reconverge at D), E–B, F–A, X–C, spare Z far away
function findLayout() {
  for (let seed = 1; seed < 200; seed++) {
    const map = generateMap(seed);
    const nb = (t) => map.territories[t].neighbors;
    for (const A of map.territories.map((t) => t.id)) {
      for (const B of nb(A)) for (const C of nb(A)) {
        if (B >= C || nb(B).includes(C)) continue;
        const D = nb(B).find((d) => d !== A && nb(C).includes(d) && !nb(A).includes(d));
        if (D === undefined) continue;
        const used = new Set([A, B, C, D]);
        const E = nb(B).find((e) => !used.has(e) && !nb(A).includes(e) && !nb(C).includes(e)); if (E === undefined) continue; used.add(E);
        const F = nb(A).find((f) => !used.has(f) && !nb(B).includes(f) && !nb(C).includes(f)); if (F === undefined) continue; used.add(F);
        const X = nb(C).find((x) => !used.has(x) && !nb(A).includes(x) && !nb(B).includes(x)); if (X === undefined) continue; used.add(X);
        const near = new Set([...used].flatMap((t) => [t, ...nb(t)]));
        const Z = map.territories.map((t) => t.id).filter((t) => !near.has(t));
        if (Z.length < 3) continue;
        return { map, A, B, C, D, E, F, X, Z };
      }
    }
  }
  throw new Error('no map with the needed layout');
}
const L = findLayout();
const { map, A, B, C, D, E, F, X, Z } = L;
console.log(`layout on map ${map.seed}: A${A} B${B} C${C} D${D} E${E} F${F} X${X}`);

function setup(place, rules = {}) {
  const engine = createEngine(map, { startTerritories: 0, splitsPerTurn: 9, movesPerTurn: 20, ...rules });
  const { state } = engine.createGame({ players: [{}, {}, {}], seed: 1 });
  state.players.forEach((p, i) => { state.worlds[0].board[Z[i]] = { [p.id]: 1 }; }); // nobody gets eliminated
  for (const [t, cell] of place) state.worlds[0].board[t] = cell;
  return { engine, state };
}
async function act(engine, state, action, sample = random('x')) {
  state.turn.current = action.player;
  return engine.apply(state, action, { sample });
}
const presence = (state, t, p) => territoryView(state, t).presence[p] ?? 0;
const kinds = (state) => state.history.map((h) => h.kind);
function invariants(state, label) {
  const total = state.worlds.reduce((a, w) => a + prob(w), 0);
  const ok = approx(total, 1) && state.worlds.every((w) => w.parts.length && w.parts.every((p) => p.p > 0));
  const threads = state.qubits.filter((q) => q.status === 'live').every((q) => approx(branchProb(state.worlds, q.id, 0) + branchProb(state.worlds, q.id, 1), 1));
  if (!ok || !threads) check(`${label}: probabilities consistent`, false, `total ${total}`);
}

// P(cell at t | condition) where condition(world, part) -> bool
function conditional(state, t, cond) {
  const d = new Map();
  let tot = 0;
  for (const w of state.worlds) for (const part of w.parts) {
    if (!cond(w, part)) continue;
    const k = cellKey(w.board[t]);
    d.set(k, (d.get(k) ?? 0) + part.p);
    tot += part.p;
  }
  for (const [k, v] of d) d.set(k, v / tot);
  return d;
}
const sameDist = (a, b) => [...new Set([...a.keys(), ...b.keys()])].every((k) => approx(a.get(k) ?? 0, b.get(k) ?? 0, 1e-9));

// 1. layers: certain + quantum troops of one colour in one territory
{
  const { engine, state } = setup([[A, { 0: 9 }]]);
  let r = await act(engine, state, { type: 'split', player: 0, from: A, to: [A, B], n: 6 });
  const la = layers(r.state.worlds, A, 0);
  check('layers: 3 certain + 6 at 50% (stay branch)', la.length === 2 && la[0].n === 3 && approx(la[0].prob, 1) && la[1].n === 6 && approx(la[1].prob, 0.5), JSON.stringify(la));
  check('history: split recorded with no parent', kinds(r.state)[0] === 'split' && r.state.history[0].parent === null);
  check('heads: stay branch at A, other at B', r.state.heads['0:0'][0] === A && r.state.heads['0:1'][0] === B);

  // 2. a classical pick (certain layer only) moves in every branch and extends no branch
  let r2 = await act(engine, r.state, { type: 'move', player: 0, from: A, to: F, take: [{ atLeast: 3, n: 2 }] });
  check('layered move: certain layer moves in every branch', approx(presence(r2.state, F, 0), 1) && r2.state.worlds.every((w) => w.board[F][0] === 2));
  check('layered move: classical troops do not extend a branch', !r2.state.heads['0:0'].includes(F) && r2.state.trails['0:0'].length === 0);

  // 3. a quantum pick (the 50% layer) moves only where it exists, and extends that branch
  let r3 = await act(engine, r.state, { type: 'move', player: 0, from: A, to: F, take: [{ atLeast: 9, n: 6 }] });
  check('layered move: 50% layer moves only in its branch', approx(presence(r3.state, F, 0), 0.5));
  check('trail: branch 0 extends A→F', r3.state.heads['0:0'].includes(F) && r3.state.trails['0:0'].some((e) => e.from === A && e.to === F) && kinds(r3.state).includes('extend'));

  // 4. a pick that would empty a branch is refused
  const bad = engine.validate(r.state, { type: 'move', player: 0, from: A, to: F, take: [{ atLeast: 3, n: 3 }] });
  check('layered move: must leave one troop in every branch', bad === 'leave at least one troop behind in every branch', bad);
  // mixed pick: 2 certain + 6 quantum -> F gets 8 in one branch, 2 in the other (summed layers)
  let r4 = await act(engine, r.state, { type: 'move', player: 0, from: A, to: F, take: [{ atLeast: 3, n: 2 }, { atLeast: 9, n: 6 }] });
  const lf = layers(r4.state.worlds, F, 0);
  check('summing: classical + quantum arrive together as layers 2@100% + 6@50%', lf.length === 2 && lf[0].n === 2 && lf[1].n === 6 && approx(lf[1].prob, 0.5), JSON.stringify(lf));
  check('summing: mixed move still extends the carrying branch', r4.state.heads['0:0'].includes(F));
  invariants(r4.state, 'layers');
}

// 5. subdivision: split the 50% layer again -> 25/25/50, nested parent, merged history kept
let nested;
{
  const { engine, state } = setup([[A, { 0: 9 }]]);
  let r = await act(engine, state, { type: 'split', player: 0, from: A, to: [B, C], n: 6 });
  r = await act(engine, r.state, { type: 'split', player: 0, from: B, to: [D, E], take: [{ atLeast: 6, n: 5 }] });
  check('subdivide: presences D 25%, E 25%, C 50%', approx(presence(r.state, D, 0), 0.25) && approx(presence(r.state, E, 0), 0.25) && approx(presence(r.state, C, 0), 0.5));
  check('subdivide: second thread is nested under branch (0,0)', JSON.stringify(r.state.qubits[1].parent) === JSON.stringify([0, 0]));
  const wc = r.state.worlds.find((w) => w.board[C][0]);
  check('subdivide: the C world keeps both histories of thread 1 (merged, not forgotten)', wc.parts.length === 2 && approx(probGiven(wc, 1, 0), 0.25) && approx(probGiven(wc, 1, 1), 0.25));
  check('subdivide: 3 distinct boards', r.state.worlds.length === 3);
  nested = { engine, state: r.state };
  histories.push(['nested', r.state]);
  invariants(r.state, 'subdivide');

  // 6. exact decoherence through a merge: collapsing thread 1 to branch 0 must leave C 50%, D 50%
  //    (forgetting the merged history would give C 67%)
  const before = { C: conditional(r.state, C, (w, p) => p.bits[1] === 0), D: conditional(r.state, D, (w, p) => p.bits[1] === 0) };
  const endRound = await (async () => {
    // force decoherence of thread 1 only: age it and end the round
    const s = structuredClone(r.state);
    s.qubits[0].born = 99; // keep thread 0 young
    s.qubits[1].born = -10;
    s.turn.current = 2;
    return engine.apply(s, { type: 'endTurn', player: 2 }, { sample: forced(0) });
  })();
  check('decoherence through a merge is exact: C 50%, D 50%', approx(presence(endRound.state, C, 0), 0.5) && approx(presence(endRound.state, D, 0), 0.5), `C ${presence(endRound.state, C, 0)}`);
  check('decoherence matches the conditional distribution', sameDist(conditional(endRound.state, C, () => true), before.C) && sameDist(conditional(endRound.state, D, () => true), before.D));
}

// 7. cascade: killing the parent branch resolves the nested thread too
{
  const { engine, state } = nested;
  state.worlds.forEach((w) => { w.board[X] = { 1: 3 }; }); // P1 next to C
  let r = await act(engine, state, { type: 'bomb', player: 1, territory: C }, forced((probs) => probs.findIndex((p) => approx(p, 0.5) && true) >= 0 ? 0 : 0));
  const occupied = r.state.worlds[0].board[C][0];
  if (occupied) {
    check('cascade: C held -> thread 0 collapses to branch 1 and the nested thread 1 resolves', r.state.qubits.every((q) => q.status === 'resolved') && !presence(r.state, D, 0) && !presence(r.state, E, 0));
  } else {
    check('cascade: C empty -> thread 0 resolves to branch 0; nested thread 1 stays live (D vs E)', r.state.qubits[0].status === 'resolved' && r.state.qubits[1].status === 'live' && approx(presence(r.state, D, 0), 0.5));
  }
  // and the other outcome, forced explicitly
  const outcomes = [];
  for (const pick of [0, 1]) {
    const res = await act(engine, structuredClone(state), { type: 'bomb', player: 1, territory: C }, forced(pick));
    outcomes.push(res.state);
  }
  const held = outcomes.find((s) => s.worlds[0].board[C][0]);
  const empty = outcomes.find((s) => !s.worlds[0].board[C][0]);
  check('cascade (held): both threads resolved, D/E empty', held && held.qubits.every((q) => q.status === 'resolved') && !presence(held, D, 0));
  check('cascade (empty): thread 0 resolved, nested thread survives 50/50', empty && empty.qubits[0].status === 'resolved' && empty.qubits[1].status === 'live' && approx(presence(empty, E, 0), 0.5));
  check('cascade: history logs collapse then resolve', held && kinds(held).includes('collapse') && kinds(held).includes('resolve'));
  histories.push(['cascade-held', held], ['cascade-empty', empty]);
}

// 8. full reconvergence: both branches take different roads to D with the same troops -> merge
{
  const { engine, state } = setup([[A, { 0: 7 }]], { mustLeaveOne: false });
  let r = await act(engine, state, { type: 'split', player: 0, from: A, to: [B, C], n: 6 });
  r = await act(engine, r.state, { type: 'move', player: 0, from: B, to: D, n: 6 });
  check('reconverge: after one road, thread still live', r.state.qubits[0].status === 'live' && r.state.heads['0:0'].includes(D));
  r = await act(engine, r.state, { type: 'move', player: 0, from: C, to: D, n: 6 });
  const k = kinds(r.state);
  check('reconverge: coincidence logged at D before the thread resolves', k.indexOf('coincide') >= 0 && k.indexOf('coincide') < k.lastIndexOf('resolve') && r.state.history.find((h) => h.kind === 'coincide').t === D);
  check('reconverge: thread resolved as reconverged, D certain', r.state.qubits[0].status === 'resolved' && r.state.history.at(-1).reason === 'reconverged' && approx(presence(r.state, D, 0), 1) && r.state.worlds.length === 1);
  check('reconverge: the merged world remembers both histories', r.state.worlds[0].parts.length === 2);
  histories.push(['reconverge', r.state]);
  invariants(r.state, 'reconverge');
}

// 9. partial coincidence: different amounts meet -> coincidence, thread stays live, D uncertain
{
  const { engine, state } = setup([[A, { 0: 9 }]], { mustLeaveOne: false });
  let r = await act(engine, state, { type: 'split', player: 0, from: A, to: [B, C], n: 8 });
  r = await act(engine, r.state, { type: 'move', player: 0, from: B, to: D, n: 3 });
  r = await act(engine, r.state, { type: 'move', player: 0, from: C, to: D, n: 5 });
  const lay = layers(r.state.worlds, D, 0);
  check('partial coincide: logged, thread live', kinds(r.state).includes('coincide') && r.state.qubits[0].status === 'live');
  check('partial coincide: D holds 3 for sure + 2 more at 50%', lay.length === 2 && lay[0].n === 3 && approx(lay[0].prob, 1) && lay[1].n === 2 && approx(lay[1].prob, 0.5), JSON.stringify(lay));
  check('partial coincide: both branches keep D as a head', r.state.heads['0:0'].includes(D) && r.state.heads['0:1'].includes(D));
  histories.push(['partial', r.state]);
  invariants(r.state, 'partial');
}

// 10. crossing: another player's thread lands where one of ours is
{
  const { engine, state } = setup([[A, { 0: 9 }], [D, { 1: 8 }]]);
  let r = await act(engine, state, { type: 'split', player: 0, from: A, to: [A, B], n: 6 });
  r = await act(engine, r.state, { type: 'split', player: 1, from: D, to: [D, B], n: 6 });
  const cross = r.state.history.find((h) => h.kind === 'cross');
  check('cross: branches of two threads meeting at B are logged', cross && cross.t === B && cross.a[0] !== cross.b[0], JSON.stringify(cross));
  check('cross: a battle exists only where both branches arrived (25%)', approx(territoryView(r.state, B).contested, 0.25));
  histories.push(['cross', r.state]);
  invariants(r.state, 'cross');
}

// 11. battle odds over mixed layers: summed per branch, then weighed by troops present in that branch
{
  const { engine, state } = setup([[A, { 0: 9 }], [F, { 1: 5 }]]);
  let r = await act(engine, state, { type: 'split', player: 0, from: A, to: [A, B], n: 6 });
  r = await act(engine, r.state, { type: 'move', player: 0, from: A, to: F, take: [{ atLeast: 3, n: 2 }, { atLeast: 9, n: 6 }] });
  const res = await act(engine, r.state, { type: 'bomb', player: 1, territory: F }, forced(0));
  const m = res.events.find((e) => e.type === 'measured');
  const probs = Object.fromEntries(m.outcomes.map((o) => [o.label, o.prob]));
  const expect = { 'P0 wins 0:8,1:5': 0.5 * 8 / 13, 'P1 wins 0:8,1:5': 0.5 * 5 / 13, 'P0 wins 0:2,1:5': 0.5 * 2 / 7, 'P1 wins 0:2,1:5': 0.5 * 5 / 7 };
  check('battle over layers: each branch fights with the troops it really has', Object.entries(expect).every(([k, v]) => approx(probs[k] ?? -1, v)), JSON.stringify(probs));
}

// 12. randomised deep histories: exactness of every collapse against conditioning
{
  const games = Number(process.argv[2] ?? 12);
  let checks = 0;
  let exact = 0;
  let deepest = 0;
  for (let g = 0; g < games; g++) {
    const rng = makeRng(`deep:${g}`);
    const engine = createEngine(map, { startTerritories: 0, splitsPerTurn: 6, movesPerTurn: 12, coherenceRounds: 99, mustLeaveOne: g % 2 === 0 });
    let { state } = engine.createGame({ players: [{}, {}, {}], seed: g });
    state.players.forEach((p, i) => { state.worlds[0].board[Z[i]] = { [p.id]: 1 }; });
    for (const [t, p, n] of [[A, 0, 12], [D, 1, 10], [X, 2, 8], [F, 1, 4]]) state.worlds[0].board[t] = { [p]: n };
    for (let step = 0; step < 60; step++) {
      const player = rng.int(0, 2);
      state.turn.current = player;
      const tiles = [A, B, C, D, E, F, X];
      const from = rng.pick(tiles);
      const nb = map.territories[from].neighbors;
      const lay = layers(state.worlds, from, player);
      const take = lay.length ? lay.map((l) => ({ atLeast: l.atLeast, n: rng.int(0, l.n) })) : null;
      const roll = rng.next();
      let action;
      if (roll < 0.35 && take) action = { type: 'split', player, from, to: rng.shuffle([from, ...nb]).slice(0, 2), take, bias: rng.pick([0.25, 0.5, 0.75]) };
      else if (roll < 0.75 && take) action = { type: 'move', player, from, to: rng.pick(nb), take };
      else action = { type: 'bomb', player, territory: rng.pick(tiles) };
      if (engine.validate(state, action)) continue;

      if (action.type === 'bomb') {
        // exactness: after the bomb, every other territory equals its distribution conditioned on the outcome
        const res = await engine.apply(state, action, { sample: random(`b${g}:${step}`) });
        const m = res.events.find((e) => e.type === 'measured');
        const chosen = res.state.worlds[0].board[action.territory];
        if (m.victor === null) {
          const key = cellKey(chosen);
          for (const t of tiles) {
            if (t === action.territory) continue;
            checks++;
            if (sameDist(conditional(res.state, t, () => true), conditional(state, t, (w) => cellKey(w.board[action.territory]) === key))) exact++;
          }
        }
        state = res.state;
      } else {
        state = (await engine.apply(state, action, { sample: random(`a${g}:${step}`) })).state;
      }
      deepest = Math.max(deepest, state.qubits.filter((q) => q.status === 'live').length);
      if (step === 59) histories.push([`deep ${g}`, state]);
      invariants(state, `deep ${g}:${step}`);

      // exactness: decohere a random live thread on a copy and compare to conditioning
      const live = state.qubits.filter((q) => q.status === 'live');
      if (live.length && rng.next() < 0.3) {
        const q = rng.pick(live).id;
        const pick = rng.int(0, 1);
        if (branchProb(state.worlds, q, pick) > 1e-9) {
          const s = structuredClone(state);
          for (const rec of s.qubits) if (rec.status === 'live') rec.born = rec.id === q ? -100 : 100;
          s.turn.current = 2;
          const res = await engine.apply(s, { type: 'endTurn', player: 2 }, { sample: forced(pick) });
          for (const t of tiles) {
            checks++;
            if (sameDist(conditional(res.state, t, () => true), conditional(state, t, (w, part) => part.bits[q] === pick))) exact++;
          }
        }
      }
    }
  }
  check(`deep histories: ${exact}/${checks} collapse checks exact, up to ${deepest} live threads at once`, exact === checks && checks > 50);
}

// 13. braid layout: structural invariants on every history, plus the specific shapes
{
  // two full CPU games too: long, messy, real histories
  for (let g = 0; g < 2; g++) {
    const engine = createEngine(map, { roundLimit: 12 });
    const rng = makeRng(`braidcpu:${g}`);
    let { state } = engine.createGame({ players: Array(3).fill({ cpu: true }), seed: g });
    while (state.winner === null) state = (await engine.apply(state, { ...botAction(engine, map, state, rng), player: state.turn.current }, { sample: random(`bc${g}`) })).state;
    histories.push([`cpu ${g}`, state]);
  }
  let bad = [];
  let rowsTotal = 0;
  for (const [name, st] of histories) {
    const { rows, live } = braidLayout(st.history, st.qubits);
    rowsTotal += rows.length;
    rows.forEach((r, i) => {
      if (new Set(r.after).size !== r.after.length) bad.push(`${name} row ${i}: duplicate strand`);
      if (i && JSON.stringify(rows[i - 1].after) !== JSON.stringify(r.before)) bad.push(`${name} row ${i}: rows do not chain`);
      const vanished = r.before.filter((id) => !r.after.includes(id));
      if (vanished.length && r.kind !== 'end') bad.push(`${name} row ${i}: ${vanished} vanished in a ${r.kind} row`);
      if (r.kind === 'swap' && Math.abs(r.after.indexOf(r.before[r.left]) - r.left) !== 1) bad.push(`${name} row ${i}: swap not adjacent`);
    });
    // live strands at the end = live branches of live threads that appear in the (bounded) history
    const expected = st.qubits.filter((q) => q.status === 'live' && st.history.some((h) => h.kind === 'split' && h.q === q.id)).flatMap((q) => [`${q.id}:0`, `${q.id}:1`]);
    if (expected.some((id) => !live.includes(id))) bad.push(`${name}: live branch missing from layout`);
  }
  check(`braid layout invariants over ${histories.length} histories (${rowsTotal} rows)`, bad.length === 0, bad.slice(0, 3).join('; '));

  const nestedRows = braidLayout(histories.find(([n]) => n === 'nested')[1].history).rows;
  const fork2 = nestedRows.find((r) => r.kind === 'fork' && r.q === 1);
  check('braid: nested split forks off its parent strand, right beside it', fork2.parent === '0:0' && fork2.after.indexOf('1:0') === fork2.after.indexOf('0:0') + 1);
  const recRows = braidLayout(histories.find(([n]) => n === 'reconverge')[1].history).rows;
  check('braid: reconvergence draws a junction, then both strands merge in one end row', recRows.some((r) => r.kind === 'junction') && recRows.at(-1).kind === 'end' && recRows.at(-1).how === 'reconverge' && recRows.at(-1).strands.length === 2);
  const partRows = braidLayout(histories.find(([n]) => n === 'partial')[1].history).rows;
  const j = partRows.find((r) => r.kind === 'junction');
  check('braid: partial coincidence links the two branches side by side and keeps them live', j && Math.abs(j.after.indexOf('0:0') - j.after.indexOf('0:1')) === 1 && braidLayout(histories.find(([n]) => n === 'partial')[1].history).live.length === 2);
  const heldRows = braidLayout(histories.find(([n]) => n === 'cascade-held')[1].history).rows;
  check('braid: cascade ends every strand (✕ for collapsed, ● for resolved)', braidLayout(histories.find(([n]) => n === 'cascade-held')[1].history).live.length === 0 && heldRows.some((r) => r.how === 'collapse') && heldRows.some((r) => r.how === 'resolve'));
}

console.log(failures ? `${failures} failing` : 'all branching checks passed');
