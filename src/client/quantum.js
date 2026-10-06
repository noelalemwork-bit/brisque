// Quantum mode chosen in the menu. Every mode returns the same `sample(probs, label)` the engine uses,
// plus `chooseFirst(n)`, the quantum coin toss that picks who opens the game.

import { createBackend, mothClient, MOTH_API } from '../shared/quantum/backend.js';
import { Circuit } from '../shared/quantum/circuit.js';
import { createSampler, pickIndex } from '../shared/quantum/sampler.js';
import { createQrngPool } from '../shared/quantum/qrng.js';
import { makeRng } from '../shared/rng.js';
import { simulate, probabilities } from '../shared/quantum/statevector.js';

/* global __MOTH_DEV_PROXY__ */
const DEV_PROXY = import.meta.env.DEV && typeof __MOTH_DEV_PROXY__ !== 'undefined' && __MOTH_DEV_PROXY__;
// Brisque Worker (worker/) that proxies Moth: set at build time for builds hosted elsewhere (itch), otherwise the page's
// own origin, since the Worker serves the game too. On a plain static host the proxy is missing and live modes fall back.
export const BRISQUE_API = (import.meta.env.VITE_BRISQUE_API || (import.meta.env.DEV ? '' : location.origin)).replace(/\/$/, '');

// Every collapse and every background Moth job in this browser is broadcast here for the circuit panel.
// Collapse events come from createSampler (start / phase / end); background jobs add
//   { kind: 'job', id, engine, mode, phase: submitting|queued|processing|fetching|done|failed, ms, jobId?, detail? }
//   { kind: 'coin', first, players, source, ms }
const traceListeners = new Set();
export const quantumTrace = {
  on(fn) { traceListeners.add(fn); return () => traceListeners.delete(fn); },
  emit(evt) { for (const fn of traceListeners) fn(evt); },
};
const trace = (evt) => quantumTrace.emit(evt);

export const QUANTUM_MODES = [
  {
    id: 'moth-stream',
    label: 'Moth · live IBM QPU',
    detail: 'At the start of the game Brisque asks an IBM quantum computer for fresh certified random bits (Moth comet-qrng) and decides every collapse with them. Until they land it uses QPU bits fetched earlier, so play never waits. The fetch can take 1 to 5 minutes or fail when Moth is busy.',
    live: true,
  },
  {
    id: 'moth-qpu-pool',
    label: 'Moth · IBM QPU pool',
    detail: 'Collapses are decided by certified hardware randomness from an IBM quantum computer (Moth comet-qrng), fetched ahead of time and shipped with the game. Instant, offline.',
  },
  {
    id: 'moth-live',
    label: 'Moth · live circuits',
    detail: 'Every collapse sends its circuit to Moth (tomography-api-v2) and waits for it. Slow and unreliable for real-time play: jobs queue for 5 s to several minutes, and on 5 Oct the engine timed out on every job. If Moth fails, the QPU pool decides instead. A showcase mode, not a way to play.',
    live: true,
  },
  {
    id: 'quantum-forge',
    label: 'Quantum Forge',
    detail: 'Every collapse runs its circuit on the Quantum Forge simulator (WebAssembly, in your browser). Instant, offline.',
  },
];
// 'emulator' (our exact, seedable statevector) is not offered in the menu: Quantum Forge covers in-browser
// simulation. It remains the silent fallback, the attract-mode backdrop's backend and the tests' backend.

export async function createQuantum(modeId, { seed = Date.now(), apiKey = '', onLog = () => {} } = {}) {
  const rng = makeRng(`quantum:${seed}`);
  const emulator = createBackend('local', { seed });
  const base = { rng, onLog };

  if (modeId === 'moth-qpu-pool' || modeId === 'moth-stream' || modeId === 'moth-live') {
    const [bundled, moth] = await Promise.all([
      loadBundledPool(rng).catch((err) => { onLog(`QPU randomness pool unavailable (${err.message})`); return null; }),
      modeId === 'moth-qpu-pool' ? null : connectMoth(apiKey, onLog),
    ]);

    if (modeId === 'moth-stream' && moth) {
      const pool = createLivePool({ moth, bridge: bundled, onLog });
      pool.refill();
      return finish({ ...base, mode: modeId, moth, pool, sample: createSampler({ pool, backend: emulator, rand: rng.next, log: onLog, trace }), info: 'live comet-qrng stream', dispose: pool.dispose });
    }
    if (modeId === 'moth-live' && moth) {
      // a failed circuit falls back to QPU pool entropy, not to pseudo-randomness
      const fallback = bundled ? { name: bundled.label, async run(circuit) { return emulatorDraw(circuit, bundled.next() ?? rng.next()); } } : null;
      const backend = withFallback(createBackend('moth', { ...moth.opts, timeoutMs: 180000 }), fallback, onLog);
      return finish({ ...base, mode: modeId, moth, bundled, sample: createSampler({ backend, rand: rng.next, timeoutMs: 185000, log: onLog, trace }), info: 'live Moth circuits' });
    }
    if (bundled) {
      if (modeId !== 'moth-qpu-pool') onLog('Moth API unreachable; collapses use the bundled IBM QPU pool');
      return finish({ ...base, mode: 'moth-qpu-pool', bundled, sample: createSampler({ pool: bundled, backend: emulator, rand: rng.next, log: onLog, trace }), info: `${bundled.remaining} hardware draws available` });
    }
    return createQuantum('emulator', { seed, onLog });
  }

  if (modeId === 'quantum-forge') {
    try {
      const forge = await loadForge();
      return finish({ ...base, mode: modeId, forge, sample: createSampler({ backend: forge, rand: rng.next, log: onLog, trace }), info: 'Quantum Forge WebAssembly simulator' });
    } catch (err) {
      onLog(`Quantum Forge failed to load (${err.message}); using the emulator`);
      return createQuantum('emulator', { seed, onLog });
    }
  }

  return finish({ ...base, mode: 'emulator', sample: createSampler({ backend: emulator, rand: rng.next, log: onLog, trace }), info: 'in-browser statevector' });
}

