// Texture sources for the quantum VFX. Every role is a plain file under public/generated/, rendered
// once by a Moth Atlas engine (tools/prerender/run.mjs, evidence in public/generated/manifest.json),
// so the static build makes zero API calls. Swap a role's source at runtime with setVfxSource(role,
// url) (e.g. circuit-generated glitch frames from another tool); materials pick the new texture up.
//
//   blast    blur-v1( deep-fryer-v1( procedural blast sheet ) )   8 frames in a row, additive
//            (falls back to blur-v1( blast sheet ) when the fried chain isn't shipped)
//   glitch   telablur-v1( scan bars -> block noise )              screen glitch streaks
//   static   blur-core-v1 64x64x8 grid with shot noise            8 frames of "quantum static"
//   slabs    qpixl-v1 on fake_marrakesh                           20x20 glitch row offsets (data)
//   forkSheet     telablur-v1( one lobe -> two lobes ), 4 strengths + source   split post effect (vfx/post.js)
//                 played in the order qrc-image-v1 generated (generated/qrc-image-v1/fork-seq.json)
//   collapseSheet telablur-v1( superposed cloud -> point ), 3 strengths + source  bomb collapse pinch
//   shockSheet    blur-core-v1 64x64x8 expanding rings with shot noise           bomb collapse shockwave
//   lut:*    entanglement-shader-v1 R/T lookup tables             iridescent film on superposed pawns

import * as THREE from 'three';

const URLS = {
  blast: ['./generated/blur-v1/blast-fried-sheet.webp', './generated/blur-v1/blast-sheet.webp'],
  glitch: './generated/telablur-v1/glitch.webp',
  static: './generated/blur-core-v1/static.png',
  slabs: './generated/qpixl-v1/slabs.json',
  forkSheet: './generated/telablur-v1/fork-sheet.png',
  collapseSheet: './generated/telablur-v1/collapse-sheet.png',
  shockSheet: './generated/blur-core-v1/shock.png',
  'lut:peaked': './generated/entanglement-shader-v1/peaked.png',
  'lut:frustrated': './generated/entanglement-shader-v1/frustrated.png',
};

const loader = new THREE.TextureLoader();
const textures = new Map(); // role -> { uniform: { value: Texture }, ready: { value: 0|1 } }

function blank() {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
}

// A shared uniform pair for a role: `tex.value` is the texture, `ready.value` flips to 1 once loaded.
// Share these objects across materials (assign them into material.uniforms) so a swap reaches all.
export function vfxTexture(role, opts = {}) {
  let entry = textures.get(role);
  if (entry) return entry;
  const lut = role.startsWith('lut:'); // entanglement LUTs: periodic phase on S, rows not flipped
  const { wrap = lut ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping, wrapT = lut ? THREE.ClampToEdgeWrapping : wrap, srgb = true, flipY = !lut, nearest = false } = opts;
  entry = { tex: { value: blank() }, ready: { value: 0 }, wrap, wrapT, srgb, flipY, nearest };
  textures.set(role, entry);
  load(role, URLS[role]);
  return entry;
}

function load(role, url) {
  const entry = textures.get(role);
  if (!url || !entry || typeof document === 'undefined') return; // headless (node checks): keep the blank
  const [first, ...rest] = [url].flat();
  loader.load(first, (t) => {
    t.wrapS = entry.wrap;
    t.wrapT = entry.wrapT;
    t.flipY = entry.flipY;
    t.colorSpace = entry.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.minFilter = t.magFilter = entry.nearest ? THREE.NearestFilter : THREE.LinearFilter;
    t.generateMipmaps = false;
    const old = entry.tex.value;
    entry.tex.value = t;
    entry.ready.value = 1;
    old.dispose();
  }, undefined, () => { if (rest.length) load(role, rest); });
}

export function setVfxSource(role, url) {
  URLS[role] = url;
  if (textures.has(role)) load(role, url);
}

let slabs = null;
// qpixl reconstruction (20x20 floats in [0,1]); falls back to a hashed pattern until/unless loaded.
export function vfxSlabs() {
  if (!slabs) {
    slabs = { n: 20, values: Array.from({ length: 400 }, (_, i) => (Math.sin(i * 12.9898) * 43758.5453) % 1 * 0.5 + 0.5), loaded: false };
    fetch(URLS.slabs).then((r) => r.json()).then((d) => { slabs.n = d.n; slabs.values = d.values; slabs.loaded = true; }).catch(() => {});
  }
  return slabs;
}

if (typeof window !== 'undefined') window.__brisqueVfx = { setVfxSource, URLS };
