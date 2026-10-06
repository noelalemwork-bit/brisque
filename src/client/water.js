// Art-directed toon water.
//
// Surface: a flat sheet (no displaced grid). Colour runs from shallow teal at the coast to deep blue
// offshore, with slow large-scale tint drift; a solid foam band hugs every coast and thin foam rings
// drift outward and fade. All coast-relative terms come from the coast-distance texture baked in
// mapMesh.js (MAX_DIST must match).
//
// Wave marks: small hand-drawn zig-zags, always screen-aligned (billboards), scattered over open water.
// Each one draws on from left to right, holds, then erases, with a faint lighter gradient beneath its
// stroke so the surface reads as having volume; then it respawns somewhere else.

import * as THREE from 'three';

const MAX_DIST = 8; // must match the texture bake in mapMesh.js
const MARKS = 70;

export function createWater({ size = 4000 } = {}) { // two triangles: size is free, and the edge must sit far beyond the fog
  const group = new THREE.Group();
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#2b6d86') },
      uMid: { value: new THREE.Color('#3a8ea3') },
      uShallow: { value: new THREE.Color('#72c6c2') },
      uFoam: { value: new THREE.Color('#f3f6ef') },
      uCoast: { value: null },
      uMapSize: { value: new THREE.Vector2(100, 70) },
    },
  ]);

  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size, 1, 1).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({ uniforms, fog: true, vertexShader: SURFACE_VERT, fragmentShader: SURFACE_FRAG }),
  );
  group.add(surface);

  // --- wave marks -----------------------------------------------------------------------------------
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);
  const aOffset = new THREE.InstancedBufferAttribute(new Float32Array(MARKS * 3), 3);
  const aBirth = new THREE.InstancedBufferAttribute(new Float32Array(MARKS), 1);
  const aLife = new THREE.InstancedBufferAttribute(new Float32Array(MARKS), 1);
  const aSize = new THREE.InstancedBufferAttribute(new Float32Array(MARKS), 1);
  geo.setAttribute('aOffset', aOffset);
  geo.setAttribute('aBirth', aBirth);
  geo.setAttribute('aLife', aLife);
  geo.setAttribute('aSize', aSize);
  geo.instanceCount = MARKS;
  const markUniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]);
  const marks = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: markUniforms, fog: true, transparent: true, depthWrite: false,
    vertexShader: MARK_VERT, fragmentShader: MARK_FRAG,
  }));
  marks.frustumCulled = false;
  marks.renderOrder = 1;
  group.add(marks);

  // open-water sampler: outside the map rectangle is always sea; inside, a land mask and the coast
  // texture keep marks off land and away from beaches
  const MASK = 96;
  let coastData = null;
  let texW = 0;
  let texH = 0;
  let mapW = 100;
  let mapH = 70;
  let landMask = null;
  function isOpenWater(x, z) {
    const u = (x + mapW / 2) / mapW;
    const v = (z + mapH / 2) / mapH;
    if (u < 0 || u > 1 || v < 0 || v > 1) return true;
    if (landMask && landMask[Math.min(MASK - 1, Math.floor(v * MASK)) * MASK + Math.min(MASK - 1, Math.floor(u * MASK))]) return false;
    if (!coastData) return true;
    const d = (coastData[Math.min(texH - 1, Math.floor(v * texH)) * texW + Math.min(texW - 1, Math.floor(u * texW))] / 255) * MAX_DIST;
    return d > 3.2;
  }
  let clock = 0;
  function spawn(i, now) {
    for (let k = 0; k < 30; k++) {
      const r = Math.sqrt(Math.random()) * 95;
      const a = Math.random() * Math.PI * 2;
      const x = Math.cos(a) * r * 1.2;
      const z = Math.sin(a) * r;
      if (!isOpenWater(x, z)) continue;
      aOffset.setXYZ(i, x, 0.05, z);
      break;
    }
    aBirth.setX(i, now + Math.random() * 1.5);
    aLife.setX(i, 2.4 + Math.random() * 2.2);
    aSize.setX(i, 3 + Math.random() * 2.6);
  }
  const touch = () => { aOffset.needsUpdate = aBirth.needsUpdate = aLife.needsUpdate = aSize.needsUpdate = true; };
  for (let i = 0; i < MARKS; i++) { spawn(i, 0); aBirth.setX(i, -Math.random() * 4); }

  function rasterLand(map) {
    const mask = new Uint8Array(MASK * MASK);
    for (const t of map.territories) {
      const xs = t.outline.map((p) => p[0]);
      const ys = t.outline.map((p) => p[1]);
      const i0 = Math.max(0, Math.floor((Math.min(...xs) / map.width) * MASK));
      const i1 = Math.min(MASK - 1, Math.ceil((Math.max(...xs) / map.width) * MASK));
      const j0 = Math.max(0, Math.floor((Math.min(...ys) / map.height) * MASK));
      const j1 = Math.min(MASK - 1, Math.ceil((Math.max(...ys) / map.height) * MASK));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          if (inside(t.outline, ((i + 0.5) / MASK) * map.width, ((j + 0.5) / MASK) * map.height)) mask[j * MASK + i] = 1;
        }
      }
    }
    return mask;
  }

  return {
    mesh: group,
    update(time) {
      clock = time;
      uniforms.uTime.value = time;
      markUniforms.uTime.value = time;
      let dirty = false;
      for (let i = 0; i < MARKS; i++) if (time > aBirth.getX(i) + aLife.getX(i)) { spawn(i, time); dirty = true; }
      if (dirty) touch();
    },
    // map: the generated board (for the land mask and the coast texture's extent)
    setCoast(texture, map) {
      uniforms.uCoast.value?.dispose();
      uniforms.uCoast.value = texture;
      mapW = map.width;
      mapH = map.height;
      uniforms.uMapSize.value.set(mapW, mapH);
      coastData = texture.image.data;
      texW = texture.image.width;
      texH = texture.image.height;
      landMask = rasterLand(map);
      for (let i = 0; i < MARKS; i++) spawn(i, clock);
      touch();
    },
    setSun() {},
  };
}

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const SURFACE_VERT = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const SURFACE_FRAG = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform vec3 uDeep, uMid, uShallow, uFoam;
  uniform sampler2D uCoast;
  uniform vec2 uMapSize;
  varying vec3 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    vec2 uv = (vWorld.xz + uMapSize * 0.5) / uMapSize;
    float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    float d = mix(${MAX_DIST.toFixed(1)}, texture2D(uCoast, uv).r * ${MAX_DIST.toFixed(1)}, inside);
    // depth gradient: shallow -> mid -> deep, with slow large-scale drift so it never looks flat
    float drift = vnoise(vWorld.xz * 0.035 + uTime * 0.02) * 0.6 + vnoise(vWorld.xz * 0.09 - uTime * 0.03) * 0.4;
    vec3 col = mix(uShallow, uMid, smoothstep(0.5, 3.5, d));
    col = mix(col, uDeep, smoothstep(3.0, 7.5, d) * (0.85 + 0.15 * drift));
    col *= 0.96 + 0.08 * drift;
    // coast: solid wobbly foam band, then thin rings drifting outward and fading
    float wob = vnoise(vWorld.xz * 1.3 + uTime * 0.4);
    float band = 1.0 - smoothstep(0.95 + 0.3 * wob, 1.15 + 0.3 * wob, d);
    float ringT = fract(d * 0.5 - uTime * 0.16 + wob * 0.2);
    float ring = smoothstep(0.86, 0.9, ringT) * (1.0 - smoothstep(0.96, 1.0, ringT)) * (1.0 - smoothstep(1.4, 4.0, d));
    col = mix(col, uFoam, max(band, ring * 0.7));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const MARK_VERT = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  attribute vec3 aOffset;
  attribute float aBirth;
  attribute float aLife;
  attribute float aSize;
  uniform float uTime;
  varying vec2 vUv;
  varying float vK;
  void main() {
    vUv = uv;
    vK = clamp((uTime - aBirth) / aLife, 0.0, 1.0);
    // screen-aligned billboard: a constant orientation relative to the camera
    vec4 mvPosition = viewMatrix * modelMatrix * vec4(aOffset, 1.0);
    // damp size near the camera so close marks don't balloon
    float s = aSize * clamp(-mvPosition.z / 70.0, 0.35, 1.0);
    mvPosition.xy += position.xy * vec2(s, s * 0.42);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const MARK_FRAG = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  varying vec2 vUv;
  varying float vK;
  void main() {
    // zig-zag: a triangle wave with 3.5 teeth; drawn on by an eased head, erased by an eased tail
    float tri = abs(fract(vUv.x * 3.5) - 0.5) * 2.0;
    float lineY = 0.62 + (tri - 0.5) * 0.36;
    float dist = abs(vUv.y - lineY);
    float stroke = 1.0 - smoothstep(0.045, 0.085, dist);
    float head = smoothstep(0.0, 0.35, vK);
    float tail = smoothstep(0.6, 1.0, vK);
    float drawn = step(vUv.x, head) * step(tail, vUv.x);
    float edge = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
    // soft lighter gradient under the stroke: gives the surface a little volume
    float under = smoothstep(lineY, lineY - 0.5, vUv.y) * step(vUv.y, lineY) * 0.22;
    float a = max(stroke * 0.9, under) * drawn * edge;
    if (a < 0.01) discard;
    vec3 col = mix(vec3(0.82, 0.93, 0.95), vec3(1.0), stroke);
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;
