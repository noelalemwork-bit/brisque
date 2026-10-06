// Tiny image helpers for the prerender pipeline (sharp is available via node_modules).
import sharp from 'sharp';

// Build an RGBA image from a per-pixel function f(x, y) -> [r, g, b, a] (0..255).
export function rgba(w, h, f) {
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = f(x, y);
    const i = (y * w + x) * 4;
    buf[i] = clamp(c[0]); buf[i + 1] = clamp(c[1]); buf[i + 2] = clamp(c[2]); buf[i + 3] = clamp(c[3] ?? 255);
  }
  return { w, h, buf };
}
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

export const toPNG = ({ w, h, buf }, channels = 4) => {
  const img = sharp(buf, { raw: { width: w, height: h, channels: 4 } });
  return (channels === 3 ? img.removeAlpha() : img).png({ compressionLevel: 9 }).toBuffer();
};

export async function decode(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, buf: data };
}

// Seeded PRNG (mulberry32) so inputs are reproducible and hashable.
export function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Radiance .hdr (RGBE, new-style RLE or flat) -> { w, h, data: Float32Array rgb }
export function parseHDR(buf) {
  let p = 0;
  const line = () => { let s = ''; while (buf[p] !== 0x0a) s += String.fromCharCode(buf[p++]); p++; return s; };
  let l;
  while ((l = line()) !== '') { /* header */ }
  const m = line().match(/([-+])Y (\d+) ([-+])X (\d+)/);
  const h = Number(m[2]); const w = Number(m[4]);
  const data = new Float32Array(w * h * 3);
  const scan = new Uint8Array(w * 4);
  for (let y = 0; y < h; y++) {
    if (w >= 8 && w < 32768 && buf[p] === 2 && buf[p + 1] === 2 && !(buf[p + 2] & 0x80)) {
      p += 4;
      for (let c = 0; c < 4; c++) {
        let x = 0;
        while (x < w) {
          let n = buf[p++];
          if (n > 128) { n -= 128; const v = buf[p++]; while (n--) scan[(x++) * 4 + c] = v; } else { while (n--) scan[(x++) * 4 + c] = buf[p++]; }
        }
      }
    } else {
      for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) scan[x * 4 + c] = buf[p++];
    }
    for (let x = 0; x < w; x++) {
      const e = scan[x * 4 + 3];
      const f = e ? 2 ** (e - 136) : 0;
      const i = (y * w + x) * 3;
      data[i] = scan[x * 4] * f; data[i + 1] = scan[x * 4 + 1] * f; data[i + 2] = scan[x * 4 + 2] * f;
    }
  }
  return { w, h, data };
}
