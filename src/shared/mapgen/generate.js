// Procedural Risk board. Pure data, no three.js, so the server can run it too:
// rooms only ever send `seed + options`, every client regenerates the same board.
//
// Pipeline:
//   1. scatter points, Lloyd-relax, Voronoi
//   2. cells touching the bounding box are forced to sea (trim)
//   3. score cells with fbm noise + radial falloff; best-first flood from the top cell -> land; fill lakes
//   4. grow continents from farthest-point seeds
//   5. isolate a few peripheral continents: sink cells until exactly one land bridge remains,
//      then trim weak coastal cells down to the 42-territory cap
//   6. jag every Voronoi edge (midpoint displacement, keyed per edge so both sides agree),
//      then domain-warp every vertex with low-frequency noise

import { Delaunay } from 'd3-delaunay';
import { createNoise2D } from 'simplex-noise';
import { makeRng, mulberry32, hashString } from '../rng.js';
import { nameMap } from './names.js';

export const MAP_DEFAULTS = {
  width: 100,
  height: 70,
  cells: 130,
  relax: 2,
  territories: 42, // hard cap, as in classic Risk
  growSlack: 8, // grow a few extra cells so bridge carving + trimming can land on the cap
  continents: 6,
  isolated: 2, // continents reachable through exactly one land bridge
  minContinentSize: 3,
  jagDepth: 3,
  jagAmp: 0.13,
  warpAmp: 1.4,
  warpFreq: 0.04,
};

