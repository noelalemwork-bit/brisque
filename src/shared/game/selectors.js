// Read-only views of a game state for rendering: what each territory looks like across branches,
// the probability layers of each army, and the live threads. Nothing here mutates state.

import { armies, branchProb, certainOwner, dependsOn, isContested, layers, marginal } from './worlds.js';

// One territory across all branches.
//   outcomes:  [{ cell, prob, contested }] most likely first
//   owner:     player id if certainly held by exactly one army, else null
//   presence:  { pid: probability that pid has troops here }
//   expected:  { pid: expected troop count }
//   layers:    { pid: [{ atLeast, n, prob }] }  troops grouped by how likely they exist (movable ones)
//   contested: probability this is a battle
//   threads:   live split threads this territory is entangled with
export function territoryView(state, t, live = liveThreadIds(state)) {
  const outcomes = marginal(state.worlds, t).map((g) => ({ cell: g.cell, prob: g.prob, contested: isContested(g.cell) }));
  const presence = {};
  const expected = {};
  for (const o of outcomes) {
    for (const p of armies(o.cell)) {
      presence[p] = (presence[p] ?? 0) + o.prob;
      expected[p] = (expected[p] ?? 0) + o.prob * o.cell[p];
    }
  }
  const layersBy = {};
  for (const p of Object.keys(presence)) layersBy[p] = layers(state.worlds, t, Number(p));
  return {
    territory: t,
    outcomes,
    owner: certainOwner(state.worlds, t),
    certain: outcomes.length === 1 && !outcomes[0].contested,
    presence,
    expected,
    layers: layersBy,
    contested: outcomes.filter((o) => o.contested).reduce((a, o) => a + o.prob, 0),
    contestSince: state.contests[t] ?? null,
    threads: live.filter((q) => dependsOn(state.worlds, t, q)),
  };
}

// What measuring territory t would yield, in the engine's exact order: (branch group × victor) with
// P(group) from the ensemble and P(victor | group) ∝ troops^battleExponent. Bomb previews and the engine share it.
export function measurementOutcomes(state, t, rules) {
  const outcomes = [];
  for (const g of marginal(state.worlds, t)) {
    const a = armies(g.cell);
    if (a.length < 2) { outcomes.push({ group: g, victor: null, prob: g.prob }); continue; }
    const weights = a.map((p) => g.cell[p] ** rules.battleExponent);
    const total = weights.reduce((x, y) => x + y, 0);
    a.forEach((p, i) => outcomes.push({ group: g, victor: p, prob: (g.prob * weights[i]) / total }));
  }
  return outcomes;
}

export const liveThreadIds = (state) => state.qubits.filter((q) => q.status === 'live').map((q) => q.id);

export function boardView(state) {
  const live = liveThreadIds(state);
  return state.worlds[0].board.map((_, t) => territoryView(state, t, live));
}

// Live threads with branch probabilities and where each branch is now.
export function threadsView(state) {
  return state.qubits
    .filter((q) => q.status === 'live')
    .map((q) => {
      const p1 = branchProb(state.worlds, q.id, 1);
      const p0 = branchProb(state.worlds, q.id, 0);
      return {
        ...q,
        age: state.turn.round - q.born,
        p1: p1 / (p0 + p1 || 1),
        heads: [state.heads[`${q.id}:0`] ?? [], state.heads[`${q.id}:1`] ?? []],
        trails: [state.trails[`${q.id}:0`] ?? [], state.trails[`${q.id}:1`] ?? []],
      };
    });
}

export function playerView(state, pid, engine) {
  const p = state.players[pid];
  return {
    ...p,
    isTurn: state.turn.current === pid,
    bombsReady: p.bombs.filter((b) => b === 0).length,
    income: engine.income(state, pid),
    deployLeft: state.turn.current === pid ? engine.rules.maxDeployPerTurn - state.turn.deployed : 0,
    movesLeft: state.turn.current === pid ? engine.rules.movesPerTurn - state.turn.moves : 0,
    splitsLeft: state.turn.current === pid ? engine.rules.splitsPerTurn - state.turn.splits : 0,
  };
}
