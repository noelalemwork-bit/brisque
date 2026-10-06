// Generates many seeds and asserts the board invariants the game relies on.
import { generateMap } from '../src/shared/mapgen/generate.js';

const seeds = process.argv[2] ? [process.argv[2]] : Array.from({ length: 40 }, (_, i) => i);
let failures = 0;
for (const seed of seeds) {
  const t0 = performance.now();
  const m = generateMap(seed);
  const ms = performance.now() - t0;
  const errs = [];

  // one contiguous landmass
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) for (const n of m.territories[stack.pop()].neighbors) if (!seen.has(n)) { seen.add(n); stack.push(n); }
  if (seen.size !== m.territories.length) errs.push(`land split: ${seen.size}/${m.territories.length}`);

  // symmetric adjacency
  for (const t of m.territories) for (const n of t.neighbors) if (!m.territories[n].neighbors.includes(t.id)) errs.push(`asym ${t.id}-${n}`);

  // isolated continents have exactly one crossing
  for (const c of m.continents) {
    if (!c.bridge) continue;
    const cross = c.territories.flatMap((t) => m.territories[t].neighbors.filter((n) => m.territories[n].continent !== c.id));
    if (cross.length !== 1) errs.push(`continent ${c.id} has ${cross.length} crossings`);
  }
  if (m.territories.length > 42) errs.push(`${m.territories.length} territories > 42`);
  const bridged = m.continents.filter((c) => c.bridge).length;
  const sizes = m.continents.map((c) => c.territories.length).join(',');
  console.log(`${errs.length ? 'FAIL' : 'ok  '} seed=${seed} territories=${m.territories.length} continents=[${sizes}] bridges=${bridged} ${ms.toFixed(0)}ms ${errs.slice(0, 3).join('; ')}`);
  if (errs.length) failures++;
}
if (failures) { console.log(`${failures} failing seeds`); process.exitCode = 1; }
