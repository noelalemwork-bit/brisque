// Runs named prerender recipes against Moth Atlas engines, caches by params hash, writes game assets
// to public/generated/<engine>/ and records evidence in public/generated/manifest.json.
//
//   node tools/prerender/run.mjs                 all recipes (cached ones cost nothing)
//   node tools/prerender/run.mjs es-peaked fry-blast
//   node tools/prerender/run.mjs --dry           show what would be submitted, no API calls
//   node tools/prerender/run.mjs --list
//
// Raw engine outputs are cached in tools/prerender/cache/<recipe>/<hash>/ (gitignored), so the
// post-processing step can be re-run and tweaked without spending credits. Independent recipes run
// in parallel; a recipe that consumes another's output awaits it (daisy chain).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import * as moth from './moth.mjs';
import * as inputs from './inputs.mjs';
import { parseHDR, decode, rgba, toPNG } from './img.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const GEN = path.join(ROOT, 'public/generated');
const CACHE = path.join(HERE, 'cache');
const SUBMIT = path.join(ROOT, 'release/submission');
const MANIFEST = path.join(GEN, 'manifest.json');

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const png = (data, filename = 'input.png') => ({ data, filename, contentType: 'image/png' });
const write = (rel, buf) => { const f = path.join(GEN, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); return `generated/${rel.replace(/\\/g, '/')}`; };

// ---------------------------------------------------------------------------------------------
// Recipes. inputs(ctx) -> { slot: file } (may await other recipes via ctx.need(name)).
// post(out, ctx) -> list of public paths written. `out` = { outputs:[{slot, buffer, ...}], result }.
const ES_POST = (name) => async (out) => {
  const dir = path.join(CACHE, '_unzip', name);
  fs.mkdirSync(dir, { recursive: true });
  const zip = path.join(dir, 'result.zip');
  fs.writeFileSync(zip, out.outputs[0].buffer);
  execFileSync(process.env.SystemRoot ? path.join(process.env.SystemRoot, 'System32', 'tar.exe') : 'unzip', process.env.SystemRoot ? ['-xf', zip, '-C', dir] : ['-o', zip, '-d', dir]);
  const find = (re) => { const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]); return walk(dir).find((f) => re.test(path.basename(f))); };
  const R = parseHDR(fs.readFileSync(find(/^R_lut\.hdr$/i)));
  const T = parseHDR(fs.readFileSync(find(/^T_lut\.hdr$/i)));
  // pack R (top) and T (bottom) into one 8-bit PNG, each normalised by its own max (stored in json)
  const max = (L) => L.data.reduce((m, v) => Math.max(m, v), 1e-6);
  const mR = max(R); const mT = max(T);
  const img = rgba(R.w, R.h + T.h, (x, y) => {
    const L = y < R.h ? R : T; const yy = y < R.h ? y : y - R.h; const m = y < R.h ? mR : mT;
    const i = (yy * L.w + x) * 3;
    return [255 * (L.data[i] / m) ** (1 / 2.2), 255 * (L.data[i + 1] / m) ** (1 / 2.2), 255 * (L.data[i + 2] / m) ** (1 / 2.2), 255];
  });
  const files = [write(`entanglement-shader-v1/${name}.png`, await toPNG(img, 3))];
  files.push(write(`entanglement-shader-v1/${name}.json`, JSON.stringify({ w: R.w, h: R.h, maxR: mR, maxT: mT, gamma: 2.2, layout: 'R rows [0,h), T rows [h,2h)' })));
  const glsl = find(/\.glsl$/i);
  if (glsl) files.push(write(`entanglement-shader-v1/${name}.glsl`, fs.readFileSync(glsl)));
  return files;
};

const ES_BASE = { absorption: 0.95, incoming_rays: 8, interaction: 1, layers: 2, reflectance: 0.2, resolution: 64 };

