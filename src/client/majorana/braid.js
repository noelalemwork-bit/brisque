// Linked / unlinked Majorana pairs on Moth's majorana-lattice (J. R. Wootton, arXiv:1501.07779).
//
// A JS port of examples/linking.py and MatchingCode._plan / route_majorana from
// moth-quantum/majorana-lattice (Apache-2.0, commit f54c652), running on the vendored stabilizer
// engine (./engine.js). Two Majorana pairs, V and H, are made from vacuum on a star 10x10 lattice and
// moved inside a disc (so no string winds round the torus):
//   linked:   open V, open H, close V, close H   (H's pair straddles V's string while V fuses)
//   unlinked: open V, close V, open H, close H
// Ising anyon theory says linked pairs both fuse to a fermion (-1, -1) and unlinked pairs both fuse
// back to vacuum (+1, +1). Nothing here is looked up: every link measurement runs on the tableau, and
// the individual outcomes along the way are random (seeded); only the fusion results are fixed by the
// topology. tools/check-majorana.mjs verifies this over many seeds.
//
// Usage: useLattice(json) (or await useLatticeAsync(json)) once, then fuseThreads(linked, seed). The
// vacuum (~0.5 s: 300 plaquette postselections on a 600-qubit tableau) is built once; each experiment
// forks it (~0.2 s). In the game this runs in a Web Worker (./worker.js via ./fusion.js).

import { MatchingCode, Tableau, pauli, setP } from './engine.js';
import { mulberry32 } from '../../shared/rng.js';

let lab = null; // { lat, vacuum, W, H, CX, CY, R, outside }

// --- setup --------------------------------------------------------------------------------------

function geometry(lat) {
  const [W, H] = lat.period;
  const CX = W / 2;
  const CY = H / 2;
  const outside = new Set();
  lat.positions.forEach(([x, y], q) => { if ((x - CX) ** 2 + (y - CY) ** 2 > 3.6 ** 2) outside.add(q); });
  return { lat, W, H, CX, CY, R: 2.2, outside };
}

// Same as MatchingCode's constructor, but the plaquette postselection (the slow part: ~300
// measurements on a 600-qubit tableau) is spread over event-loop turns when `yieldEvery` is set.
async function buildVacuum(lat, yieldEvery = 0) {
  const c = new MatchingCode({ ...lat, faces: [] }, { seed: 1 });
  c.lat = lat;
  for (let k = 0; k < lat.faces.length; k++) {
    const p = pauli(c.n);
    for (const [q, P] of Object.entries(lat.faces[k].pauli)) setP(p, +q, P);
    const raw = c.tab.measure(p, 1); // vacuum = every plaquette at +1
    c.plaquetteRaw.push(raw);
    if (raw === -1) p.r ^= 1;
    c.plaq.push(p);
    if (yieldEvery && k % yieldEvery === yieldEvery - 1) await new Promise((r) => setTimeout(r, 0));
  }
  return c;
}

export function useLattice(lat) {
  // synchronous build (Node checks); the constructor does exactly what buildVacuum does
  lab = { ...geometry(lat), vacuum: new MatchingCode(lat, { seed: 1 }) };
  return lab;
}

// Same, but the vacuum is built in slices so a main-thread fallback never stalls the game.
export async function useLatticeAsync(lat, yieldEvery = 12) {
  const vacuum = await buildVacuum(lat, yieldEvery);
  lab = { ...geometry(lat), vacuum };
  return lab;
}

export const labReady = () => lab !== null;

// The vacuum is deterministic (every random plaquette outcome is postselected to +1), so each run
// starts from a copy of it with its own random stream.
function fork(base, seed) {
  const c = Object.create(MatchingCode.prototype);
  Object.assign(c, base);
  c.seed = seed;
  c.tab = new Tableau(base.n, mulberry32(seed));
  c.tab.rows = base.tab.rows.map((r) => ({ x: r.x.slice(), z: r.z.slice(), r: r.r }));
  c.pairs = new Map([...base.pairs].map(([id, P]) => [id, { ...P, path: P.path.slice() }]));
  c.owner = base.owner.slice();
  c.log = [];
  c.fixRate = 1;
  c.fixRand = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  return c;
}

// --- routing (MatchingCode._plan / route_majorana) ----------------------------------------------

// Shortest route of moves on the current pairing: [[from, link]]. Each move rewires the vertex it
// leaves and the vertex it moves across, so a route never reuses a vertex, as a stop or as a vertex
// moved across.
function plan(c, src, dst, avoid) {
  const best = new Map([[src, { steps: [], used: new Set([src]) }]]);
  const queue = [src];
  for (let head = 0; head < queue.length; head++) {
    const q = queue[head];
    const { steps, used } = best.get(q);
    if (q === dst) return steps;
    for (const { edge: e, via: j, to: k } of c.majoranaMoves(q)) {
      if (used.has(j) || used.has(k) || avoid.has(k) || avoid.has(j) || best.has(k)) continue;
      best.set(k, { steps: [...steps, [q, e]], used: new Set([...used, j, k]) });
      queue.push(k);
    }
  }
  return null;
}

