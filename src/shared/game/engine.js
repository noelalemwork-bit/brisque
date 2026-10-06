// Brisque rules engine. Pure data in, data out: no DOM, no three.js, no networking, no Math.random.
//
//   const engine = createEngine(map, rules);
//   let state = engine.createGame({ players: [{ name: 'A' }, { name: 'B' }], seed });
//   const err = engine.validate(state, action);             // cheap, sync: for UI previews
//   const { state: next, events } = await engine.apply(state, action, { sample });
//
// `sample(probs, label)` decides every quantum outcome (see quantum/sampler.js). `apply` never mutates
// its input, so a thrown GameError leaves the caller's state untouched. `events` drive animation / UI.
//
// Actions (all carry `player`). Troop selection is either `n` ("up to n", in every branch) or `take`,
// a layered pick: [{ atLeast, n }] takes n troops from the layer that exists in branches holding at
// least `atLeast` there (see worlds.layers). Layered picks must leave one troop in every branch.
//   { type: 'deploy', territory, n }
//   { type: 'move',   from, to, n | take }
//   { type: 'split',  from, to: [a, b], n | take }   always 50/50 (rules.allowBias honours `bias`); a or b may be `from`
//   { type: 'bomb',   territory }
//   { type: 'endTurn' }
//
// Branch history (for worldlines and braids). Every split thread q has two branches (q,0) and (q,1).
//   heads[q:b]   territories where that branch's troops are now
//   trails[q:b]  the moves that branch made: [{ from, to, at }]
//   history      ordered log: split (with parent branch), extend, cross, coincide, collapse, resolve
// A move extends branch (q,b) from X to Y when X is one of its heads and the move carries more troops,
// in expectation, in branches where q=b than where q≠b. Coincide: both branches of q have a head on
// the same territory. Cross: branches of different threads share a head. Collapse: a branch loses all
// probability. Resolve: the thread no longer changes anything observable (collapsed, or reconverged).

import { measurementOutcomes } from './selectors.js';
import { RULES, PLAYER_COLORS } from './config.js';
import { makeRng } from '../rng.js';
import {
  armies, branchProb, cellKey, certainOwner, dependsOn, expectGiven, isCertain, isContested, isObservable, marginal,
  moveInBoard, normalize, partCount, prob,
} from './worlds.js';

export class GameError extends Error {}
const fail = (msg) => { throw new GameError(msg); };
const HISTORY_LIMIT = 400;

// seen keys: `c<q>@<t>` (coincidence) or `x<q>:<b>|<q>:<b>@<t>` (crossing)
const seenInvolves = (key, q) => key.slice(1).split('@')[0].split('|').some((part) => part.split(':')[0] === String(q));

