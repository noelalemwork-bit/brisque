// Game-side glue for the Majorana braid (cosmetic only: no rule reads any of this).
//
// When a thread resolves we look at which other threads its worldline crossed. Mapping (a game-level
// reading, not a literal simulation of the board): a thread is a Majorana pair made from vacuum at
// its split and fused at its resolve. Each `cross` history entry between a branch of q and a branch
// of r is read as one winding of a Majorana of q's pair around one of r's. Windings compose mod 2
// (a double exchange flips both pair parities; two of them undo each other), so an odd number of
// crossings is the linked case and an even, non-zero number is unlinked. Threads that never crossed
// are left alone. What is NOT a proxy is the outcome: we run the linked or unlinked experiment from
// moth-quantum/majorana-lattice on its stabilizer engine (./braid.js), and the ψ / 1 comes out of
// those measurements. Only crossings still in the engine's capped history (400 entries) count.
//
// Each pair is fused once, at the first of the two threads to resolve, with a seed derived from the
// map seed and the two thread ids, so every client gets the same run.

import { hashString } from '../../shared/rng.js';

const results = new Map(); // thread id -> [{ partner, outcome, linked, crossings }]
const done = new Set(); // 'q|r' pairs already fused (or in flight)
let worker = null;
let fallback = null; // main-thread lab if Workers are unavailable
let nextId = 0;
const pending = new Map();
let epoch = 0;

export const fusionsFor = (q) => results.get(q) ?? [];

// a new game: forget the last one's fusions (in-flight runs from it are dropped on arrival)
export function resetFusions() { results.clear(); done.clear(); epoch++; }

// Crossing counts between thread q and every other thread, from the branch history.
export function crossings(history, q) {
  const n = new Map();
  for (const h of history) {
    if (h.kind !== 'cross') continue;
    const [x, y] = [h.a[0], h.b[0]];
    if (x === y || (x !== q && y !== q)) continue;
    const r = x === q ? y : x;
    n.set(r, (n.get(r) ?? 0) + 1);
  }
  return n;
}

function runInWorker(linked, seed) {
  if (!worker) {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const p = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) p?.reject(new Error(data.error)); else p?.resolve(data);
    };
    worker.onerror = (err) => { for (const p of pending.values()) p.reject(err); pending.clear(); worker = null; };
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, linked, seed });
  });
}

async function runOnMainThread(linked, seed) {
  fallback ??= Promise.all([import('./star.json'), import('./braid.js')]).then(async ([j, lab]) => {
    await lab.useLatticeAsync(j.default ?? j);
    return lab;
  });
  const lab = await fallback;
  await new Promise((r) => setTimeout(r, 0));
  return lab.fuseThreads(linked, seed);
}

// Run the experiment (Worker if possible). Resolves { outcomes: [v, h], fermion }.
export function fuse(linked, seed) {
  if (typeof Worker !== 'undefined') return runInWorker(linked, seed).catch(() => runOnMainThread(linked, seed));
  return runOnMainThread(linked, seed);
}

// Called when threads resolve. For each partner crossed by a resolving thread (and not fused yet),
// runs the experiment in the background and calls onResult({ q, r, linked, crossings, fermion,
// outcomes }) when it lands. Never throws and never blocks the caller.
export function threadsResolved(state, qubits, onResult) {
  const mine = epoch;
  for (const q of qubits) {
    for (const [r, count] of crossings(state.history ?? [], q)) {
      const key = q < r ? `${q}|${r}` : `${r}|${q}`;
      if (done.has(key)) continue;
      done.add(key);
      const linked = count % 2 === 1;
      const seed = hashString(`majorana:${state.mapSeed ?? 0}:${key}`);
      fuse(linked, seed).then((res) => {
        if (mine !== epoch) return;
        const add = (t, partner, outcome) => results.set(t, [...fusionsFor(t), { partner, outcome, linked, crossings: count }]);
        add(q, r, res.outcomes[0]);
        add(r, q, res.outcomes[1]);
        onResult?.({ q, r, linked, crossings: count, fermion: res.fermion, outcomes: res.outcomes });
      }).catch((err) => console.warn('majorana fusion failed', err));
    }
  }
}
