// Procedural input images for the image engines. Deterministic (seeded), so their bytes hash stably.
import zlib from 'node:zlib';
import { rgba, toPNG, prng } from './img.mjs';

export const FRAME = 128;
export const FRAMES = 8;

// Bomb blast sprite sheet: FRAMES frames of FRAME px in a row, on black (drawn additively in game).
// Each frame: warm core flash that swells and fades, a coral shock ring that expands, 14 shard rays.
export function blastSheet() {
  const rnd = prng(7);
  const rays = Array.from({ length: 14 }, () => ({ a: rnd() * Math.PI * 2, w: 0.05 + rnd() * 0.08, len: 0.6 + rnd() * 0.4 }));
  const img = rgba(FRAME * FRAMES, FRAME, (x, y) => {
    const k = Math.floor(x / FRAME);
    const t = k / (FRAMES - 1);
    const dx = (x % FRAME) - FRAME / 2 + 0.5;
    const dy = y - FRAME / 2 + 0.5;
    const r = Math.hypot(dx, dy) / (FRAME / 2); // 0 centre .. 1 edge
    const a = Math.atan2(dy, dx);
    const core = Math.exp(-((r / (0.18 + 0.4 * Math.sqrt(t))) ** 2)) * (1 - t) ** 1.3;
    const rr = 0.15 + 0.75 * (1 - (1 - t) ** 2);
    const ring = Math.exp(-(((r - rr) / (0.04 + 0.05 * (1 - t))) ** 2)) * (1 - t) ** 0.8;
    let shard = 0;
    for (const s of rays) {
      let da = Math.abs(((a - s.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const reach = s.len * (0.25 + 0.75 * t);
      if (r < reach) shard = Math.max(shard, Math.exp(-((da / s.w) ** 2)) * (1 - r / reach) * (1 - t) * 0.9);
    }
    const cream = [255, 243, 196]; const coral = [255, 150, 120]; const peach = [255, 200, 150];
    return [0, 1, 2].map((c) => cream[c] * core + coral[c] * ring + peach[c] * shard).concat(255);
  });
  return toPNG(img, 3);
}

// Mask for the sheet: one disjoint box per frame (2 px gutters -> separate regions the engines process
// independently), grey level ramping up so later frames take more of the effect.
export function rampMask(lo = 0.25, hi = 1) {
  const img = rgba(FRAME * FRAMES, FRAME, (x, y) => {
    const fx = x % FRAME;
    if (fx < 2 || fx >= FRAME - 2 || y < 2 || y >= FRAME - 2) return [0, 0, 0, 255];
    const v = 255 * (lo + (hi - lo) * (Math.floor(x / FRAME) / (FRAMES - 1)));
    return [v, v, v, 255];
  });
  return toPNG(img, 3);
}

// Glitch source A: horizontal scan bars of pastel colour channels with random widths.
export function glitchBars(size = 256) {
  const rnd = prng(11);
  const rows = [];
  for (let y = 0; y < size;) {
    const h = 1 + Math.floor(rnd() ** 2 * 18);
    const col = [[255, 120, 140], [120, 220, 255], [255, 240, 200], [0, 0, 0], [0, 0, 0], [180, 140, 255]][Math.floor(rnd() * 6)];
    const shift = Math.floor(rnd() * size);
    const len = Math.floor(size * (0.2 + rnd() * 0.8));
    for (let i = 0; i < h && y < size; i++, y++) rows.push({ col, shift, len });
  }
  return toPNG(rgba(size, size, (x, y) => {
    const r = rows[y];
    const on = ((x - r.shift + size) % size) < r.len;
    return on ? [...r.col, 255] : [0, 0, 0, 255];
  }), 3);
}

// Glitch source B: blocky value noise (8 px cells, a few bright blocks).
export function glitchBlocks(size = 256, cell = 8) {
  const rnd = prng(23);
  const n = size / cell;
  const v = Array.from({ length: n * n }, () => (rnd() < 0.18 ? 255 * rnd() : 0));
  return toPNG(rgba(size, size, (x, y) => {
    const g = v[Math.floor(y / cell) * n + Math.floor(x / cell)];
    return [g, g * 0.9, g, 255];
  }), 3);
}

// blur-core-v1 input: FRAMES slices of a 64x64 field (soft vignette + faint rings), axis 2 = frame.
export function staticGrid(n = 64, frames = FRAMES) {
  const out = [];
  for (let y = 0; y < n; y++) {
    const row = [];
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
      const cell = [];
      for (let f = 0; f < frames; f++) cell.push(+(Math.max(0, 1 - r * r) * (0.75 + 0.25 * Math.cos(r * 18 - f * 0.8))).toFixed(4));
      row.push(cell);
    }
    out.push(row);
  }
  return out;
}

// qpixl-v1 input: a 20x20 (fake_marrakesh holds 448 data qubits) "glitch slab" field flattened (bands of offsets), values in [0,1].
export function slabField(n = 20) {
  const rnd = prng(31);
  const out = [];
  let band = 0; let left = 0;
  for (let y = 0; y < n; y++) {
    if (left-- <= 0) { band = rnd(); left = 1 + Math.floor(rnd() * 4); }
    for (let x = 0; x < n; x++) out.push(+(band * (0.6 + 0.4 * Math.sin((x / n) * Math.PI))).toFixed(4));
  }
  return out;
}

// ---- full-screen post effects (vfx/post.js) ----------------------------------------------------
// Split ("reality forks"): telablur-v1 morphs ONE soft lobe into TWO lobes side by side. The game
// reads each frame as "how strongly the frame doubles here", laid along the split's two prongs.
const gauss = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));
const grey = (size, f) => toPNG(rgba(size, size, (x, y) => { const v = 255 * Math.min(1, f((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5)); return [v, v, v, 255]; }), 3);
export const forkOne = (size = 128) => grey(size, (x, y) => gauss(x, y, 0, 0, 0.17, 0.24));
export const forkTwo = (size = 128) => grey(size, (x, y) => gauss(x, y, -0.27, 0, 0.12, 0.2) + gauss(x, y, 0.27, 0, 0.12, 0.2));
// Bomb collapse: telablur-v1 morphs a broad rippled CLOUD (the superposition) into a sharp POINT.
export const collapseCloud = (size = 128) => grey(size, (x, y) => { const r = Math.hypot(x, y); return Math.max(0, 1 - (r / 0.5) ** 2) * (0.7 + 0.3 * Math.cos(r * 40)); });
export const collapsePoint = (size = 128) => grey(size, (x, y) => gauss(x, y, 0, 0, 0.06, 0.06));

// blur-core-v1 input: FRAMES slices of an expanding shockwave ring (64x64), axis 2 = frame.
export function shockGrid(n = 64, frames = FRAMES) {
  const out = [];
  for (let y = 0; y < n; y++) {
    const row = [];
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
      const cell = [];
      for (let f = 0; f < frames; f++) {
        const k = f / (frames - 1);
        const rr = 0.08 + 0.84 * (1 - (1 - k) ** 1.6);
        cell.push(+(Math.exp(-(((r - rr) / (0.05 + 0.05 * k)) ** 2)) * (1 - k) ** 0.6).toFixed(4));
      }
      row.push(cell);
    }
    out.push(row);
  }
  return out;
}

// Deterministic STORED zip (fixed timestamps) so a vocabulary's bytes, and so its cache hash, are stable.
export function zipStored(entries) {
  const chunks = []; const central = []; let off = 0;
  for (const { name, data } of entries) {
    const n = Buffer.from(name, 'utf8'); const crc = zlib.crc32(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8);
    h.writeUInt16LE(0, 10); h.writeUInt16LE(0x21, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18);
    h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26); h.writeUInt16LE(0, 28);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10);
    c.writeUInt16LE(0, 12); c.writeUInt16LE(0x21, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(n.length, 28); c.writeUInt32LE(off, 42);
    chunks.push(h, n, data); central.push(c, n); off += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...chunks, cd, end]);
}
