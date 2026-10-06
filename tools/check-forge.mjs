// Quantum Forge mode runs our collapse circuits with the right bit order: sampled frequencies match targets.
//   node tools/check-forge.mjs
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as qf from 'quantum-forge/quantum';
import { encodeDistribution } from '../src/shared/quantum/sampler.js';

qf.useQuantumForgeBuild('qubit');
qf.setWasmBasePath(pathToFileURL(path.resolve('node_modules/quantum-forge/dist/quantum-forge-qubit')).href);
await qf.ensureLoaded();

function run(circuit) {
  const qs = Array.from({ length: circuit.numQubits }, () => qf.quantum([0, 1]));
  for (const { gate, qubits, params } of circuit.ops) {
    if (gate === 'ry') qs[qubits[0]].y(params[0] / Math.PI);
    else qs[qubits[1]].flip({ when: [qs[qubits[0]].is(1)] });
  }
  const bits = [...qf.measure(...qs)].reverse().map((v) => (v ? '1' : '0')).join('');
  qs.forEach((q) => q.dispose());
  return bits;
}

let ok = true;
for (const target of [[0.7, 0.3], [0.5, 0.3, 0.2], [0.1, 0, 0.6, 0.3], [0.05, 0.15, 0.2, 0.1, 0.5]]) {
  const { circuit, decode } = encodeDistribution(target);
  const N = 4000;
  const hist = Array(target.length).fill(0);
  for (let i = 0; i < N; i++) hist[decode(run(circuit))]++;
  const err = Math.max(...hist.map((h, i) => Math.abs(h / N - target[i])));
  const pass = err < 0.03 && hist.every((h, i) => target[i] > 0 || h === 0);
  ok &&= pass;
  console.log(`${pass ? 'ok  ' : 'FAIL'} target ${target.join('/')} got ${hist.map((h) => (h / N).toFixed(3)).join('/')}`);
}
process.exit(ok ? 0 : 1);