export const RECIPES = {
  'es-peaked': {
    engine: 'entanglement-shader-v1', why: 'iridescent BSDF LUT for superposed ground + thread ribbons',
    params: { ...ES_BASE, style: 'peaked' }, post: ES_POST('peaked'),
  },
  'es-frustrated': {
    engine: 'entanglement-shader-v1', why: 'second LUT (non-monotone colour) for contested metaballs',
    params: { ...ES_BASE, interaction: -1.5, reflectance: 0.35, style: 'frustrated' }, post: ES_POST('frustrated'),
  },
  'fry-blast': {
    engine: 'deep-fryer-v1', why: 'quantum-fried bomb blast frames (chain step 1)',
    params: { gates: [['rx', 0.7], ['ry', 0.45]], tile_size: 4, mask_bin_size: 4, mask_min_region: 16 },
    inputs: async () => ({ image: png(await inputs.blastSheet(), 'blast-sheet.png') }),
    post: async (out) => [write('deep-fryer-v1/blast-fried.webp', await sharp(out.outputs[0].buffer).webp({ quality: 85 }).toBuffer())],
  },
  'blur-blast': {
    engine: 'blur-v1', why: 'quantum blur dissolving the blast over time (ramped per-frame mask): impact sprite sheet',
    params: { strength: 0.65, reach: 0.15, style: 'ry', size: 128, downscale: true, mask_bin_size: 4, mask_min_region: 16 },
    inputs: async () => ({ image: png(await inputs.blastSheet(), 'blast-sheet.png'), mask: png(await inputs.rampMask(), 'ramp-mask.png') }),
    post: async (out, ctx) => {
      const dir = path.join(SUBMIT, 'one-image');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'blast-before.png'), await inputs.blastSheet());
      fs.writeFileSync(path.join(dir, 'blast-mask.png'), await inputs.rampMask());
      fs.writeFileSync(path.join(dir, 'blast-after-blur-v1.png'), out.outputs[0].buffer);
      fs.writeFileSync(path.join(dir, 'blast-params.json'), JSON.stringify({ engine: 'blur-v1', params: ctx.recipe.params, job_id: ctx.job_id }, null, 2));
      return [write('blur-v1/blast-sheet.webp', await sharp(out.outputs[0].buffer).webp({ quality: 88 }).toBuffer())];
    },
  },
  'blur-fried': {
    engine: 'blur-v1', why: 'daisy chain: deep-fryer-v1 output -> blur-v1 (same ramped mask); preferred impact sheet',
    params: { strength: 0.65, reach: 0.15, style: 'ry', size: 128, downscale: true, mask_bin_size: 4, mask_min_region: 16 },
    inputs: async (ctx) => ({ image: png((await ctx.need('fry-blast')).outputs[0].buffer, 'blast-fried.png'), mask: png(await inputs.rampMask(), 'ramp-mask.png') }),
    // deep-fryer inverts the palette (black -> yellow, cream -> blue), so for additive use each frame is
    // re-based on its own background: |pixel - frame background|, gutters cleared
    post: async (out) => {
      const img = await decode(out.outputs[0].buffer);
      const F = inputs.FRAME;
      const res = rgba(img.w, img.h, (x, y) => {
        const fx = x % F;
        if (fx < 3 || fx >= F - 3 || y < 3 || y >= img.h - 3) return [0, 0, 0, 255];
        const x0 = x - fx;
        const bg = [0, 1, 2].map((c) => { let sum = 0; for (let j = 4; j < 10; j++) for (let i = 4; i < 10; i++) sum += img.buf[((j * img.w) + x0 + i) * 4 + c]; return sum / 36; });
        const i = (y * img.w + x) * 4;
        return [0, 1, 2].map((c) => Math.abs(img.buf[i + c] - bg[c]) * 1.3).concat(255);
      });
      return [write('blur-v1/blast-fried-sheet.webp', await sharp(res.buf, { raw: { width: res.w, height: res.h, channels: 4 } }).removeAlpha().webp({ quality: 88 }).toBuffer())];
    },
  },
  'tela-glitch': {
    engine: 'telablur-v1', why: 'scan bars teleblurred into block noise: screen glitch streak texture',
    params: { direction: 'horizontal', strength: 0.7, size: 256, downscale: true, mask_bin_size: 4, mask_min_region: 16 },
    inputs: async () => ({ image1: png(await inputs.glitchBars(), 'glitch-bars.png'), image2: png(await inputs.glitchBlocks(), 'glitch-blocks.png') }),
    post: async (out) => [write('telablur-v1/glitch.webp', await sharp(out.outputs[0].buffer).webp({ quality: 90 }).toBuffer())],
  },
  'core-static': {
    engine: 'blur-core-v1', why: '8 frames of shot-noise "quantum static" (64x64x8 grid, frame axis untouched)',
    params: { values: inputs.staticGrid(), strength: [0.1, 0.1, 0], reach: 0, style: 'x', shots: 40000, max_qubits: 20 },
    describe: (p) => ({ ...p, values: `[64][64][8] grid (inputs.staticGrid), sha256 ${sha(JSON.stringify(p.values)).slice(0, 12)}` }),
    post: async (out) => {
      const g = out.result.output ?? out.result; const n = g.length; const F = g[0][0].length;
      let m = 1e-9; for (const row of g) for (const c of row) for (const v of c) m = Math.max(m, v);
      const img = rgba(n * F, n, (x, y) => { const v = 255 * Math.min(1, (g[y][x % n][Math.floor(x / n)] / m) * 1.6); return [v, v, v, 255]; });
      return [write('blur-core-v1/static.png', await sharp(img.buf, { raw: { width: img.w, height: img.h, channels: 4 } }).greyscale().png({ compressionLevel: 9 }).toBuffer())];
    },
  },
  'qpixl-slabs': {
    engine: 'qpixl-v1', why: 'glitch slab offsets encoded through a noisy fake_marrakesh device (QPIXL)',
    params: { values: inputs.slabField(), mode: 'emu', machine: 'fake_marrakesh', shots: 2048, dynamic_range: 'min_max', discretize: 0, allow_high_shots: false },
    describe: (p) => ({ ...p, values: `400 floats (inputs.slabField 20x20), sha256 ${sha(JSON.stringify(p.values)).slice(0, 12)}` }),
    post: async (out, ctx) => {
      fs.writeFileSync(path.join(ctx.dir, 'result-full.json'), JSON.stringify(out.result));
      const arr = findNumbers(out.result, 400);
      return [write('qpixl-v1/slabs.json', JSON.stringify({ n: 20, input: inputs.slabField(), values: arr.map((v) => +v.toFixed(4)) }))];
    },
  },
  'blur-board': {
    engine: 'blur-v1', why: 'One image, one engine: a Brisque board screenshot through Quantum Blur',
    params: { strength: 0.3, reach: 0.05, style: 'rx', size: 512, downscale: true, mask_bin_size: 4, mask_min_region: 16 },
    inputs: () => ({ image: png(fs.readFileSync(path.join(HERE, 'assets/board.png')), 'brisque-board.png') }),
    post: async (out, ctx) => {
      const dir = path.join(SUBMIT, 'one-image');
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(path.join(HERE, 'assets/board.png'), path.join(dir, 'board-before.png'));
      fs.writeFileSync(path.join(dir, 'board-after-blur-v1.png'), out.outputs[0].buffer);
      fs.writeFileSync(path.join(dir, 'board-params.json'), JSON.stringify({ engine: 'blur-v1', params: ctx.recipe.params, job_id: ctx.job_id, input: 'board-before.png (Brisque match screenshot, 480x255)' }, null, 2));
      return ['release/submission/one-image/board-after-blur-v1.png'];
    },
  },
  'tessa-board': {
    engine: 'tessa-image-v1', why: 'One image, one engine: a Brisque board screenshot through Tessa (aer, XZ distortion 0.6)',
    params: { machine: 'aer', distortion: 0.6, gate_pauli: 'XZ', shots: 4096, separate_rgb: true, range_correction: false, fixed_palette: false },
    inputs: () => {
      const src = path.join(HERE, 'assets/board.png');
      if (!fs.existsSync(src)) throw new Error('tools/prerender/assets/board.png missing (capture a screenshot first)');
      return { image: png(fs.readFileSync(src), 'brisque-board.png') };
    },
    post: async (out, ctx) => {
      const before = fs.readFileSync(path.join(HERE, 'assets/board.png'));
      const dir = path.join(SUBMIT, 'one-image');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'before.png'), before);
      fs.writeFileSync(path.join(dir, 'after-tessa.png'), out.outputs[0].buffer);
      fs.writeFileSync(path.join(dir, 'params.json'), JSON.stringify({ engine: 'tessa-image-v1', params: ctx.recipe.params, job_id: ctx.job_id }, null, 2));
      return [write('tessa-image-v1/board.webp', await sharp(out.outputs[0].buffer).webp({ quality: 85 }).toBuffer())];
    },
  },
};