// Attaches the coin toss. Moth modes toss coin-toss-v1 (one shot per bit, in parallel; ~5 s on emu),
// Quantum Forge measures |+>, everything else falls back to pool entropy or the seeded rng.
function finish(q) {
  q.dispose ??= () => {};
  q.chooseFirst = async (n, { timeoutMs = 12000 } = {}) => {
    const t0 = performance.now();
    const bits = Math.max(1, Math.ceil(Math.log2(n)));
    const done = (first, source) => { const res = { first, source, ms: performance.now() - t0 }; trace({ kind: 'coin', players: n, ...res }); return res; };
    if (q.moth) {
      try {
        const tosses = await Promise.race([
          Promise.all(Array.from({ length: bits }, (_, i) => tossMoth(q.moth, `coin-${i + 1}`))),
          new Promise((_, rej) => setTimeout(() => rej(new Error('coin toss timed out')), timeoutMs)),
        ]);
        const v = tosses.reduce((acc, b, i) => acc | (b << i), 0);
        if (v < n) return done(v, 'moth coin-toss-v1');
        q.onLog('coin toss landed out of range; pool entropy picks the opener'); // 3, 5 or 6 players: reject
      } catch (err) {
        q.onLog(`Moth coin toss failed (${err.message}); tossing locally`);
      }
    }
    if (q.forge) return done(await q.forge.toss(n), 'quantum-forge');
    const u = q.pool?.next?.() ?? q.bundled?.next?.() ?? q.rng.next();
    return done(Math.min(n - 1, Math.floor(u * n)), q.pool?.label ?? q.bundled?.label ?? 'local');
  };
  // CPU temperaments: one qubit per CPU of a random entangled state (Moth graph-v1 in Moth modes, our
  // simulator otherwise). Returns { seat: { aggression, superposition, expansion, rivals } } for botAction.
  q.temperaments = async (cpuSeats, { timeoutMs = 15000 } = {}) => {
    if (!cpuSeats.length) return {};
    const n = Math.max(2, cpuSeats.length);
    let tomo = null;
    let source = 'emulator';
    if (q.moth) {
      const ev = (phase, info = {}) => trace({ kind: 'job', id: 'graph', engine: 'graph-v1', mode: 'emu', phase, ...info });
      try {
        const res = await Promise.race([
          q.moth.client.job('graph-v1', { mode: 'emu', num_qubits: n, shots: 256, seed: Math.floor(q.rng.next() * 1e9) }, { onPhase: ev, timeoutMs }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timed out')), timeoutMs)),
        ]);
        tomo = res.result?.output?.tomography;
        source = 'moth graph-v1';
        ev('done', { ms: res.ms, jobId: res.jobId, detail: `${n}-qubit entangled state → CPU temperaments` });
      } catch (err) {
        ev('failed', { detail: err.message });
        q.onLog(`Moth graph-v1 unavailable (${err.message}); temperaments from the emulator`);
      }
    }
    tomo ??= randomStateTomography(n, q.rng);
    const out = {};
    cpuSeats.forEach((seat, i) => {
      const b = tomo.bloch[i] ?? tomo.bloch[String(i)] ?? {};
      const rivals = {};
      cpuSeats.forEach((other, j) => {
        if (j === i) return;
        const rel = tomo.relationships?.[`${Math.min(i, j)},${Math.max(i, j)}`];
        if (rel) rivals[other] = rel.ZZ ?? 0;
      });
      out[seat] = { aggression: b.Z ?? 0, superposition: b.X ?? 0, expansion: b.Y ?? 0, rivals, source };
    });
    trace({ kind: 'temperaments', source, traits: out });
    return out;
  };
  return q;
}

// Bloch vectors and ZZ correlations of a random entangled state (RY/RZ layer, CX chain, RY layer).
function randomStateTomography(n, rng) {
  const c = new Circuit(n);
  for (let i = 0; i < n; i++) c.ry(rng.next() * Math.PI, i).rz(rng.next() * 2 * Math.PI, i);
  for (let i = 0; i + 1 < n; i++) c.cx(i, i + 1);
  for (let i = 0; i < n; i++) c.ry((rng.next() - 0.5) * Math.PI, i);
  const { re, im } = simulate(c);
  const bloch = {};
  const relationships = {};
  for (let q = 0; q < n; q++) {
    let X = 0;
    let Y = 0;
    let Z = 0;
    for (let k = 0; k < re.length; k++) {
      if (k & (1 << q)) continue;
      const k1 = k | (1 << q);
      X += 2 * (re[k] * re[k1] + im[k] * im[k1]);
      Y += 2 * (re[k] * im[k1] - im[k] * re[k1]);
      Z += re[k] ** 2 + im[k] ** 2 - re[k1] ** 2 - im[k1] ** 2;
    }
    bloch[q] = { X, Y, Z };
  }
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    let ZZ = 0;
    for (let k = 0; k < re.length; k++) ZZ += (((k >> a) ^ (k >> b)) & 1 ? -1 : 1) * (re[k] ** 2 + im[k] ** 2);
    relationships[`${a},${b}`] = { ZZ };
  }
  return { bloch, relationships };
}

