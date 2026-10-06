// A pool of quantum random numbers from Moth's comet-qrng-v1 engine (Born-rule bits from an IBM QPU,
// min-entropy estimated and Toeplitz-extracted, with a certificate). Drawing from the pool is instant,
// so collapses stay realtime even though a QPU job takes minutes. Each draw uses 32 bits -> [0, 1).
//
// Sources: a bundled file (public/generated/qrng-*.json, fetched offline by tools/moth/fetch-qrng.mjs,
// works on static hosting) and optional live top-ups through a Moth base URL.

export function createQrngPool({ label = 'moth-qrng', hex = '', offset = 0 } = {}) {
  let bytes = hexToBytes(hex);
  let pos = (offset * 4) % Math.max(4, bytes.length);
  let used = 0;
  return {
    label,
    get remaining() { return Math.floor((bytes.length - pos) / 4); },
    get used() { return used; },
    // uniform in [0, 1) or null when exhausted
    next() {
      if (pos + 4 > bytes.length) return null;
      const v = ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0;
      pos += 4;
      used++;
      return v / 2 ** 32;
    },
    add(moreHex) {
      bytes = concat(bytes.subarray(pos), hexToBytes(moreHex));
      pos = 0;
    },
  };
}

// One comet-qrng job through a Moth base URL; resolves to { hex, certificate, provenance }.
export async function fetchCometBytes({ baseUrl, apiKey, mode = 'qpu', outputBytes = 4096, pollMs = 3000, timeoutMs = 15 * 60 * 1000 }) {
  const headers = { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) };
  const call = async (path, init) => {
    const r = await fetch(baseUrl + path, { ...init, headers });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`moth ${r.status} ${path}: ${body.detail ?? body.title ?? ''}`);
    return body;
  };
  const params = { mode, num_qubits: 12, shots: 10000, output_bytes: outputBytes, bell_witness: mode === 'qpu', include_raw_counts: false };
  const job = await call('/engines/comet-qrng-v1/process', { method: 'POST', body: JSON.stringify({ params }) });
  const t0 = Date.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, pollMs));
    const st = await call(`/jobs/${job.job_id}/status`);
    if (st.status === 'completed') break;
    if (st.status === 'failed' || st.status === 'cancelled') throw new Error(`comet ${st.status}: ${st.error?.message ?? ''}`);
    if (Date.now() - t0 > timeoutMs) throw new Error('comet timed out');
  }
  const { result } = await call(`/jobs/${job.job_id}/result`);
  const out = result.output ?? result;
  return { hex: out.random.hex, certificate: out.certificate, provenance: { ...out.provenance, job_id: job.job_id } };
}

function hexToBytes(hex) {
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}
