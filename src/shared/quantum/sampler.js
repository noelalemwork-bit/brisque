// Turns "pick one outcome with these probabilities" into a real quantum measurement.
//
// encodeDistribution(p) builds a circuit on m = ceil(log2 K) qubits whose computational-basis
// amplitudes are sqrt(p[i]) (binary-tree state preparation with uniformly controlled RY rotations,
// Möttönen et al. 2004), so one shot returns index i with probability p[i]. For a two-army battle
// that is literally one RY(θ) on one qubit, with θ set by the troop ratio.
//
// createSampler() runs that circuit on a backend for one shot and falls back to a local seeded
// sampler when the backend is slow or failing, reporting which source decided the outcome.

import { Circuit } from './circuit.js';

export function encodeDistribution(probs) {
  const K = probs.length;
  const m = Math.max(1, Math.ceil(Math.log2(K)));
  const N = 1 << m;
  const total = probs.reduce((a, b) => a + b, 0);
  const p = Array.from({ length: N }, (_, i) => (i < K ? probs[i] / total : 0));
  const circuit = new Circuit(m);

  // qubit t holds bit t of the index; decide the most significant bit first
  for (let t = m - 1; t >= 0; t--) {
    const k = m - 1 - t; // number of controls: qubits t+1 .. m-1
    const alphas = [];
    for (let j = 0; j < 1 << k; j++) {
      const lo = j << (t + 1);
      const mid = lo + (1 << t);
      const hi = lo + (1 << (t + 1));
      let node = 0;
      let one = 0;
      for (let i = lo; i < hi; i++) node += p[i];
      for (let i = mid; i < hi; i++) one += p[i];
      alphas.push(node > 1e-15 ? 2 * Math.asin(Math.sqrt(Math.min(1, one / node))) : 0);
    }
    uniformlyControlledRY(circuit, t, Array.from({ length: k }, (_, i) => t + 1 + i), alphas);
  }
  return { circuit, decode: (bitstring) => parseInt(bitstring, 2) };
}

// Applies RY(alphas[j]) to `target` when the controls read j (control i = bit i of j),
// using 2^k RY + 2^k CNOT and Gray-code ordering.
function uniformlyControlledRY(circuit, target, controls, alphas) {
  const k = controls.length;
  if (k === 0) {
    if (Math.abs(alphas[0]) > 1e-12) circuit.ry(alphas[0], target);
    return;
  }
  const n = 1 << k;
  const gray = (i) => i ^ (i >> 1);
  const parity = (x) => { let c = 0; while (x) { c ^= x & 1; x >>= 1; } return c; };
  for (let i = 0; i < n; i++) {
    let theta = 0;
    for (let j = 0; j < n; j++) theta += (parity(j & gray(i)) ? -1 : 1) * alphas[j];
    circuit.ry(theta / n, target);
    const changed = gray(i) ^ gray((i + 1) % n);
    circuit.cx(controls[Math.log2(changed)], target);
  }
}

// Inverse CDF: map a uniform u in [0, 1) onto an outcome index.
export function pickIndex(probs, u) {
  const total = probs.reduce((a, b) => a + b, 0);
  let r = u * total;
  for (let i = 0; i < probs.length; i++) if (probs[i] > 0 && (r -= probs[i]) < 0) return i;
  return probs.findLastIndex((p) => p > 0);
}

// Precedence: `pool` (instant quantum uniforms, e.g. comet-qrng) > `backend` (runs the encoded
// circuit, seconds to minutes) > local seeded `rand`. Each result says which source decided it.
//
// `trace(event)` sees every collapse for the HUD's circuit panel:
//   { kind: 'start', id, label, probs, circuit, source }   circuit is Circuit JSON
//   { kind: 'phase', id, phase, ms, jobId? }                remote jobs only: submitting/queued/processing/fetching
//   { kind: 'end', id, index, source, ms, jobId?, timings?, error? }
export function createSampler({ backend = null, pool = null, rand, timeoutMs = 8000, log = () => {}, trace = () => {} } = {}) {
  const local = (probs) => pickIndex(probs, rand());
  let nextId = 1;

  return async function sample(probs, label = '') {
    const live = probs.map((p, i) => [p, i]).filter(([p]) => p > 1e-12);
    // certain outcomes never spend a backend call or pool entropy
    if (live.length === 1) return { index: live[0][1], source: 'certain', ms: 0 };

    const id = nextId++;
    const { circuit, decode } = encodeDistribution(probs);
    const finish = (res) => { trace({ kind: 'end', id, ...res }); return res; };
    const begin = (source) => trace({ kind: 'start', id, label, probs, circuit: circuit.toJSON(), source });

    if (pool) {
      const u = pool.next();
      if (u !== null) { begin(pool.label); return finish({ index: pickIndex(probs, u), source: pool.label, ms: 0, u }); }
      log(`quantum pool "${pool.label}" exhausted, falling back`);
    }
    if (!backend) { begin('local'); return finish({ index: local(probs), source: 'local', ms: 0 }); }

    begin(backend.name);
    const t0 = performance.now();
    let timer;
    try {
      const res = await Promise.race([
        backend.run(circuit, { shots: 1, onPhase: (phase, info) => trace({ kind: 'phase', id, phase, ...info }) }),
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), timeoutMs); }),
      ]);
      const index = decode(Object.keys(res.counts)[0]);
      if (!(index < probs.length) || probs[index] <= 0) throw new Error(`impossible outcome ${index}`);
      return finish({ index, source: res.fallback ?? backend.name, ms: performance.now() - t0, jobId: res.jobId, timings: res.timings, qasm: circuit.toQASM() });
    } catch (err) {
      log(`quantum sample "${label}" fell back to local: ${err.message}`);
      return finish({ index: local(probs), source: 'local-fallback', ms: performance.now() - t0, error: err.message });
    } finally {
      clearTimeout(timer);
    }
  };
}