async function tossMoth(moth, id) {
  const ev = (phase, info = {}) => trace({ kind: 'job', id, engine: 'coin-toss-v1', mode: 'emu', phase, ...info });
  try {
    const { result, ms, jobId } = await moth.client.job('coin-toss-v1', { mode: 'emu', shots: 1 }, { onPhase: ev, timeoutMs: 60000 });
    ev('done', { ms, jobId, detail: result.output });
    return result.heads > 0 ? 1 : 0;
  } catch (err) {
    ev('failed', { detail: err.message });
    throw err;
  }
}

// --- Moth connection --------------------------------------------------------------------------------

// preference: dev proxy > Brisque Worker (budgeted, key stays server-side) > direct with the player's own key
async function connectMoth(apiKey, onLog) {
  let baseUrl = MOTH_API;
  let key = apiKey;
  let extraHeaders = {};
  if (DEV_PROXY) { baseUrl = './moth'; key = ''; }
  else if (BRISQUE_API) {
    try {
      const { code } = await (await fetch(`${BRISQUE_API}/api/rooms`, { method: 'POST' })).json();
      const { token } = await (await fetch(`${BRISQUE_API}/api/rooms/${code}/solo`, { method: 'POST' })).json();
      baseUrl = `${BRISQUE_API}/api/rooms/${code}/moth`;
      key = '';
      extraHeaders = { 'x-brisque-token': token };
    } catch (err) { onLog(`Brisque server unreachable (${err.message})`); }
  }
  const opts = { baseUrl, apiKey: key, extraHeaders };
  const client = mothClient(opts);
  const ok = await client.call('/me').then(() => true, () => false);
  if (!ok) {
    onLog(DEV_PROXY || BRISQUE_API ? 'Moth API unreachable' : 'Moth API blocked from this page (CORS) or key invalid');
    return null;
  }
  return { opts, client };
}

async function loadBundledPool(rng) {
  const file = await (await fetch('./generated/qrng-qpu.json')).json();
  const offset = Math.floor(rng.next() * (file.hex.length / 8)); // different games start at different points
  return createQrngPool({ label: `moth-qrng (${file.batches?.[0]?.backend ?? 'qpu'})`, hex: file.hex, offset });
}