function routeMajorana(c, src, dst, avoid = new Set()) {
  if (c.isDimer(c.pairs.get(c.owner[src]))) throw new Error(`vertex ${src} is not a Majorana`);
  const steps = plan(c, src, dst, avoid);
  if (!steps) throw new Error(`no route from ${src} to ${dst}`);
  const route = [src];
  for (const [q0, e] of steps) {
    if (q0 !== route[route.length - 1]) throw new Error('route out of step');
    route.push(c.moveMajorana(q0, e).to);
  }
  if (route[route.length - 1] !== dst) throw new Error('route missed its target');
  return route;
}

// --- examples/linking.py ------------------------------------------------------------------------

const other = (E, q) => (E.u === q ? E.v : E.u);
const d2 = (pos, x, y) => (pos[0] - x) ** 2 + (pos[1] - y) ** 2;

function nearest({ lat }, x, y, exclude) {
  let best = -1;
  let bd = Infinity;
  lat.positions.forEach((pos, q) => {
    if (exclude.has(q)) return;
    const d = d2(pos, x, y);
    if (d < bd) { bd = d; best = q; }
  });
  return best;
}

// Measure the link between two dimers nearest (x, y); fix a -1 (so the new pair starts empty).
function createPair(L, c, x, y) {
  let e = -1;
  let bd = Infinity;
  c.edges.forEach((E, f) => {
    if (c.owner[E.u] === c.owner[E.v]) return;
    if (![E.u, E.v].every((q) => c.isDimer(c.pairs.get(c.owner[q])))) return;
    const d = d2(L.lat.positions[E.u], x, y);
    if (d < bd) { bd = d; e = f; }
  });
  const E = c.edges[e];
  const A = c.pairs.get(c.owner[E.u]);
  const B = c.pairs.get(c.owner[E.v]);
  const ends = [c.other(A, E.u), c.other(B, E.v)];
  const old = A.path[0];
  if (c.measureLink(e) === -1) c.applyLink(old);
  return ends;
}

function move(L, c, p, x, y, avoid) {
  let blocked = new Set([...avoid, ...L.outside]);
  for (let extra = 0; extra < 8; extra++) {
    const t = nearest(L, x + 0.3 * extra, y, blocked);
    try {
      const route = routeMajorana(c, p, t, blocked);
      return route[route.length - 1];
    } catch {
      blocked = new Set([...blocked, t]);
    }
  }
  throw new Error('no route');
}

// Bring the two Majoranas together and measure the link between them: the pair's fusion outcome.
function fuse(L, c, [p0, q], avoid) {
  let p = p0;
  for (const f of c.incident[q]) {
    const t = other(c.edges[f], q);
    if (avoid.includes(t) || L.outside.has(t)) continue;
    try {
      if (p !== t) {
        const route = routeMajorana(c, p, t, new Set([...avoid, q, ...L.outside]));
        p = route[route.length - 1];
      }
      break;
    } catch { /* try the next neighbour */ }
  }
  const e = c.incident[p].find((f) => other(c.edges[f], p) === q);
  if (e === undefined) throw new Error(`Majoranas ${p} and ${q} never met`);
  return c.measureLink(e);
}

// Run the experiment. Returns the two fusion outcomes [v, h] (+1 vacuum, -1 fermion), whether they
// fused to fermions, and the primitive action log (replayable in Stim with MatchingCode.replay).
export function fuseThreads(linked, seed = 1) {
  const L = lab;
  if (!L) throw new Error('majorana lab not loaded: call useLattice() first');
  const c = fork(L.vacuum, seed >>> 0);
  const { CX, CY, R } = L;
  let V = createPair(L, c, CX, CY);
  V = [move(L, c, V[0], CX, CY + R, V), move(L, c, V[1], CX, CY - R, V)];
  let v;
  let hv;
  if (linked) {
    let Hp = createPair(L, c, CX, CY);
    Hp = [move(L, c, Hp[0], CX + R, CY, [...V, ...Hp]), move(L, c, Hp[1], CX - R, CY, [...V, ...Hp])];
    v = fuse(L, c, V, Hp);
    hv = fuse(L, c, Hp, []);
  } else {
    v = fuse(L, c, V, []);
    let Hp = createPair(L, c, CX, CY);
    Hp = [move(L, c, Hp[0], CX + R, CY, Hp), move(L, c, Hp[1], CX - R, CY, Hp)];
    hv = fuse(L, c, Hp, []);
  }
  const random = c.log.filter((s) => s.action === 'measure_link').length;
  return {
    outcomes: [v, hv],
    fermion: v === -1 && hv === -1,
    log: c.record(),
    measurements: random,
  };
}
