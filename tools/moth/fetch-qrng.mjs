// Fetch certified QPU randomness from comet-qrng-v1 into public/generated/qrng-qpu.json, which the
// static build ships so collapses can draw real hardware randomness with zero latency and no key.
//   node tools/moth/fetch-qrng.mjs [qpu|emu] [jobs]
// Wide registers + few shots: comet reads counts (order lost), so the extractor pays ~log2(shots!)
// bits; 12 qubits x 4096 shots yields nothing, ~100 qubits x 1000 shots yields kilobytes.
import fs from 'node:fs';
import { loadEnv } from '../../src/server/env.js';
import { MOTH_API } from '../../src/shared/quantum/backend.js';
loadEnv();
const mode = process.argv[2] ?? 'qpu';
const jobs = Number(process.argv[3] ?? 1);
const H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}`, 'Content-Type': 'application/json' };
const call = async (path, init) => {
  const r = await fetch(MOTH_API + path, { ...init, headers: H });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(body).slice(0, 400)}`);
  return body;
};
const out = `public/generated/qrng-${mode}.json`;
const pool = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : { engine: 'comet-qrng-v1', mode, hex: '', batches: [] };
const params = mode === 'qpu'
  ? { mode, num_qubits: 100, shots: 1000, output_bytes: 16384, bell_witness: true, include_raw_counts: false }
  : { mode, num_qubits: 20, shots: 1000, output_bytes: 4096, bell_witness: false, include_raw_counts: false };
for (let j = 0; j < jobs; j++) {
  const t0 = Date.now();
  const job = await call('/engines/comet-qrng-v1/process', { method: 'POST', body: JSON.stringify({ params }) });
  let st;
  do { await new Promise((r) => setTimeout(r, 4000)); st = await call(`/jobs/${job.job_id}/status`); }
  while (!['completed', 'failed', 'cancelled'].includes(st.status));
  if (st.status !== 'completed') { console.error('job', st.status, JSON.stringify(st.error)); continue; }
  const o = (await call(`/jobs/${job.job_id}/result`)).result.output;
  const batch = {
    job_id: job.job_id, bytes: o.random.bytes, seconds: (Date.now() - t0) / 1000, backend: o.provenance.backend,
    qpu_seconds: o.provenance.qpu_seconds, grade: o.entropy_report.grade, h_bit: o.entropy.h_bit,
    bell_S: o.bell_witness?.S ?? null, commit: o.commitment?.commit, output_hash: o.pulse?.output_hash,
  };
  console.log(JSON.stringify(batch));
  pool.hex += o.random.hex;
  pool.batches.push(batch);
  pool.updated = new Date().toISOString();
  fs.mkdirSync('public/generated', { recursive: true });
  fs.writeFileSync(out, JSON.stringify(pool));
}
console.log(`${out}: ${pool.hex.length / 2} bytes = ${Math.floor(pool.hex.length / 8)} collapses`);