// Fresh certified QPU randomness streamed during the match. Draws come from live bytes once a comet
// job lands, from the bundled pool (`bridge`) until then. Refills when the live buffer runs low.
const COMET_QPU = { mode: 'qpu', num_qubits: 100, shots: 1000, output_bytes: 16384, bell_witness: true, include_raw_counts: false };
function createLivePool({ moth, bridge, onLog, lowWater = 150, maxJobs = 4 }) {
  const live = createQrngPool({ label: 'moth-qrng live', hex: '' });
  let liveLabel = 'moth-qrng live';
  let inFlight = false;
  let jobs = 0;
  let retryAt = 0; // after a failure, wait a minute before spending another credit
  let disposed = false;

  async function refill() {
    if (inFlight || disposed || jobs >= maxJobs || performance.now() < retryAt) return;
    inFlight = true;
    const id = `comet-${++jobs}`;
    const ev = (phase, info = {}) => trace({ kind: 'job', id, engine: 'comet-qrng-v1', mode: 'qpu', phase, ...info });
    try {
      const { result, ms, jobId } = await moth.client.job('comet-qrng-v1', COMET_QPU, { onPhase: ev, timeoutMs: 6 * 60 * 1000 });
      const out = result.output ?? result;
      const hex = out.random?.hex ?? '';
      if (!hex) throw new Error('comet returned no certified bytes');
      if (disposed) return;
      live.add(hex);
      const backend = out.provenance?.backend ?? out.provenance?.backend_name ?? 'qpu';
      liveLabel = `moth-qrng live (${backend})`;
      const S = out.bell_witness?.S;
      ev('done', { ms, jobId, detail: `${hex.length / 2} B from ${backend}${S ? `, Bell S = ${S.toFixed(2)}` : ''}` });
    } catch (err) {
      ev('failed', { detail: err.message });
      retryAt = performance.now() + 60000;
      onLog(`live QPU randomness unavailable (${err.message}); using the bundled QPU pool`);
    } finally {
      inFlight = false;
    }
  }

  return {
    get label() { return live.remaining > 0 ? liveLabel : bridge?.label ?? 'local'; },
    get remaining() { return live.remaining + (bridge?.remaining ?? 0); },
    next() {
      if (live.remaining < lowWater) refill();
      return live.remaining > 0 ? live.next() : bridge?.next() ?? null;
    },
    refill,
    dispose() { disposed = true; },
  };
}

// Runs `primary`; on failure (Moth engine down, budget exhausted) answers from `fallback` and says so.
function withFallback(primary, fallback, onLog) {
  if (!fallback) return primary;
  let failures = 0;
  return {
    name: primary.name,
    async run(circuit, opts) {
      if (failures < 2) {
        try {
          const res = await primary.run(circuit, opts);
          failures = 0;
          return res;
        } catch (err) {
          failures++;
          onLog(`Moth circuit failed (${err.message}); the QPU pool decides this collapse`);
          if (failures === 2) onLog('Moth circuits keep failing: switching to the QPU pool for this game');
        }
      }
      return { ...(await fallback.run(circuit)), fallback: fallback.name };
    },
  };
}

// Inverse CDF of the circuit's exact distribution at a supplied uniform (pool entropy).
function emulatorDraw(circuit, u) {
  const probs = probabilities(simulate(circuit));
  const m = circuit.numQubits;
  const index = pickIndex(probs, u);
  return { counts: { [index.toString(2).padStart(m, '0')]: 1 }, backend: 'pool', ms: 0 };
}

// --- Quantum Forge (quantum.dev) ---------------------------------------------------------------------

// Lazy-loaded WebAssembly simulator. Our circuits only use RY and CX: RY(θ) is Forge's y(θ/π), CX is a
// flip conditioned on the control reading 1. Free to use with visible attribution (see the credits).
let forgePromise = null;
function loadForge() {
  forgePromise ??= (async () => {
    const qf = await import('quantum-forge/quantum');
    qf.useQuantumForgeBuild('qubit');
    qf.setWasmBasePath(new URL('./quantum-forge-qubit', document.baseURI).href);
    await qf.ensureLoaded();
    return {
      name: 'quantum-forge',
      async run(circuit) {
        const t0 = performance.now();
        const qs = Array.from({ length: circuit.numQubits }, () => qf.quantum([0, 1]));
        try {
          for (const { gate, qubits, params } of circuit.ops) {
            if (gate === 'ry') qs[qubits[0]].y(params[0] / Math.PI);
            else if (gate === 'cx') qs[qubits[1]].flip({ when: [qs[qubits[0]].is(1)] });
            else throw new Error(`gate ${gate} not mapped to Quantum Forge`);
          }
          const values = qf.measure(...qs);
          const bits = [...values].reverse().map((v) => (v ? '1' : '0')).join(''); // most significant qubit first
          return { counts: { [bits]: 1 }, backend: this.name, ms: performance.now() - t0 };
        } finally {
          qs.forEach((q) => q.dispose());
        }
      },
      async toss(n) {
        const bits = Math.max(1, Math.ceil(Math.log2(n)));
        for (;;) {
          const qs = Array.from({ length: bits }, () => qf.quantum([0, 1]));
          qs.forEach((q) => q.hadamard());
          const v = qf.measure(...qs).reduce((acc, b, i) => acc | ((b ? 1 : 0) << i), 0);
          qs.forEach((q) => q.dispose());
          if (v < n) return v;
        }
      },
    };
  })();
  forgePromise.catch(() => { forgePromise = null; });
  return forgePromise;
}
