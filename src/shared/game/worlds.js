// The quantum state of the board, as a sparse "many worlds" ensemble.
//
// A world is one complete classical board plus the histories that lead to it:
//   { board, parts: [{ bits: { [qubit]: 0|1 }, p }] }
// Each part is one assignment of split outcomes and its probability. When two histories arrive at the
// same board (a coincidence) their worlds merge by concatenating parts. Nothing is forgotten, so
// conditioning on a thread ("what if split #3 went left?") and collapsing a thread stay exact through
// any number of merges, nested splits and cascades. P(world) = Σ parts.p.
//
// Cell: { [playerId]: troops } — {} empty, one key owned, two or more keys contested (a battle).

export const cellKey = (cell) =>
  Object.keys(cell)
    .map(Number)
    .sort((a, b) => a - b)
    .map((p) => `${p}:${cell[p]}`)
    .join(',');

export const armies = (cell) => Object.keys(cell).map(Number);
export const isContested = (cell) => armies(cell).length > 1;
export const prob = (w) => w.parts.reduce((a, part) => a + part.p, 0);
export const boardKey = (w) => w.board.map(cellKey).join('|');

// P(world ∧ q = b)
export const probGiven = (w, q, b) => w.parts.reduce((a, part) => a + (part.bits[q] === b ? part.p : 0), 0);

// --- moving troops ---------------------------------------------------------------------------------

// How many of `pid`'s troops at `from` a move takes in one world.
//   take = number: "up to n" (never below the one-troop floor)
//   take = [{ atLeast, n }]: layered: in a world holding c troops there, take Σ n over layers with
//     atLeast ≤ c (the layers that exist in this world). Returns -1 if that would break the floor.
export function takeIn(count, take, rules) {
  const floor = rules.mustLeaveOne ? 1 : 0;
  if (typeof take === 'number') return Math.max(0, Math.min(take, count - floor));
  const k = take.reduce((a, layer) => a + (count >= layer.atLeast ? layer.n : 0), 0);
  if (k > 0 && k > count - floor) return -1;
  return k;
}

// Move troops in one world. Returns how many moved (0 = no-op here, -1 = would break the floor).
// Troops may withdraw from a battle; the floor keeps at least one there, so the battle goes on.
export function moveInBoard(board, pid, from, to, take, rules) {
  if (from === to) return 0;
  const src = board[from];
  if (!src[pid]) return 0;
  const k = takeIn(src[pid], take, rules);
  if (k <= 0) return k;
  src[pid] -= k;
  if (src[pid] === 0) delete src[pid];
  board[to][pid] = (board[to][pid] ?? 0) + k;
  return k;
}

// Probability layers of one player's troops at one territory (battles included): nested thresholds. [{ atLeast, n, prob }]: `n` troops exist in branches where
// the player has at least `atLeast` there, which happens with probability `prob`.
// Example: 3 in every branch + 6 more in half of them -> [{1..3: 3 @ 100%}, {9: 6 @ 50%}].
export function layers(worlds, t, pid) {
  const counts = [];
  for (const w of worlds) {
    const c = w.board[t];
    if (!c[pid]) continue;
    counts.push([c[pid], prob(w)]);
  }
  const levels = [...new Set(counts.map(([n]) => n))].sort((a, b) => a - b);
  let prev = 0;
  return levels.map((level) => {
    const out = { atLeast: level, n: level - prev, prob: counts.reduce((a, [n, p]) => a + (n >= level ? p : 0), 0) };
    prev = level;
    return out;
  });
}

// --- ensemble maintenance --------------------------------------------------------------------------

// Merge worlds with identical boards (concatenating histories), merge identical histories, renormalise.
export function normalize(worlds) {
  const byBoard = new Map();
  for (const w of worlds) {
    if (prob(w) <= 0) continue;
    const key = boardKey(w);
    const hit = byBoard.get(key);
    if (!hit) byBoard.set(key, { board: w.board, parts: w.parts.map((p) => ({ bits: { ...p.bits }, p: p.p })) });
    else hit.parts.push(...w.parts.map((p) => ({ bits: { ...p.bits }, p: p.p })));
  }
  const out = [...byBoard.values()];
  for (const w of out) {
    const byBits = new Map();
    for (const part of w.parts) {
      const k = Object.keys(part.bits).sort((a, b) => a - b).map((q) => `${q}=${part.bits[q]}`).join(',');
      const hit = byBits.get(k);
      if (hit) hit.p += part.p; else byBits.set(k, part);
    }
    w.parts = [...byBits.values()];
  }
  const total = out.reduce((a, w) => a + prob(w), 0);
  for (const w of out) for (const part of w.parts) part.p /= total;
  return out;
}

export const partCount = (worlds) => worlds.reduce((a, w) => a + w.parts.length, 0);

// P(q = b) over the whole ensemble
export const branchProb = (worlds, q, b) => worlds.reduce((a, w) => a + probGiven(w, q, b), 0);

// E[f(world) | q = b]
export function expectGiven(worlds, q, b, f) {
  let num = 0;
  let den = 0;
  worlds.forEach((w, i) => {
    const p = probGiven(w, q, b);
    num += p * f(w, i);
    den += p;
  });
  return den > 0 ? num / den : 0;
}

// Does the outcome of split q change anything observable? (the conditional distribution over whole
// boards differs between its branches). A thread that stops mattering has resolved.
export function isObservable(worlds, q) {
  const p0 = branchProb(worlds, q, 0);
  const p1 = branchProb(worlds, q, 1);
  if (p0 <= 1e-12 || p1 <= 1e-12) return false;
  for (const w of worlds) if (Math.abs(probGiven(w, q, 0) / p0 - probGiven(w, q, 1) / p1) > 1e-9) return true;
  return false;
}

// --- observation -----------------------------------------------------------------------------------

export function marginal(worlds, t) {
  const groups = new Map();
  worlds.forEach((w, i) => {
    const key = cellKey(w.board[t]);
    const g = groups.get(key) ?? { key, cell: w.board[t], prob: 0, worlds: [] };
    g.prob += prob(w);
    g.worlds.push(i);
    groups.set(key, g);
  });
  return [...groups.values()].sort((a, b) => b.prob - a.prob);
}

export const isCertain = (worlds, t) => worlds.every((w) => cellKey(w.board[t]) === cellKey(worlds[0].board[t]));

// Is territory t's distribution different depending on split q? (t is entangled with q)
export function dependsOn(worlds, t, q) {
  const dist = (b) => {
    const d = new Map();
    let total = 0;
    for (const w of worlds) {
      const p = probGiven(w, q, b);
      if (!p) continue;
      const k = cellKey(w.board[t]);
      d.set(k, (d.get(k) ?? 0) + p);
      total += p;
    }
    for (const [k, v] of d) d.set(k, v / total);
    return d;
  };
  const a = dist(0);
  const b = dist(1);
  if (a.size === 0 || b.size === 0) return false;
  for (const k of new Set([...a.keys(), ...b.keys()])) if (Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0)) > 1e-9) return true;
  return false;
}

export const certainOwner = (worlds, t) => {
  if (!isCertain(worlds, t)) return null;
  const a = armies(worlds[0].board[t]);
  return a.length === 1 ? a[0] : null;
};