export function generateMap(seed, options = {}) {
  const o = { ...MAP_DEFAULTS, ...options };
  const rng = makeRng(`brisque:${seed}`);
  const fbmNoise = createNoise2D(rng.next);
  const warpNx = createNoise2D(rng.next);
  const warpNy = createNoise2D(rng.next);

  // 1. points + Lloyd relaxation
  const pts = new Float64Array(o.cells * 2);
  for (let i = 0; i < o.cells; i++) {
    pts[2 * i] = rng.range(0, o.width);
    pts[2 * i + 1] = rng.range(0, o.height);
  }
  let vor = new Delaunay(pts).voronoi([0, 0, o.width, o.height]);
  for (let r = 0; r < o.relax; r++) {
    for (let i = 0; i < o.cells; i++) {
      const c = polygonCentroid(openRing(vor.cellPolygon(i)));
      pts[2 * i] = c[0];
      pts[2 * i + 1] = c[1];
    }
    vor = new Delaunay(pts).voronoi([0, 0, o.width, o.height]);
  }

  const rings = [];
  const adj = [];
  for (let i = 0; i < o.cells; i++) {
    rings.push(openRing(vor.cellPolygon(i)));
    adj.push([...vor.neighbors(i)]);
  }

  // 2. trim boundary-touching cells
  const eps = 1e-6;
  const boundary = rings.map((ring) =>
    ring.some(([x, y]) => x < eps || y < eps || x > o.width - eps || y > o.height - eps)
  );

  // 3. land mask
  const cx = o.width / 2;
  const cy = o.height / 2;
  const score = rings.map((_, i) => {
    const x = pts[2 * i];
    const y = pts[2 * i + 1];
    const d = Math.hypot((x - cx) / cx, (y - cy) / cy);
    return fbm(fbmNoise, x * 0.045, y * 0.045) * 0.55 + (1 - d);
  });
  // Steps 3-5 retry with more slack until bridge carving leaves exactly the cap with every bridge
  // placed (or we give up and keep the closest attempt). Each attempt has its own rng, so results stay deterministic.
  let best = null;
  for (let slack = o.growSlack; slack <= o.growSlack + 32; slack += 4) {
    const attemptRng = makeRng(`brisque:${seed}:land:${slack}`);
    const land = growLand(adj, boundary, score, o.territories + slack);
    fillLakes(land, adj, boundary);

    // 4. continents
    const continentOf = growContinents(land, adj, pts, o.continents, attemptRng);

    // 5. land bridges, then trim coastal cells down to the territory cap
    const sinker = makeSinker(land, adj, continentOf, o);
    const bridges = isolateContinents(land, adj, continentOf, o, attemptRng, sinker);
    trimToCap(land, adj, continentOf, score, o.territories, sinker);

    const count = land.filter(Boolean).length;
    const rank = count * 10 + bridges.length; // hitting the cap first, then the bridge count
    if (!best || rank > best.rank) best = { land, continentOf, bridges, rank };
    if (count === o.territories && bridges.length === o.isolated) break;
  }
  const { land, continentOf, bridges } = best;

  // 6. geometry
  const edgeOwners = new Map(); // edgeKey -> [cell, cell?]
  for (let i = 0; i < o.cells; i++) {
    forEachEdge(rings[i], (p, q) => {
      const k = edgeKey(p, q);
      if (!edgeOwners.has(k)) edgeOwners.set(k, []);
      edgeOwners.get(k).push(i);
    });
  }

  const warp = ([x, y]) => [
    x + o.warpAmp * warpNx(x * o.warpFreq, y * o.warpFreq),
    y + o.warpAmp * warpNy(x * o.warpFreq, y * o.warpFreq),
  ];
  const jagCache = new Map();
  const jagged = (p, q) => {
    const k = edgeKey(p, q);
    let line = jagCache.get(k);
    if (!line) {
      const [a, b] = canonical(p, q);
      line = midpointDisplace(a, b, o.jagDepth, o.jagAmp, mulberry32(hashString(`${seed}:${k}`))).map(warp);
      jagCache.set(k, line);
    }
    return samePoint(p, canonical(p, q)[0]) ? line : [...line].reverse();
  };

  const landCells = [];
  for (let i = 0; i < o.cells; i++) if (land[i]) landCells.push(i);
  const tid = new Map(landCells.map((cell, t) => [cell, t]));

  const borders = [];
  const territories = landCells.map((cell, t) => {
    const outline = [];
    let coast = false;
    forEachEdge(rings[cell], (p, q) => {
      const seg = jagged(p, q);
      outline.push(...seg.slice(0, -1));
      const other = edgeOwners.get(edgeKey(p, q)).find((c) => c !== cell);
      const otherT = other !== undefined && land[other] ? tid.get(other) : -1;
      if (otherT === -1) coast = true;
      if (otherT === -1 || t < otherT) borders.push({ a: t, b: otherT, points: seg });
    });
    return {
      id: t,
      continent: continentOf[cell],
      outline,
      centroid: polygonCentroid(outline),
      hull: rings[cell].map(warp), // the smooth (un-jagged) cell polygon: simple bounds for pieces
      neighbors: adj[cell].filter((n) => land[n]).map((n) => tid.get(n)),
      coast,
    };
  });

  // continents renumbered densely (some may have been absorbed / emptied)
  const contIds = [...new Set(territories.map((t) => t.continent))].sort((a, b) => a - b);
  const contRemap = new Map(contIds.map((c, i) => [c, i]));
  for (const t of territories) t.continent = contRemap.get(t.continent);
  const continents = contIds.map((_, i) => {
    const members = territories.filter((t) => t.continent === i).map((t) => t.id);
    const bridge = bridges.find((b) => contRemap.get(b.continent) === i);
    return {
      id: i,
      territories: members,
      bonus: Math.max(1, Math.ceil(members.length / 2) - (bridge ? 1 : 0)),
      bridge: bridge ? [tid.get(bridge.cells[0]), tid.get(bridge.cells[1])] : null,
    };
  });

  const result = { seed, width: o.width, height: o.height, territories, continents, borders };
  // names are decoration: derived from their own seed stream, so they never affect geometry
  const names = nameMap(result);
  territories.forEach((t, i) => { t.name = names.territories[i]; });
  continents.forEach((c, i) => { c.name = names.continents[i].name; c.theme = names.continents[i].theme; });
  return result;
}

// --- land mask helpers -------------------------------------------------------

// Best-first flood from the highest-scoring cell: always contiguous, exactly `count` cells.
function growLand(adj, boundary, score, count) {
  const land = new Array(adj.length).fill(false);
  let start = -1;
  for (let i = 0; i < adj.length; i++) if (!boundary[i] && (start < 0 || score[i] > score[start])) start = i;
  const frontier = new Set([start]);
  for (let placed = 0; placed < count && frontier.size; placed++) {
    let best = -1;
    for (const c of frontier) if (best < 0 || score[c] > score[best]) best = c;
    frontier.delete(best);
    land[best] = true;
    for (const n of adj[best]) if (!land[n] && !boundary[n]) frontier.add(n);
  }
  return land;
}

