// Minimal Node client for the Moth Atlas API (docs mirrored in docs/moth-api/).
//   submit(engine, params, inputFiles?) -> job_id        POST /engines/{id}/process
//   wait(job_id)                                         poll /jobs/{id}/status with backoff
//   result(job_id)                                       GET  /jobs/{id}/result  ({ outputs, result })
//   upload(bufferOrPath, filename, contentType) -> asset_id   POST /assets, PUT presigned, /complete
//   download(url | asset_id) -> Buffer                   presigned URL (no auth) or /assets/{id}/download
//   run(engine, params, { files }) -> { job_id, ms, outputs:[{slot, buffer, filename, content_type}], result }
// The key is read from Noel/.env via loadEnv() and only ever sent to api.mothquantum.com.
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from '../../src/server/env.js';

loadEnv();
export const API = 'https://api.mothquantum.com/api/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function auth() {
  const key = process.env.MOTH_API_KEY;
  if (!key) throw new Error('MOTH_API_KEY missing (Noel/.env)');
  return { Authorization: `Bearer ${key}` };
}

async function call(p, init = {}, tries = 5) {
  for (let i = 0; ; i++) {
    const r = await fetch(API + p, { ...init, headers: { ...auth(), ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
    if ((r.status === 429 || r.status === 503) && i < tries) { await sleep(2000 * 2 ** i); continue; }
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${p} -> ${r.status} ${JSON.stringify(body).slice(0, 600)}`);
    return body;
  }
}

export async function submit(engine, params, inputFiles) {
  const body = { params };
  if (inputFiles) body.input_files = inputFiles;
  const job = await call(`/engines/${engine}/process`, { method: 'POST', body: JSON.stringify(body) });
  return job.job_id;
}

export async function wait(jobId, { log = () => {}, timeoutMs = 15 * 60e3 } = {}) {
  const t0 = Date.now();
  let delay = 2500;
  let last = '';
  for (;;) {
    const st = await call(`/jobs/${jobId}/status`);
    if (st.status !== last) { log(`${jobId.slice(0, 8)} ${st.status}`); last = st.status; }
    if (['completed', 'failed', 'cancelled'].includes(st.status)) return st;
    if (Date.now() - t0 > timeoutMs) throw new Error(`job ${jobId} timed out (${st.status})`);
    await sleep(delay);
    delay = Math.min(8000, delay * 1.3); // 2–5 s recommended; back off gently for long queues
  }
}

export const result = (jobId) => call(`/jobs/${jobId}/result`);

export async function upload(data, filename, contentType) {
  const buf = typeof data === 'string' ? fs.readFileSync(data) : data;
  filename ??= typeof data === 'string' ? path.basename(data) : 'input.png';
  const asset = await call('/assets', { method: 'POST', body: JSON.stringify({ filename, content_type: contentType, size_bytes: buf.byteLength }) });
  const put = await fetch(asset.upload.url, { method: asset.upload.method ?? 'PUT', headers: { 'Content-Type': contentType, ...(asset.upload.headers ?? {}) }, body: buf });
  if (!put.ok) throw new Error(`upload PUT ${put.status} ${(await put.text()).slice(0, 300)}`);
  await call(`/assets/${asset.asset_id}/complete`, { method: 'POST' });
  return asset.asset_id;
}

export async function download(urlOrAsset) {
  let url = urlOrAsset;
  if (!/^https?:/.test(url)) url = (await call(`/assets/${urlOrAsset}/download`)).download_url;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// Full round trip. `files` maps slot -> { data: Buffer|path, filename, contentType } (uploaded first).
export async function run(engine, params, { files, log = console.log, resume, onSubmit = () => {} } = {}) {
  const t0 = resume?.t0 ?? Date.now();
  let inputFiles = resume?.input_assets;
  if (files && !resume) {
    inputFiles = {};
    for (const [slot, f] of Object.entries(files)) inputFiles[slot] = await upload(f.data, f.filename, f.contentType ?? 'image/png');
  }
  const jobId = resume?.job_id ?? await submit(engine, params, inputFiles);
  log(`${engine}: ${resume ? 'resumed' : 'submitted'} ${jobId}`);
  if (!resume) onSubmit({ job_id: jobId, t0, input_assets: inputFiles });
  const st = await wait(jobId, { log: (m) => log(`${engine}: ${m}`) });
  if (st.status !== 'completed') throw new Error(`${engine} ${jobId} ${st.status}: ${JSON.stringify(st.error)}`);
  const res = await result(jobId);
  const outputs = [];
  for (const o of res.outputs ?? []) {
    let buffer;
    try { buffer = await download(o.url); } catch { buffer = await download(o.output_asset_id); }
    outputs.push({ slot: o.slot, filename: o.filename, content_type: o.content_type, buffer });
  }
  return { job_id: jobId, ms: Date.now() - t0, outputs, result: res.result, input_assets: inputFiles };
}
