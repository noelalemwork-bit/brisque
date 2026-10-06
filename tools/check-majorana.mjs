// Majorana braiding check: runs examples/linking.py from moth-quantum/majorana-lattice on the vendored
// stabilizer engine (src/client/majorana/) and verifies Ising fusion rules over many seeds:
// linked worldlines fuse to two fermions (-1, -1), unlinked ones back to vacuum (+1, +1).
// Also checks every run replays exactly from its log, and that the outcomes along the way are
// genuinely random (the fusion results are fixed by topology, not by a quiet simulator).
//   node tools/check-majorana.mjs [seeds]
import { readFileSync } from 'node:fs';
import { MatchingCode } from '../src/client/majorana/engine.js';
import { fuseThreads, useLattice } from '../src/client/majorana/braid.js';

const seeds = Number(process.argv[2] ?? 12);
let failures = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${extra}`); if (!ok) { failures++; process.exitCode = 1; } };

const lat = JSON.parse(readFileSync(new URL('../src/client/majorana/star.json', import.meta.url), 'utf8'));
let t0 = performance.now();
useLattice(lat);
console.log(`star lattice: ${lat.positions.length} qubits, ${lat.edges.length} links, ${lat.faces.length} plaquettes; vacuum built in ${(performance.now() - t0).toFixed(0)} ms`);

for (const linked of [false, true]) {
  const want = linked ? -1 : 1;
  let good = 0;
  let minus = 0;
  let total = 0;
  let replayOk = true;
  t0 = performance.now();
  for (let s = 0; s < seeds; s++) {
    const r = fuseThreads(linked, 1000 + s);
    if (r.outcomes[0] === want && r.outcomes[1] === want && r.fermion === linked) good++;
    const steps = r.log.log.filter((x) => x.action === 'measure_link');
    total += steps.length;
    minus += steps.filter((x) => x.outcome === -1).length;
    // replay from the record (fresh constructor, forced outcomes) must reproduce every step,
    // including both fusions (deterministic outcomes are never forced, so a wrong state would show)
    if (s < 3) {
      const c = MatchingCode.replay(lat, r.log);
      if (JSON.stringify(c.log) !== JSON.stringify(r.log.log)) replayOk = false;
    }
  }
  const ms = (performance.now() - t0) / seeds;
  const name = linked ? 'linked  ' : 'unlinked';
  check(`${name}: ${linked ? 'both fermions' : 'both vacuum'} ${good}/${seeds}`, good === seeds, `(${ms.toFixed(1)} ms per run)`);
  check(`${name}: individual link outcomes are random`, minus > 0 && minus < total, `(${minus}/${total} were -1)`);
  check(`${name}: runs replay exactly from their logs`, replayOk);
}

const a = fuseThreads(true, 7);
const b = fuseThreads(true, 7);
check('same seed gives the same run', JSON.stringify(a.log) === JSON.stringify(b.log));

if (failures) console.log(`\n${failures} check(s) failed`);
else console.log('\nall Majorana checks passed');