// ---- full-screen post effects (src/client/vfx/post.js) ------------------------------------------
// telablur-v1 takes ONE strength per job, so a morph sequence is one job per strength (frame 0 is the
// source image itself, strength 0). Frames land in cache/_frames/ and are assembled into one sheet at the end.
const FRAMES_DIR = path.join(CACHE, '_frames');
const lumFrame = async (buf, size = 128) => sharp(buf).resize(size, size, { fit: 'fill' }).greyscale().png({ compressionLevel: 9 }).toBuffer();
const saveFrame = async (name, buf) => { fs.mkdirSync(FRAMES_DIR, { recursive: true }); fs.writeFileSync(path.join(FRAMES_DIR, `${name}.png`), await lumFrame(buf)); };
export const FORK_STRENGTHS = [0.25, 0.5, 0.75, 1];
export const COLLAPSE_STRENGTHS = [0.35, 0.7, 1];
const TELA = { direction: 'full', size: 128, downscale: true, mask_bin_size: 4, mask_min_region: 16 };
for (const s of FORK_STRENGTHS) {
  RECIPES[`tela-fork-${s * 100}`] = {
    engine: 'telablur-v1', why: `split "reality forks" frame: one lobe teleblurred toward two (strength ${s})`,
    params: { ...TELA, strength: s },
    inputs: async () => ({ image1: png(await inputs.forkOne(), 'fork-one.png'), image2: png(await inputs.forkTwo(), 'fork-two.png') }),
    post: async (out) => { await saveFrame(`fork-${s * 100}`, out.outputs[0].buffer); return ['generated/telablur-v1/fork-sheet.png']; },
  };
}
for (const s of COLLAPSE_STRENGTHS) {
  RECIPES[`tela-collapse-${s * 100}`] = {
    engine: 'telablur-v1', why: `bomb collapse frame: superposed cloud teleblurred toward a point (strength ${s})`,
    params: { ...TELA, strength: s },
    inputs: async () => ({ image1: png(await inputs.collapseCloud(), 'collapse-cloud.png'), image2: png(await inputs.collapsePoint(), 'collapse-point.png') }),
    post: async (out) => { await saveFrame(`collapse-${s * 100}`, out.outputs[0].buffer); return ['generated/telablur-v1/collapse-sheet.png']; },
  };
}
RECIPES['core-shock'] = {
  engine: 'blur-core-v1', why: 'bomb collapse shockwave: 8 expanding rings (64x64x8 grid, frame axis untouched) quantum-blurred with shot noise',
  params: { values: inputs.shockGrid(), strength: [0.14, 0.14, 0], reach: 0, style: 'x', shots: 40000, max_qubits: 20 },
  describe: (p) => ({ ...p, values: `[64][64][8] grid (inputs.shockGrid), sha256 ${sha(JSON.stringify(p.values)).slice(0, 12)}` }),
  post: async (out) => {
    const g = out.result.output ?? out.result; const n = g.length; const F = g[0][0].length;
    let m = 1e-9; for (const row of g) for (const c of row) for (const v of c) m = Math.max(m, v);
    const img = rgba(n * F, n, (x, y) => { const v = 255 * Math.min(1, g[y][x % n][Math.floor(x / n)] / m); return [v, v, v, 255]; });
    return [write('blur-core-v1/shock.png', await sharp(img.buf, { raw: { width: img.w, height: img.h, channels: 4 } }).greyscale().png({ compressionLevel: 9 }).toBuffer())];
  },
};
// daisy chain: the telablur fork frames become a quantum reservoir's vocabulary. It learns the fork /
// rejoin cycle and generates its own continuation; the game plays the generated token order.
const FORK_VOCAB = ['fork0.png', 'fork1.png', 'fork2.png', 'fork3.png', 'fork4.png'];
const FORK_CYCLE = ['fork0.png', 'fork0.png', 'fork1.png', 'fork2.png', 'fork3.png', 'fork4.png', 'fork4.png', 'fork3.png', 'fork2.png', 'fork1.png'];
const FORK_TRAIN = [...FORK_CYCLE, ...FORK_CYCLE]; // the engine wants > 16 tokens
async function forkVocabFrames(ctx) {
  const frames = [await lumFrame(await inputs.forkOne())];
  for (const s of FORK_STRENGTHS) frames.push(await lumFrame((await ctx.need(`tela-fork-${s * 100}`)).outputs[0].buffer));
  return frames;
}
RECIPES['qrc-fork'] = {
  engine: 'qrc-image-v1', why: 'daisy chain: telablur-v1 fork frames as the vocabulary of a quantum reservoir that generates the split effect\'s frame order',
  params: { training_sequence: FORK_TRAIN, length: 96, fps: 12, quality: 'moderate', variation: 1, seed: 2026, periodic: true },
  inputs: async (ctx) => {
    const frames = await forkVocabFrames(ctx);
    return { vocabulary: { data: inputs.zipStored(frames.map((data, i) => ({ name: FORK_VOCAB[i], data }))), filename: 'fork-vocab.zip', contentType: 'application/zip' } };
  },
  post: async (out, ctx) => {
    fs.writeFileSync(path.join(ctx.dir, 'result-full.json'), JSON.stringify(out.result ?? null));
    const gif = out.outputs.find((o) => /gif/i.test(o.content_type ?? '') || /\.gif$/i.test(o.filename ?? '')) ?? out.outputs[0];
    // map each generated GIF frame back to its vocabulary token (nearest frame, mean abs difference)
    const vocab = await Promise.all((await forkVocabFrames(ctx)).map(async (b) => (await sharp(b).resize(32, 32, { fit: 'fill' }).greyscale().raw().toBuffer())));
    const meta = await sharp(gif.buffer, { animated: true }).metadata();
    const pages = meta.pages ?? 1;
    const tokens = []; const err = [];
    for (let i = 0; i < pages; i++) {
      const f = await sharp(gif.buffer, { page: i }).resize(32, 32, { fit: 'fill' }).greyscale().raw().toBuffer();
      const d = vocab.map((v) => v.reduce((a, x, j) => a + Math.abs(x - f[j]), 0) / v.length);
      const best = d.indexOf(Math.min(...d));
      // the GIF encoder merges repeated frames into one longer frame: expand by delay / frame time
      const repeat = Math.max(1, Math.round((meta.delay?.[i] ?? 1000 / ctx.recipe.params.fps) / (1000 / ctx.recipe.params.fps)));
      for (let k = 0; k < repeat; k++) { tokens.push(best); err.push(+d[best].toFixed(2)); }
    }
    // the GIF (1.2 MB) stays in the cache and the submission folder; the game only needs the token order
    fs.mkdirSync(SUBMIT, { recursive: true });
    fs.writeFileSync(path.join(SUBMIT, 'qrc-image-v1-fork.gif'), gif.buffer);
    return [write('qrc-image-v1/fork-seq.json', JSON.stringify({ about: 'qrc-image-v1 generated frame order over the telablur fork vocabulary (0 = one lobe .. 4 = two lobes); tokens recovered from the GIF by nearest vocabulary frame, repeats from frame delays', vocabulary: FORK_VOCAB, training_sequence: FORK_TRAIN, fps: ctx.recipe.params.fps, tokens, match_error: err, job_id: ctx.job_id }))];
  },
};

