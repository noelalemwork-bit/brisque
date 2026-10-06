// One interface, swappable backends. Game code only ever calls `backend.run(circuit, { shots })`
// and gets `{ counts, backend, ms }` back, so switching local -> Moth is a config change.
//
// Runs in Node (dev server) and in the browser (local play). In the browser the Moth base URL is either
// the Vite dev proxy (`/moth`, which injects the key server-side) or api.mothquantum.com with a key the
// player supplies; Moth's CORS allowlist currently blocks the latter from any origin but its own.

import { Circuit } from './circuit.js';
import { sample } from './statevector.js';
import { makeRng } from '../rng.js';

export function createBackend(kind = 'local', opts = {}) {
  switch (kind) {
    case 'local': return localBackend(opts);
    case 'moth': return mothBackend(opts);
    default: throw new Error(`unknown quantum backend "${kind}"`);
  }
}

function localBackend({ seed = Date.now() } = {}) {
  const rng = makeRng(seed);
  return {
    name: 'local-statevector',
    async run(circuit, { shots = 1 } = {}) {
      const c = circuit instanceof Circuit ? circuit : Circuit.fromJSON(circuit);
      const t0 = performance.now();
      const counts = sample(c, shots, rng.next);
      return { counts, backend: this.name, ms: performance.now() - t0 };
    },
  };
}

// Moth Atlas API (docs.mothquantum.com). No engine returns raw samples of an arbitrary circuit, but
// tomography-api-v2 takes OpenQASM 2 and reports per-basis `measurements`; any basis key made only
// of I/Z (e.g. "ZZ", "IZZ") is a computational-basis sample, little-endian like our simulator.
// Jobs are async (submit -> poll -> result): 5 s to 3 min end to end, dominated by Moth's queue; 1 credit per run,
// 300 requests/min per key shared by every room. Callers must budget for that; see sampler.js.
export const MOTH_API = 'https://api.mothquantum.com/api/v1';
const env = (k) => globalThis.process?.env?.[k];

// One Moth job: submit -> poll -> result, reporting phases (submitting, queued, processing, fetching).
// Moth has no webhooks. Poll fast at first (emulator jobs finish in a few seconds), then back off to
// stay well under the 300 req/min key limit shared by every room.
export function mothClient({ apiKey = env('MOTH_API_KEY'), baseUrl = env('MOTH_API_URL') ?? MOTH_API, extraHeaders = {} } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), ...extraHeaders };
  const call = async (path, init) => {
    const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`moth ${res.status} ${path}: ${body.detail ?? body.title ?? body.error ?? 'error'}`);
    return body;
  };
  // inputFiles: { slot: assetId } for engines that read files (e.g. a trained model's state)
  async function job(engine, params, { onPhase = () => {}, timeoutMs = 180000, inputFiles = null } = {}) {
    const t0 = performance.now();
    const timings = {};
    const mark = (phase, info = {}) => { timings[phase] = performance.now() - t0; onPhase(phase, { ...info, ms: timings[phase] }); };
    mark('submitting');
    const { job_id: jobId } = await call(`/engines/${engine}/process`, { method: 'POST', body: JSON.stringify(inputFiles ? { params, input_files: inputFiles } : { params }) });
    mark('queued', { jobId });
    let delay = 400;
    let last = 'queued';
    let st;
    for (;;) {
      if (performance.now() - t0 > timeoutMs) throw new Error(`moth job ${jobId} timed out`);
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(2500, delay * 1.35);
      st = await call(`/jobs/${jobId}/status`);
      if (st.status === 'completed') break;
      if (st.status === 'failed' || st.status === 'cancelled') throw new Error(`${engine} ${st.status}: ${st.error?.message?.split('\n')[0] ?? ''}`);
      const phase = st.status === 'queued' ? 'queued' : 'processing'; // transient worker states count as processing
      if (phase !== last) { last = phase; mark(phase, { jobId }); }
    }
    mark('fetching', { jobId });
    const { result, outputs } = await call(`/jobs/${jobId}/result`); // file engines answer with presigned `outputs`
    timings.done = performance.now() - t0;
    // some engines (qrc-gen-v2) put their answer only in the final status's `result`
    return { result, outputs, status: st, jobId, ms: timings.done, timings };
  }
  return { call, job };
}

function mothBackend({ timeoutMs = 30000, ...opts } = {}) {
  const moth = mothClient(opts);
  return {
    name: 'moth-tomography',
    // onPhase(phase, info) reports the job lifecycle for the HUD's circuit panel
    async run(circuit, { shots = 1, onPhase } = {}) {
      const c = circuit instanceof Circuit ? circuit : Circuit.fromJSON(circuit);
      const { result, jobId, ms, timings } = await moth.job('tomography-api-v2', {
        circuit_qasm: c.toQASM(),
        shots,
        double_tomography: false,
        mutual_information: false,
        classical_mutual_information: false,
      }, { onPhase, timeoutMs });
      const zKey = Object.keys(result?.measurements ?? {}).find((k) => /^[IZ]+$/.test(k));
      if (!zKey) throw new Error('moth result has no computational-basis measurement');
      return { counts: result.measurements[zKey].counts, backend: this.name, ms, jobId, timings };
    },
  };
}
