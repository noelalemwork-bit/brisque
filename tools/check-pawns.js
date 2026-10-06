// Headless stress test of the pawn physics: two full armies bouncing in one territory for 2 simulated
// minutes with frame hitches. Asserts containment, bounded speed, no NaN.
import * as THREE from 'three';
import { generateMap } from '../src/shared/mapgen/generate.js';
import { createPawns } from '../src/client/pieces/pawns.js';
import { makeRng } from '../src/shared/rng.js';

const map = generateMap(7);
const frames = new Set();
const stage = { map, board: { heightAt: () => 1 }, scene: new THREE.Scene(), onFrame: (fn) => { frames.add(fn); return () => frames.delete(fn); } };
const pawns = createPawns(stage);
const t = map.territories.reduce((a, b) => (b.neighbors.length > a.neighbors.length ? b : a)).id;
const view = (cell, certain) => map.territories.map((_, i) => ({ territory: i, certain: true, presence: i === t ? Object.fromEntries(Object.keys(cell).map((p) => [p, 1])) : {}, outcomes: [{ cell: i === t ? cell : {}, prob: 1 }] })).map((v) => (v.territory === t ? { ...v, certain } : v));
const players = [{ id: 0, color: '#f00' }, { id: 1, color: '#00f' }];
pawns.sync(view({ 0: 16, 1: 16 }, false), players);

const rng = makeRng('phys');
let worst = 0;
let escapes = 0;
let nan = 0;
const region = pawns.regions[t];
const inside = ([x, y]) => {
  let c = false;
  for (let i = 0, j = region.poly.length - 1; i < region.poly.length; j = i++) {
    const [xi, yi] = region.poly[i]; const [xj, yj] = region.poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
for (let step = 0, time = 0; time < 120; step++) {
  const dt = rng.next() < 0.02 ? 0.25 : 1 / 60; // occasional hitches
  time += dt;
  for (const f of frames) f(dt, time);
  if (step % 600 === 300) pawns.shockwave(t, 12); // bomb blasts
  const ps = pawns.positions(t);
  for (const p of ps) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) nan++;
    else if (!inside([p.x, p.z])) escapes++;
  }
}
// mixing: share of pawns whose nearest neighbour belongs to the other army (≈0.5 = well mixed)
{
  let cross = 0;
  let samples = 0;
  for (let k = 0; k < 20; k++) {
    for (let s = 0; s < 30; s++) for (const f of frames) f(1 / 60, 0);
    const ps = pawns.positions(t);
    for (const p of ps) {
      let best = null;
      let bd = Infinity;
      for (const q of ps) { if (q === p) continue; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = q; } }
      if (best.owner !== p.owner) cross++;
      samples++;
    }
  }
  const mix = cross / samples;
  console.log(`mixing index ${mix.toFixed(2)} (0 segregated, ~0.5 fully mixed)`);
  if (mix < 0.25) { console.log('FAIL armies segregate'); process.exitCode = 1; } else console.log('ok   armies intermingle');
}
// speeds via finite differences over one frame
const a = pawns.positions(t);
for (const f of frames) f(1 / 60, 0);
const b = pawns.positions(t);
a.forEach((p, i) => { worst = Math.max(worst, Math.hypot(b[i].x - p.x, b[i].z - p.z) * 60); });
console.log(`${a.length} pawns · NaN ${nan} · escapes ${escapes} · max speed ${worst.toFixed(2)} u/s`);
if (nan || escapes || worst > 7 || a.length !== 32) { console.log('FAIL'); process.exitCode = 1; } else console.log('ok   pawn physics stable');
// certain territory -> cluster: no two pawns overlapping after settling
pawns.sync(view({ 0: 16 }, true), players);
for (let k = 0; k < 600; k++) for (const f of frames) f(1 / 60, k);
const c = pawns.positions(t);
let minD = Infinity;
for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) minD = Math.min(minD, Math.hypot(c[i].x - c[j].x, c[i].z - c[j].z));
console.log(`${c.length} clustered · min gap ${minD.toFixed(2)} (pawn diameter ${(2 * 0.52).toFixed(2)} incl. margin)`);
if (c.length !== 16 || minD < 0.8) { console.log('FAIL cluster overlap'); process.exitCode = 1; } else console.log('ok   cluster without overlap');