// sheets assembled from whatever frames exist (frame 0 = the engine input at strength 0)
async function assembleSheets() {
  const sheet = async (rel, first, names) => {
    const files = names.map((n) => path.join(FRAMES_DIR, `${n}.png`));
    if (!files.every((f) => fs.existsSync(f))) { console.log(`${rel}: frames missing, sheet not written`); return; }
    const frames = [await lumFrame(await first()), ...files.map((f) => fs.readFileSync(f))];
    const out = await sharp({ create: { width: 128 * frames.length, height: 128, channels: 3, background: '#000' } })
      .composite(frames.map((input, i) => ({ input, left: 128 * i, top: 0 }))).greyscale().png({ compressionLevel: 9 }).toBuffer();
    write(rel, out);
    console.log(`${rel}: ${frames.length} frames`);
  };
  await sheet('telablur-v1/fork-sheet.png', inputs.forkOne, FORK_STRENGTHS.map((s) => `fork-${s * 100}`));
  await sheet('telablur-v1/collapse-sheet.png', inputs.collapseCloud, COLLAPSE_STRENGTHS.map((s) => `collapse-${s * 100}`));
}

// the reconstruction array inside an engine's JSON result (shape varies), the first numeric list of length n
function findNumbers(o, n) {
  if (Array.isArray(o)) {
    const flat = o.flat(Infinity);
    if (flat.length === n && flat.every((v) => typeof v === 'number')) return flat;
    for (const v of o) { const r = findNumbers(v, n); if (r) return r; }
  } else if (o && typeof o === 'object') {
    for (const k of ['reconstruction', 'reconstructed', 'values', 'output', 'result']) if (k in o) { const r = findNumbers(o[k], n); if (r) return r; }
    for (const v of Object.values(o)) { const r = findNumbers(v, n); if (r) return r; }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
if (argv.includes('--list')) { for (const [k, r] of Object.entries(RECIPES)) console.log(k.padEnd(14), r.engine.padEnd(24), r.why); process.exit(0); }
const wanted = argv.filter((a) => !a.startsWith('--'));
const names = wanted.length ? wanted : Object.keys(RECIPES);
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { about: 'Every Moth Atlas engine output shipped with Brisque: engine, exact params, job id, timing. Regenerate with node tools/prerender/run.mjs.', entries: [] };
const running = new Map();

async function exec(name) {
  const recipe = RECIPES[name];
  if (!recipe) throw new Error(`unknown recipe ${name}`);
  const ctx = { recipe, need: (n) => (running.get(n) ?? start(n)) };
  const files = recipe.inputs ? await recipe.inputs(ctx) : undefined;
  const inputHashes = files ? Object.fromEntries(Object.entries(files).map(([s, f]) => [s, sha(f.data)])) : undefined;
  const hash = sha(JSON.stringify({ engine: recipe.engine, params: recipe.params, inputs: inputHashes })).slice(0, 16);
  const dir = path.join(CACHE, name, hash);
  ctx.dir = dir;
  let out; let meta;
  if (fs.existsSync(path.join(dir, 'meta.json'))) {
    meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
    out = { outputs: meta.outputs.map((o) => ({ ...o, buffer: fs.readFileSync(path.join(dir, o.file)) })), result: meta.result };
    console.log(`${name}: cached (${hash}, job ${meta.job_id})`);
  } else {
    if (dry) { console.log(`${name} [${hash}]: WOULD SUBMIT ${recipe.engine} ${JSON.stringify(recipe.describe ? recipe.describe(recipe.params) : recipe.params).slice(0, 300)} inputs=${JSON.stringify(inputHashes ?? {})}`); return null; }
    // a job submitted by an earlier (interrupted) run is resumed instead of paying for it again
    const pendingFile = path.join(dir, 'pending.json');
    const resume = fs.existsSync(pendingFile) ? JSON.parse(fs.readFileSync(pendingFile, 'utf8')) : undefined;
    const res = await moth.run(recipe.engine, recipe.params, {
      files, resume,
      onSubmit: (p) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(pendingFile, JSON.stringify(p)); },
    });
    fs.mkdirSync(dir, { recursive: true });
    fs.rmSync(pendingFile, { force: true });
    if (files) for (const [slot, f] of Object.entries(files)) fs.writeFileSync(path.join(dir, `input-${slot}-${f.filename}`), f.data);
    meta = { engine: recipe.engine, job_id: res.job_id, ms: res.ms, date: new Date().toISOString(), input_assets: res.input_assets, result: res.result, outputs: [] };
    res.outputs.forEach((o, i) => { const file = `out-${o.slot}-${i}${path.extname(o.filename || '') || '.bin'}`; fs.writeFileSync(path.join(dir, file), o.buffer); meta.outputs.push({ slot: o.slot, filename: o.filename, content_type: o.content_type, file }); });
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 1));
    out = { outputs: res.outputs, result: res.result };
    console.log(`${name}: done in ${(res.ms / 1000).toFixed(1)} s (job ${res.job_id})`);
  }
  ctx.job_id = meta.job_id;
  if (dry) return out;
  const written = await recipe.post(out, ctx);
  const entry = {
    recipe: name, engine: recipe.engine, why: recipe.why, params: recipe.describe ? recipe.describe(recipe.params) : recipe.params,
    inputs: files ? Object.fromEntries(Object.entries(files).map(([s, f]) => [s, { filename: f.filename, sha256: inputHashes[s] }])) : undefined,
    hash, files: written, job_id: meta.job_id, ms: meta.ms, date: meta.date,
  };
  manifest.entries = manifest.entries.filter((e) => e.recipe !== name); // latest run per recipe
  manifest.entries.push(entry);
  return out;
}

function start(name) {
  const p = exec(name);
  running.set(name, p);
  return p;
}

const results = await Promise.allSettled(names.map((n) => running.get(n) ?? start(n)));
results.forEach((r, i) => { if (r.status === 'rejected') console.error(`${names[i]}: FAILED ${r.reason?.message ?? r.reason}`); });
if (!dry) {
  fs.mkdirSync(GEN, { recursive: true });
  await assembleSheets();
  manifest.entries = manifest.entries.filter((e, i, all) => all.findLastIndex((x) => x.recipe === e.recipe) === i);
  manifest.updated = new Date().toISOString();
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
  console.log(`manifest: ${manifest.entries.length} entries -> public/generated/manifest.json`);
}