export function createEngine(map, rules = RULES) {
  const R = { ...RULES, ...rules };
  const N = map.territories.length;
  const adjacent = (a, b) => map.territories[a].neighbors.includes(b);

  // --- setup ------------------------------------------------------------------------------------

  // `first`: seat that opens the game (a quantum coin toss in the client); rounds end when play wraps back to it
  function createGame({ players, seed = 0, first = 0 }) {
    if (players.length < 2 || players.length > 6) fail('2 to 6 players');
    if (!(first >= 0 && first < players.length)) first = 0;
    const rng = makeRng(`deal:${seed}`);
    const board = Array.from({ length: N }, () => ({}));
    const deck = rng.shuffle([...Array(N).keys()]);
    players.forEach((_, pid) => {
      for (let k = 0; k < R.startTerritories; k++) board[deck[pid * R.startTerritories + k]][pid] = R.startTroopsPerTerritory;
    });
    const state = {
      mapSeed: map.seed,
      rules: R,
      players: players.map((p, pid) => ({
        id: pid,
        name: p.name ?? `Player ${pid + 1}`,
        color: p.color ?? PLAYER_COLORS[pid],
        cpu: !!p.cpu,
        inventory: R.startInventory[players.length] - R.startTerritories * R.startTroopsPerTerritory,
        bombs: Array(R.bombSlots).fill(0), // turns until each slot is ready; 0 = ready
        alive: true,
      })),
      turn: { round: 1, current: first, first, deployed: 0, moves: 0, splits: 0 },
      worlds: [{ board, parts: [{ bits: {}, p: 1 }] }],
      qubits: [], // { id, owner, born, bornAt, from, to, bias, parent, status: live|resolved, closedRound, closedAt }
      nextQubit: 0,
      heads: {},
      trails: {},
      history: [],
      seen: {}, // crossings / coincidences already recorded
      contests: {}, // territory -> round the battle started
      winner: null,
      log: [], // accepted actions with their quantum outcomes (replay / audit)
    };
    const events = [];
    startTurn(state, events);
    return { state, events };
  }

  // --- queries ------------------------------------------------------------------------------------

  function income(state, pid) {
    const held = [];
    for (let t = 0; t < N; t++) if (certainOwner(state.worlds, t) === pid) held.push(t);
    let troops = Math.max(R.minIncome, Math.floor(held.length / R.territoriesPerTroop));
    if (R.continentBonus) {
      const set = new Set(held);
      for (const c of map.continents) if (c.territories.every((t) => set.has(t))) troops += c.bonus;
    }
    return troops;
  }

  const isUncertain = (state, t) =>
    !isCertain(state.worlds, t) || state.worlds.some((w) => isContested(w.board[t]));

  function validate(state, action) {
    try {
      if (action.type === 'bomb') checkBomb(state, action);
      else if (action.type === 'endTurn') checkTurn(state, action);
      else applySync(structuredClone(state), action, []);
      return null;
    } catch (err) {
      if (err instanceof GameError) return err.message;
      throw err;
    }
  }

  // --- apply ------------------------------------------------------------------------------------

  async function apply(state, action, { sample }) {
    const s = structuredClone(state);
    const events = [];
    const entry = { action, outcomes: [] };
    const measureCtx = { sample, events, entry };
    if (action.type === 'bomb') await bomb(s, action, measureCtx);
    else if (action.type === 'endTurn') await endTurn(s, action, measureCtx);
    else applySync(s, action, events);
    s.log.push(entry);
    checkEnd(s, events);
    return { state: s, events };
  }

  function checkTurn(state, { player }) {
    if (state.winner !== null) fail('game over');
    if (player !== state.turn.current) fail('not your turn');
  }

  function troopPick(action) {
    if (action.take !== undefined) {
      const take = action.take;
      if (!Array.isArray(take) || !take.length) fail('take must be a list of layers');
      for (const l of take) if (!(Number.isInteger(l.atLeast) && l.atLeast >= 1 && Number.isInteger(l.n) && l.n >= 0)) fail('bad layer pick');
      if (take.reduce((a, l) => a + l.n, 0) < 1) fail('pick at least one troop');
      return take.map(({ atLeast, n }) => ({ atLeast, n }));
    }
    if (!(Number.isInteger(action.n) && action.n >= 1)) fail('troop count must be a positive integer');
    return action.n;
  }

  // Apply a move in every world; returns per-world amounts (indexed like `worlds`).
  function moveEverywhere(worlds, player, from, to, pick) {
    return worlds.map((w) => {
      const k = moveInBoard(w.board, player, from, to, pick, R);
      if (k < 0) fail('leave at least one troop behind in every branch');
      return k;
    });
  }

  function applySync(s, action, events) {
    checkTurn(s, action);
    const { player } = action;
    const territory = (t) => { if (!(Number.isInteger(t) && t >= 0 && t < N)) fail(`bad territory ${t}`); return t; };

    switch (action.type) {
      case 'deploy': {
        const t = territory(action.territory);
        const n = action.n;
        if (!(Number.isInteger(n) && n >= 1)) fail('troop count must be a positive integer');
        if (n > s.players[player].inventory) fail('not enough troops in inventory');
        if (s.turn.deployed + n > R.maxDeployPerTurn) fail(`at most ${R.maxDeployPerTurn} troops deployed per turn`);
        if (certainOwner(s.worlds, t) !== player) fail('deploy only where you certainly hold the territory');
        for (const w of s.worlds) w.board[t][player] += n;
        s.players[player].inventory -= n;
        s.turn.deployed += n;
        events.push({ type: 'deployed', player, territory: t, n });
        return;
      }

      case 'move': {
        const from = territory(action.from);
        const to = territory(action.to);
        const pick = troopPick(action);
        if (s.turn.moves >= R.movesPerTurn) fail(`at most ${R.movesPerTurn} moves per turn`);
        if (!adjacent(from, to)) fail('territories are not adjacent');
        const before = s.worlds.map((w) => isContested(w.board[to]));
        const amounts = moveEverywhere(s.worlds, player, from, to, pick);
        const pMoved = s.worlds.reduce((a, w, i) => a + (amounts[i] > 0 ? prob(w) : 0), 0);
        if (pMoved === 0) fail('that move changes nothing in any branch');
        const expected = s.worlds.reduce((a, w, i) => a + prob(w) * amounts[i], 0);
        s.turn.moves++;
        events.push({ type: 'moved', player, from, to, n: Math.max(...amounts), probability: pMoved, expected });
        noteContests(s, to, before, events);
        trace(s, s.worlds, [{ from, to, amounts }], events);
        s.worlds = normalize(s.worlds); // different roads can reach the same board: merge them (histories kept)
        settle(s, events);
        return;
      }

      case 'split': {
        const from = territory(action.from);
        const to = (action.to ?? []).map(territory);
        const pick = troopPick(action);
        const bias = R.allowBias ? action.bias ?? 0.5 : 0.5;
        if (s.turn.splits >= R.splitsPerTurn) fail(`at most ${R.splitsPerTurn} split per turn`);
        if (to.length !== 2 || to[0] === to[1]) fail('a split needs two different destinations');
        for (const d of to) if (d !== from && !adjacent(from, d)) fail('split destinations must be adjacent (or the source itself)');
        if (!(bias > 0 && bias < 1)) fail('bias must be strictly between 0 and 1');

        const q = s.nextQubit;
        const before = to.map((d) => s.worlds.flatMap((w) => [isContested(w.board[d]), isContested(w.board[d])]));
        const branched = [];
        const amounts = [[], []]; // per destination, per branched world
        for (const w of s.worlds) {
          for (const bit of [0, 1]) {
            const scale = bit ? bias : 1 - bias;
            const b = { board: w.board.map((c) => ({ ...c })), parts: w.parts.map((part) => ({ bits: { ...part.bits, [q]: bit }, p: part.p * scale })) };
            const k = moveInBoard(b.board, player, from, to[bit], pick, R);
            if (k < 0) fail('leave at least one troop behind in every branch');
            amounts[bit].push(to[bit] === from ? 0 : k);
            amounts[1 - bit].push(0);
            branched.push(b);
          }
        }
        const moved = branched.map((_, i) => amounts[0][i] + amounts[1][i]);
        const stayed = to.includes(from);
        if (!moved.some((k) => k > 0)) fail('that split changes nothing in any branch');
        const worlds = normalize(branched);
        if (worlds.length > R.maxWorlds) fail(`too much superposition (${worlds.length} > ${R.maxWorlds} branches): collapse something first`);
        if (partCount(worlds) > R.maxParts) fail('the branch history is too deep: collapse something first');

        // the new thread's parent: the branch whose troops it split, if any
        const parent = liveBranches(s)
          .filter(({ q: pq, b }) => heads(s, pq, b).includes(from))
          .filter(({ q: pq, b }) => expectGiven(branched, pq, b, (_, i) => moved[i]) > expectGiven(branched, pq, 1 - b, (_, i) => moved[i]) + 1e-9)
          .sort((x, y) => y.q - x.q)[0];

        s.worlds = branched;
        to.forEach((d, i) => { if (d !== from) noteContests(s, d, before[i], events); });
        const at = s.log.length;
        // existing branches that carried these troops extend along both prongs
        trace(s, branched, to.map((d, i) => ({ from, to: d, amounts: amounts[i] })).filter((m) => m.to !== from), events);
        s.worlds = worlds;
        s.nextQubit++;
        s.turn.splits++;
        const expectedTo = to.map((_, i) => branched.reduce((a, w, j) => a + prob(w) * amounts[i][j], 0));
        s.qubits.push({ id: q, owner: player, born: s.turn.round, bornAt: at, from, to, bias, n: Math.max(...moved), parent: parent ? [parent.q, parent.b] : null, status: 'live', closedRound: null, closedAt: null });
        for (const b of [0, 1]) {
          s.heads[`${q}:${b}`] = stayed && to[b] === from ? [from] : [to[b]];
          s.trails[`${q}:${b}`] = to[b] === from ? [] : [{ from, to: to[b], at }];
        }
        pushHistory(s, { kind: 'split', q, owner: player, from, to, bias, parent: parent ? [parent.q, parent.b] : null });
        events.push({ type: 'split', player, qubit: q, from, to, n: Math.max(...moved), bias, expected: expectedTo, parent: parent ? [parent.q, parent.b] : null });
        settle(s, events);
        return;
      }

      default:
        fail(`unknown action ${action.type}`);
    }
  }

  // --- branch bookkeeping -------------------------------------------------------------------------

  const heads = (s, q, b) => s.heads[`${q}:${b}`] ?? [];
  const liveBranches = (s) => s.qubits.filter((q) => q.status === 'live').flatMap((q) => [{ q: q.id, b: 0 }, { q: q.id, b: 1 }]);
  const pushHistory = (s, h) => {
    s.history.push({ at: s.log.length, round: s.turn.round, ...h });
    if (s.history.length > HISTORY_LIMIT) s.history.splice(0, s.history.length - HISTORY_LIMIT);
  };

  // Extend branch heads along moves that carry more of that branch than of its sibling.
  function trace(s, worlds, moves, events) {
    for (const { q, b } of liveBranches(s)) {
      const key = `${q}:${b}`;
      for (const m of moves) {
        if (!heads(s, q, b).includes(m.from)) continue;
        const mine = expectGiven(worlds, q, b, (_, i) => m.amounts[i]);
        const other = expectGiven(worlds, q, 1 - b, (_, i) => m.amounts[i]);
        if (mine <= other + 1e-9) continue;
        if (!s.heads[key].includes(m.to)) s.heads[key].push(m.to);
        s.trails[key].push({ from: m.from, to: m.to, at: s.log.length });
        pushHistory(s, { kind: 'extend', q, b, from: m.from, to: m.to });
        events?.push({ type: 'extended', qubit: q, branch: b, from: m.from, to: m.to });
      }
    }
  }

  function noteContests(s, t, before, events) {
    const fresh = s.worlds.reduce((p, w, i) => p + (!before[i] && isContested(w.board[t]) ? prob(w) : 0), 0);
    if (fresh > 0) {
      s.contests[t] ??= s.turn.round;
      events.push({ type: 'contestStarted', territory: t, probability: fresh });
    }
  }

  // After any change: prune heads, then record coincidences and crossings, then detect collapses and
  // resolutions (so a reconvergence is logged before the thread it resolves is closed).
  function settle(s, events) {
    const live = s.qubits.filter((rec) => rec.status === 'live');
    // a head stays only while that branch's owner still has troops there in that branch
    for (const rec of live) {
      for (const b of [0, 1]) {
        const key = `${rec.id}:${b}`;
        s.heads[key] = s.heads[key].filter((t) => expectGiven(s.worlds, rec.id, b, (w) => w.board[t][rec.owner] ?? 0) > 0);
      }
    }
    // coincidences: both branches of one thread at the same place
    for (const rec of live) {
      for (const t of heads(s, rec.id, 0).filter((t) => heads(s, rec.id, 1).includes(t))) {
        const key = `c${rec.id}@${t}`;
        if (s.seen[key]) continue;
        s.seen[key] = true;
        pushHistory(s, { kind: 'coincide', q: rec.id, t });
        events.push({ type: 'coincided', qubit: rec.id, territory: t });
      }
    }
    // crossings: branches of different threads sharing a territory
    const at = new Map();
    for (const { q, b } of liveBranches(s)) for (const t of heads(s, q, b)) { if (!at.has(t)) at.set(t, []); at.get(t).push([q, b]); }
    for (const [t, list] of at) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const [x, y] = [list[i], list[j]];
          if (x[0] === y[0]) continue;
          const key = `x${x[0]}:${x[1]}|${y[0]}:${y[1]}@${t}`;
          if (s.seen[key]) continue;
          s.seen[key] = true;
          pushHistory(s, { kind: 'cross', a: x, b: y, t });
          events.push({ type: 'braided', a: x[0], b: y[0], branches: [x, y], territory: t });
        }
      }
    }
    // collapses and resolutions
    const closed = [];
    for (const rec of live) {
      const q = rec.id;
      const p = [branchProb(s.worlds, q, 0), branchProb(s.worlds, q, 1)];
      for (const b of [0, 1]) {
        if (p[b] > 1e-12) continue;
        pushHistory(s, { kind: 'collapse', q, b });
        events.push({ type: 'branchCollapsed', qubit: q, branch: b });
      }
      if (p[0] > 1e-12 && p[1] > 1e-12 && isObservable(s.worlds, q)) continue;
      const merged = p[0] > 1e-12 && p[1] > 1e-12;
      pushHistory(s, { kind: 'resolve', q, reason: merged ? 'reconverged' : 'collapsed', survivor: merged ? null : p[0] > 1e-12 ? 0 : 1 });
      rec.status = 'resolved';
      rec.closedRound = s.turn.round;
      rec.closedAt = s.log.length;
      for (const b of [0, 1]) { delete s.heads[`${q}:${b}`]; delete s.trails[`${q}:${b}`]; }
      for (const k of Object.keys(s.seen)) if (seenInvolves(k, q)) delete s.seen[k];
      closed.push(q);
    }
    if (closed.length) events.push({ type: 'threadsClosed', qubits: closed });
    for (const t of Object.keys(s.contests)) if (!s.worlds.some((w) => isContested(w.board[t]))) delete s.contests[t];
    events.push({ type: 'worlds', count: s.worlds.length });
  }

  // --- measurement ------------------------------------------------------------------------------

  function checkBomb(state, { player, territory: t }) {
    checkTurn(state, { player });
    if (!(Number.isInteger(t) && t >= 0 && t < N)) fail(`bad territory ${t}`);
    if (!state.players[player].bombs.includes(0)) fail('no bomb ready');
    const reason = bombBlocker(state, player, t);
    if (reason) fail(reason);
  }

  // Bomb targeting rules (null = allowed):
  //   occupied in at least one branch · uncertain · not purely the bomber's own ·
  //   in reach: adjacent to a territory the bomber certainly holds, or the bomber's troops may be there
  //   too (entangled with someone else's).
  function bombBlocker(state, player, t) {
    const worlds = state.worlds;
    if (!worlds.some((w) => Object.keys(w.board[t]).length)) return 'nothing there to bomb';
    if (!R.bombCertainTargets && !isUncertain(state, t)) return 'nothing to collapse there';
    const others = worlds.some((w) => Object.keys(w.board[t]).some((p) => Number(p) !== player));
    if (!others) return 'that is your own territory';
    const mineHere = worlds.some((w) => w.board[t][player]);
    const adjacentToMine = map.territories[t].neighbors.some((n) => certainOwner(worlds, n) === player);
    if (!mineHere && !adjacentToMine) return 'out of range: bomb next to your land, or where your troops are entangled';
    return null;
  }

  async function bomb(s, action, ctx) {
    checkBomb(s, action);
    const slot = s.players[action.player].bombs.indexOf(0);
    s.players[action.player].bombs[slot] = R.bombCooldown;
    ctx.events.push({ type: 'bombed', player: action.player, territory: action.territory, slot });
    await measureTerritory(s, action.territory, ctx, 'bomb');
  }

  // Observe everything about one territory: which contents it has and, for a battle, who won.
  // Outcomes are (branch group × victor): P(group) from the ensemble (all histories that produce that
  // exact cell, summed), then P(victor | group) ∝ troops^battleExponent from the troops actually
  // present in that group, so every mix of certain and uncertain troops of any colour is weighed in
  // the branches where it really exists.
  async function measureTerritory(s, t, { sample, events, entry }, cause) {
    const outcomes = measurementOutcomes(s, t, R);
    const label = (o) => (o.victor !== null ? `P${o.victor} wins ${o.group.key}` : o.group.key || 'empty');
    const res = await sample(outcomes.map((o) => o.prob), `${cause === 'bomb' ? 'bomb' : 'territory'} ${t}`);
    const chosen = outcomes[res.index];

    s.worlds = s.worlds.filter((w) => cellKey(w.board[t]) === chosen.group.key);
    const returned = {};
    if (chosen.victor !== null) {
      const cell = chosen.group.cell;
      for (const p of armies(cell)) {
        if (p === chosen.victor) continue;
        returned[p] = Math.floor(cell[p] * R.returnFraction);
        s.players[p].inventory += returned[p];
      }
      const kept = Math.max(1, Math.round(cell[chosen.victor] * (1 - R.victorAttrition)));
      for (const w of s.worlds) w.board[t] = { [chosen.victor]: kept };
    }
    s.worlds = normalize(s.worlds);
    events.push({
      type: 'measured', cause, territory: t,
      outcomes: outcomes.map((o) => ({ label: label(o), prob: o.prob, cell: { ...o.group.cell }, victor: o.victor })),
      chosen: res.index, victor: chosen.victor, returned, source: res.source, ms: res.ms,
    });
    entry.outcomes.push({ territory: t, index: res.index, source: res.source, jobId: res.jobId });
    settle(s, events);
  }

  // Decoherence of a split thread: one branch becomes reality. Exact through merges: each world keeps
  // only the histories consistent with the outcome.
  async function measureQubit(s, q, { sample, events, entry }) {
    const p = [branchProb(s.worlds, q, 0), branchProb(s.worlds, q, 1)];
    const res = await sample(p, `thread ${q}`);
    for (const w of s.worlds) w.parts = w.parts.filter((part) => part.bits[q] !== 1 - res.index);
    s.worlds = normalize(s.worlds.filter((w) => w.parts.length));
    entry.outcomes.push({ qubit: q, index: res.index, source: res.source, jobId: res.jobId });
    events.push({ type: 'measured', cause: 'decoherence', qubit: q, outcomes: [{ label: 'branch 0', prob: p[0], branch: 0 }, { label: 'branch 1', prob: p[1], branch: 1 }], chosen: res.index, source: res.source, ms: res.ms });
    settle(s, events);
  }

  // --- turn flow --------------------------------------------------------------------------------

  async function endTurn(s, action, ctx) {
    checkTurn(s, action);
    ctx.events.push({ type: 'turnEnded', player: action.player });
    let next = s.turn.current;
    do {
      next = (next + 1) % s.players.length;
      if (next === (s.turn.first ?? 0)) await endRound(s, ctx);
    } while (!s.players[next].alive && s.players.some((p) => p.alive));
    s.turn.current = next;
    startTurn(s, ctx.events);
  }

  async function endRound(s, ctx) {
    const round = s.turn.round;
    for (const q of s.qubits) {
      if (q.status === 'live' && round - q.born + 1 >= R.coherenceRounds) await measureQubit(s, q.id, ctx);
    }
    for (const [t, since] of Object.entries(s.contests)) {
      if (round - since + 1 >= R.contestRounds && s.contests[t] !== undefined) await measureTerritory(s, Number(t), ctx, 'decoherence');
    }
    s.turn.round++;
    ctx.events.push({ type: 'roundEnded', round });
  }

  function startTurn(s, events) {
    const pid = s.turn.current;
    const p = s.players[pid];
    const gained = income(s, pid);
    p.inventory += gained;
    p.bombs = p.bombs.map((b) => Math.max(0, b - 1));
    Object.assign(s.turn, { deployed: 0, moves: 0, splits: 0 });
    events.push({ type: 'turnStarted', player: pid, round: s.turn.round, income: gained, bombs: [...p.bombs] });
  }

  function checkEnd(s, events) {
    for (const p of s.players) {
      if (!p.alive) continue;
      const onBoard = s.worlds.some((w) => w.board.some((c) => c[p.id]));
      if (!onBoard) { p.alive = false; events.push({ type: 'eliminated', player: p.id }); }
    }
    const alive = s.players.filter((p) => p.alive);
    const sweep = alive.find((p) => [...Array(N).keys()].every((t) => certainOwner(s.worlds, t) === p.id));
    const byRounds = R.roundLimit > 0 && s.turn.round > R.roundLimit;
    if (alive.length === 1 || sweep || byRounds) {
      const held = (pid) => [...Array(N).keys()].filter((t) => certainOwner(s.worlds, t) === pid).length;
      s.winner = sweep?.id ?? alive.reduce((a, b) => (held(b.id) > held(a.id) ? b : a)).id;
      events.push({ type: 'gameOver', winner: s.winner });
    }
  }

  return {
    rules: R, createGame, validate, apply, income, isUncertain,
    canBomb: (state, player, t) => !bombBlocker(state, player, t),
    dependsOn: (state, t, q) => dependsOn(state.worlds, t, q),
  };
}