// Sink coastal cells (weakest score first, biggest continents first) until at most `cap` remain.
function trimToCap(land, adj, continentOf, score, cap, { trySink, sizeOf }) {
  let count = land.filter(Boolean).length;
  while (count > cap) {
    const coastal = [];
    for (let i = 0; i < land.length; i++) if (land[i] && adj[i].some((n) => !land[n])) coastal.push(i);
    coastal.sort((a, b) => sizeOf(continentOf[b]) - sizeOf(continentOf[a]) || score[a] - score[b]);
    if (!coastal.some(trySink)) break;
    count--;
  }
}

function fillLakes(land, adj, boundary) {
  const seen = new Array(land.length).fill(false);
  const queue = [];
  for (let i = 0; i < land.length; i++) if (boundary[i]) { seen[i] = true; queue.push(i); }
  while (queue.length) {
    const c = queue.pop();
    for (const n of adj[c]) if (!seen[n] && !land[n]) { seen[n] = true; queue.push(n); }
  }
  for (let i = 0; i < land.length; i++) if (!land[i] && !seen[i]) land[i] = true;
}

function components(mask, adj, allowed = null) {
  const seen = new Array(mask.length).fill(false);
  const out = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i] || (allowed && !allowed(i))) continue;
    const comp = [];
    const stack = [i];
    seen[i] = true;
    while (stack.length) {
      const c = stack.pop();
      comp.push(c);
      for (const n of adj[c]) {
        if (mask[n] && !seen[n] && (!allowed || allowed(n))) { seen[n] = true; stack.push(n); }
      }
    }
    out.push(comp);
  }
  return out;
}

// --- continents ----------------------------------------------------------------

function growContinents(land, adj, pts, k, rng) {
  const cells = land.map((l, i) => (l ? i : -1)).filter((i) => i >= 0);
  const dist2 = (a, b) => (pts[2 * a] - pts[2 * b]) ** 2 + (pts[2 * a + 1] - pts[2 * b + 1]) ** 2;

  const seeds = [rng.pick(cells)];
  while (seeds.length < Math.min(k, cells.length)) {
    let best = -1;
    let bestD = -1;
    for (const c of cells) {
      const d = Math.min(...seeds.map((s) => dist2(c, s)));
      if (d > bestD) { bestD = d; best = c; }
    }
    seeds.push(best);
  }

  const continentOf = new Array(land.length).fill(-1);
  const frontiers = seeds.map((s, ci) => { continentOf[s] = ci; return [...adj[s]]; });
  let claimed = seeds.length;
  while (claimed < cells.length) {
    let grew = false;
    for (let ci = 0; ci < seeds.length; ci++) {
      const f = frontiers[ci];
      while (f.length) {
        const idx = Math.floor(rng.next() * f.length);
        const c = f[idx];
        f[idx] = f[f.length - 1];
        f.pop();
        if (!land[c] || continentOf[c] !== -1) continue;
        continentOf[c] = ci;
        claimed++;
        grew = true;
        for (const n of adj[c]) if (land[n] && continentOf[n] === -1) f.push(n);
        break;
      }
    }
    if (!grew) break;
  }
  return continentOf;
}

// Sink border cells so that a peripheral continent touches the rest of the world
// through exactly one land adjacency. Every sink is checked: land stays one piece,
// every continent stays contiguous and above minContinentSize. Failing candidates roll back.
function makeSinker(land, adj, continentOf, o) {
  const protectedCells = new Set();
  const sizeOf = (ci) => continentOf.filter((c, i) => land[i] && c === ci).length;

  const valid = () => {
    if (components(land, adj).length !== 1) return false;
    const conts = new Set(continentOf.filter((c, i) => land[i]));
    for (const ci of conts) {
      if (components(land, adj, (i) => continentOf[i] === ci).length !== 1) return false;
      if (sizeOf(ci) < o.minContinentSize) return false;
    }
    return true;
  };

  const trySink = (cell) => {
    if (protectedCells.has(cell)) return false;
    land[cell] = false;
    if (valid()) return true;
    land[cell] = true;
    return false;
  };

  return { protectedCells, sizeOf, trySink };
}

