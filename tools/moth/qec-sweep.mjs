// How long does an error-corrected qubit survive? Runs Moth's tamagotchi-v1 (Qiskit QEC, 0 credits) on the
// 7-qubit Steane code: |1>_L prepared, then N syndrome-extraction rounds under depolarizing noise.
// Output feeds the "decoherence" demo on the physics page.   node tools/moth/qec-sweep.mjs
import fs from 'node:fs';
import { loadEnv } from '../../src/server/env.js';
import { mothClient } from '../../src/shared/quantum/backend.js';

loadEnv();
const moth = mothClient();
const out = 'public/generated/tamagotchi-v1/qec.json';
const noises = { low: 0.002, high: 0.01 };
const rounds = [1, 2, 4, 8];
const runs = [];
for (const [level, p] of Object.entries(noises)) {
  for (const n of rounds) {
    const params = {
      code: 'steane', method: 'stabilizer', n_logical: 1, shots: 2000, seed: 7,
      actions: [['X', 0], ...Array.from({ length: n }, () => ['SE', 0])],
      noise: { p_gate: p, p_1q: p / 2, p_meas: p, p_idle: p / 5 },
    };
    runs.push(moth.job('tamagotchi-v1', params, { timeoutMs: 10 * 60 * 1000 })
      .then(({ result, jobId, ms }) => ({ level, p, rounds: n, params, job_id: jobId, ms: Math.round(ms), result }))
      .catch((err) => ({ level, p, rounds: n, params, error: err.message })));
  }
}
const results = await Promise.all(runs);
fs.mkdirSync('public/generated/tamagotchi-v1', { recursive: true });
fs.writeFileSync(out, JSON.stringify({ engine: 'tamagotchi-v1', date: new Date().toISOString(), runs: results }, null, 1));
for (const r of results) console.log(r.level, r.rounds, r.error ?? JSON.stringify(r.result).slice(0, 220));
