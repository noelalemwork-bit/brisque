// Latency + behaviour benchmark across Moth engines, emu vs IBM QPU. Spends credits: run deliberately.
//   node tools/moth/bench.mjs > tools/moth/bench-<date>.json
import { loadEnv } from '../../src/server/env.js';
loadEnv();
const API = 'https://api.mothquantum.com/api/v1';
const H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}`, 'Content-Type': 'application/json' };
const call = async (path, init) => {
  const r = await fetch(API + path, { ...init, headers: H });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(body).slice(0, 300)}`);
  return body;
};

// our 3-outcome battle (stay 50%, P0 wins 44%, P1 wins 6%) as a 2-qubit distribution
const p = [0.5, 8 / 18, 1 / 18, 0];
const Z0 = p[0] - p[1] + p[2] - p[3];
const Z1 = p[0] + p[1] - p[2] - p[3];
const ZZ = p[0] - p[1] - p[2] + p[3];
const QASM = 'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[2];\ncreg c[2];\nry(0.47588224966041653) q[1];\nry(0.7559694104239078) q[0];\ncx q[1],q[0];\nry(0.7559694104239078) q[0];\ncx q[1],q[0];\nmeasure q -> c;';

const jobs = [
  ['tomography emu 1 shot', 'tomography-api-v2', { circuit_qasm: QASM, shots: 1, double_tomography: false, mutual_information: false, classical_mutual_information: false }],
  ['tomography emu 4096', 'tomography-api-v2', { circuit_qasm: QASM, shots: 4096, double_tomography: false, mutual_information: false, classical_mutual_information: false }],
  ['coin-toss emu', 'coin-toss-v1', { mode: 'emu', shots: 1 }],
  ['coin-toss qpu', 'coin-toss-v1', { mode: 'qpu', shots: 16 }],
  ['comet-qrng emu', 'comet-qrng-v1', { mode: 'emu', num_qubits: 12, shots: 1024, output_bytes: 64, bell_witness: false }],
  ['comet-qrng qpu', 'comet-qrng-v1', { mode: 'qpu', num_qubits: 12, shots: 4096, output_bytes: 256, bell_witness: true }],
  ['graph battle emu', 'graph-v1', { mode: 'emu', num_qubits: 2, coupling_map: [[0, 1]], shots: 4096, operations: [
    { type: 'bloch', qubit: 0, paulis: { Z: Z0 } }, { type: 'bloch', qubit: 1, paulis: { Z: Z1 } }, { type: 'relationship', qubits: [0, 1], paulis: { ZZ } }] }],
];

const t0 = Date.now();
const runs = await Promise.all(jobs.map(async ([label, engine, params]) => {
  const start = Date.now();
  try {
    const job = await call(`/engines/${engine}/process`, { method: 'POST', body: JSON.stringify({ params }) });
    const seen = [];
    for (;;) {
      await new Promise((r) => setTimeout(r, 3000));
      const st = await call(`/jobs/${job.job_id}/status`);
      if (seen.at(-1)?.status !== st.status) seen.push({ status: st.status, at: Date.now() - start });
      if (['completed', 'failed', 'cancelled'].includes(st.status)) {
        const result = st.status === 'completed' ? (await call(`/jobs/${job.job_id}/result`)).result : st.error;
        return { label, engine, ms: Date.now() - start, status: st.status, timeline: seen, result };
      }
      if (Date.now() - t0 > 25 * 60 * 1000) return { label, engine, ms: Date.now() - start, status: 'gave-up (still ' + st.status + ')', timeline: seen };
    }
  } catch (err) {
    return { label, engine, ms: Date.now() - start, status: 'error', error: err.message };
  }
}));
console.log(JSON.stringify({ at: new Date().toISOString(), target: { p, Z0, Z1, ZZ }, runs }, null, 1));