function isolateContinents(land, adj, continentOf, o, rng, { protectedCells, trySink }) {
  const bridges = [];

  const crossings = (ci) => {
    const out = [];
    for (let a = 0; a < land.length; a++) {
      if (!land[a] || continentOf[a] !== ci) continue;
      for (const b of adj[a]) if (land[b] && continentOf[b] !== ci) out.push([a, b]);
    }
    return out;
  };

  const contIds = [...new Set(continentOf.filter((c, i) => land[i]))];
  const neighborConts = (ci) => new Set(crossings(ci).map(([, b]) => continentOf[b]));
  // most peripheral first: fewest neighbouring continents, then smallest contact surface
  contIds.sort((x, y) => neighborConts(x).size - neighborConts(y).size || crossings(x).length - crossings(y).length);

  for (const ci of contIds) {
    if (bridges.length >= o.isolated) break;
    if (bridges.some((b) => continentOf[b.cells[1]] === ci)) continue; // is someone's bridge anchor
    const snapshot = land.slice();
    const kept = rng.pick(crossings(ci));
    if (!kept) continue;

    let ok = true;
    for (let guard = 0; guard < 200; guard++) {
      const others = crossings(ci).filter(([a, b]) => !(a === kept[0] && b === kept[1]));
      if (others.length === 0) break;
      // try the cheapest removals first: cells with the fewest land neighbours
      const options = [...new Set(others.flat())]
        .filter((c) => c !== kept[0] && c !== kept[1])
        .sort((x, y) => adj[x].filter((n) => land[n]).length - adj[y].filter((n) => land[n]).length);
      if (!options.some(trySink)) { ok = false; break; }
    }

    if (ok && crossings(ci).length === 1) {
      protectedCells.add(kept[0]);
      protectedCells.add(kept[1]);
      bridges.push({ continent: ci, cells: kept });
    } else {
      for (let i = 0; i < land.length; i++) land[i] = snapshot[i];
    }
  }
  return bridges;
}

// --- geometry helpers ------------------------------------------------------------

function openRing(poly) {
  const ring = poly.map(([x, y]) => [x, y]);
  if (ring.length > 1 && samePoint(ring[0], ring[ring.length - 1])) ring.pop();
  return ring;
}

function forEachEdge(ring, fn) {
  for (let k = 0; k < ring.length; k++) {
    const p = ring[k];
    const q = ring[(k + 1) % ring.length];
    if (!samePoint(p, q)) fn(p, q);
  }
}

const round = (v) => Math.round(v * 1e5);
const pointKey = ([x, y]) => `${round(x)},${round(y)}`;
const samePoint = (p, q) => round(p[0]) === round(q[0]) && round(p[1]) === round(q[1]);
function canonical(p, q) {
  const kp = [round(p[0]), round(p[1])];
  const kq = [round(q[0]), round(q[1])];
  return kp[0] < kq[0] || (kp[0] === kq[0] && kp[1] < kq[1]) ? [p, q] : [q, p];
}
function edgeKey(p, q) {
  const [a, b] = canonical(p, q);
  return `${pointKey(a)}|${pointKey(b)}`;
}

function midpointDisplace(a, b, depth, amp, rand) {
  let line = [a, b];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (let i = 0; i < line.length - 1; i++) {
      const [ux, uy] = line[i];
      const [vx, vy] = line[i + 1];
      const len = Math.hypot(vx - ux, vy - uy) || 1;
      const off = (rand() * 2 - 1) * amp * len;
      next.push(line[i], [(ux + vx) / 2 - ((vy - uy) / len) * off, (uy + vy) / 2 + ((vx - ux) / len) * off]);
    }
    next.push(line[line.length - 1]);
    line = next;
  }
  return line;
}

export function polygonCentroid(ring) {
  let a = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    const f = x0 * y1 - x1 * y0;
    a += f;
    x += (x0 + x1) * f;
    y += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-12) return ring[0].slice();
  return [x / (3 * a), y / (3 * a)];
}

function fbm(noise, x, y, octaves = 4) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x, y);
    norm += amp;
    amp *= 0.5;
    x *= 2;
    y *= 2;
  }
  return sum / norm;
}
