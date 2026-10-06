// CPU player: one action at a time, greedy, always validated against the engine. Plays the quantum
// game on purpose:
//   deploy   everything onto the most threatened frontier (or the best launch pad)
//   bomb     collapse uncertainty where our expected share beats everyone else's, or enemy threads
//            that threaten our certain land
//   split    hedged attack (stay | attack) on comparable enemies, double-expand into two empty
//            neighbours, or a pincer on two weak enemies
//   move     expand into empty land, attack clearly weaker neighbours
//   end turn
//
// `traits` (optional) is a temperament read from one qubit of an entangled state, after Wootton's quantum
// map generation (arXiv:2005.10327): ⟨Z⟩ aggression, ⟨X⟩ appetite for superposition, ⟨Y⟩ expansion,
// and `rivals[p]` = ⟨Z_me Z_p⟩ (negative: rival, attacked more; positive: ally, attacked less).

import { certainOwner, isContested, layers, marginal } from './worlds.js';
import { territoryView } from './selectors.js';

export function botAction(engine, map, state, rng, traits = null) {
  const me = state.turn.current;
  const { aggression = 0, superposition = 0, expansion = 0, rivals = {} } = traits ?? {};
  const grudge = (t) => -(rivals[certainOwner(state.worlds, t)] ?? 0); // +1 sworn rival … -1 ally
  const R = engine.rules;
  const N = map.territories.length;
  const nb = (t) => map.territories[t].neighbors;
  const valid = (a) => (engine.validate(state, { ...a, player: me }) ? null : a);
  const firstValid = (list) => { for (const a of list) { const ok = valid(a); if (ok) return ok; } return null; };
  const mine = [...Array(N).keys()].filter((t) => certainOwner(state.worlds, t) === me);
  const troops = (t) => state.worlds[0].board[t][me] ?? 0;
  const views = new Map();
  const view = (t) => { if (!views.has(t)) views.set(t, territoryView(state, t)); return views.get(t); };
  const enemyStrength = (t) => {
    let s = 0;
    for (const g of marginal(state.worlds, t)) for (const [p, n] of Object.entries(g.cell)) if (Number(p) !== me) s += g.prob * n;
    return s;
  };
  const isEmpty = (t) => state.worlds.every((w) => Object.keys(w.board[t]).length === 0);
  const locked = (t) => state.worlds.some((w) => isContested(w.board[t]));
  const threat = (t) => nb(t).reduce((a, n) => a + enemyStrength(n), 0);
  const frontier = mine.filter((t) => nb(t).some((n) => certainOwner(state.worlds, n) !== me));
  // layered picks: everything but one troop, or only the uncertain layers (keeping the certain floor)
  const lay = (t) => layers(state.worlds, t, me);
  const allButOne = (t) => lay(t).map((l, i) => ({ atLeast: l.atLeast, n: i === 0 ? l.n - 1 : l.n })).filter((l) => l.n > 0);
  const quantumOnly = (t) => {
    const ls = lay(t);
    if (!ls.length) return null;
    if (ls[0].prob < 0.999) { const all = allButOne(t); return all.length ? all : null; } // wholly uncertain: all of it is quantum
    const q = ls.filter((l) => l.prob < 0.999).map(({ atLeast, n }) => ({ atLeast, n }));
    return q.length ? q : null;
  };
  const size = (take) => take.reduce((a, l) => a + l.n, 0);
  const present = [...Array(N).keys()].filter((t) => lay(t).length && !state.worlds.every((w) => isContested(w.board[t])));

  // 1. deploy: most threatened frontier, tie-broken by empty land next door (a launch pad)
  const deployLeft = Math.min(state.players[me].inventory, R.maxDeployPerTurn - state.turn.deployed);
  if (deployLeft > 0 && frontier.length) {
    const score = (t) => threat(t) * (1 - 0.3 * aggression) + nb(t).filter(isEmpty).length * 1.5 * (1 + 0.5 * expansion) + rng.next() * 0.5;
    const t = frontier.reduce((a, b) => (score(b) > score(a) ? b : a));
    const a = valid({ type: 'deploy', territory: t, n: deployLeft });
    if (a) return a;
  }

  // 2. bomb: collapse where we come out ahead on average
  if (state.players[me].bombs.includes(0)) {
    let best = null;
    for (let t = 0; t < N; t++) {
      if (!engine.isUncertain(state, t)) continue;
      const v = view(t);
      const share = (p) => v.outcomes.reduce((a, o) => {
        const cell = Object.entries(o.cell);
        const total = cell.reduce((x, [, n]) => x + n, 0);
        return a + o.prob * (o.cell[p] ? (cell.length > 1 ? o.cell[p] / total : 1) : 0);
      }, 0);
      const mineShare = share(me);
      const theirs = Object.keys(v.presence).map(Number).filter((p) => p !== me).reduce((a, p) => Math.max(a, share(p)), 0);
      const threatensUs = theirs > 0 && nb(t).some((n) => mine.includes(n));
      const score = mineShare - theirs + (threatensUs ? 0.25 : 0) + v.threads.length * 0.05;
      if (score > 0.3 - 0.12 * aggression && (!best || score > best.score)) best = { t, score };
    }
    if (best) { const a = valid({ type: 'bomb', territory: best.t }); if (a) return a; }
  }

  // 3. split: the quantum gambit, tried every turn a split is available
  if (state.turn.splits < R.splitsPerTurn) {
    const plans = [];
    for (const t of mine) {
      const n = troops(t) - 1;
      if (n < 3) continue;
      const around = nb(t).filter((x) => !locked(x));
      const empties = around.filter(isEmpty);
      const enemies = around.filter((x) => enemyStrength(x) > 0 && certainOwner(state.worlds, x) !== me);
      for (const e of enemies) {
        const ratio = n / enemyStrength(e);
        if (ratio > 0.6 && ratio < 2.5) plans.push({ score: 3 - Math.abs(1.2 - ratio) + rng.next() + superposition + 0.5 * grudge(e), a: { type: 'split', from: t, to: [t, e], n } });
      }
      if (empties.length >= 2) {
        const [a, b] = rng.shuffle([...empties]);
        plans.push({ score: 2.2 + rng.next() + superposition + 0.5 * expansion, a: { type: 'split', from: t, to: [a, b], n: Math.max(1, Math.floor(n / 2)) } });
      }
      const weak = enemies.filter((x) => enemyStrength(x) * 1.2 < n);
      if (weak.length >= 2) plans.push({ score: 2.6 + rng.next(), a: { type: 'split', from: t, to: [weak[0], weak[1]], n } });
    }
    // subdivide: split an uncertain layer again (50% -> 25% / 25% ...), toward enemies or empty land
    for (const t of present) {
      const q = quantumOnly(t);
      if (!q || size(q) < 2) continue;
      const around = nb(t).filter((x) => !locked(x));
      if (around.length < 2) continue;
      const [a, b] = rng.shuffle([...around]);
      plans.push({ score: 3.1 + rng.next() + superposition, a: { type: 'split', from: t, to: [a, b], take: q } });
    }
    plans.sort((x, y) => y.score - x.score);
    const a = firstValid(plans.map((p) => p.a));
    if (a) return a;
  }

  // 4. classical moves: retreat from losing battles, expand into empty land, attack clearly weaker neighbours
  if (state.turn.moves < R.movesPerTurn) {
    const options = [];
    for (const t of present) {
      if (!state.worlds.some((w) => isContested(w.board[t]))) continue;
      const ours = view(t).expected[me] ?? 0;
      if (enemyStrength(t) < ours * 1.6) continue;
      const safe = nb(t).find((n) => certainOwner(state.worlds, n) === me);
      const pick = allButOne(t);
      if (safe !== undefined && pick.length) options.push({ score: 4 + rng.next(), a: { type: 'move', from: t, to: safe, take: pick } });
    }
    for (const t of mine) {
      if (troops(t) < 2) continue;
      for (const n of nb(t)) {
        if (locked(n)) continue;
        const enemy = enemyStrength(n);
        if (isEmpty(n)) options.push({ score: 3 + rng.next() + 0.8 * expansion, a: { type: 'move', from: t, to: n, n: Math.max(1, Math.floor((troops(t) - 1) / 2)) } });
        else if (enemy > 0 && troops(t) - 1 > enemy * (1.5 - 0.4 * aggression - 0.2 * grudge(n))) options.push({ score: 2 + (troops(t) - enemy) / 10 + 0.6 * aggression + 0.6 * grudge(n), a: { type: 'move', from: t, to: n, n: troops(t) - 1 } });
      }
    }
    // advance uncertain layers: push branch troops onward so worldlines travel
    for (const t of present) {
      const q = quantumOnly(t);
      if (!q) continue;
      for (const n of nb(t)) {
        if (locked(n)) continue;
        if (isEmpty(n)) options.push({ score: 2.5 + rng.next(), a: { type: 'move', from: t, to: n, take: q } });
        else if (enemyStrength(n) > 0 && size(q) > enemyStrength(n)) options.push({ score: 2.2 + rng.next(), a: { type: 'move', from: t, to: n, take: q } });
      }
    }
    options.sort((x, y) => y.score - x.score);
    const a = firstValid(options.map((o) => o.a));
    if (a) return a;
  }

  return { type: 'endTurn' };
}
