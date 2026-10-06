// Tints each territory's ground with its occupier's colour.
//
//   one army, certain           solid wash, full saturation
//   one army, uncertain         solid wash, saturation scaled by the chance it is there (no competition,
//                               so no blobs)
//   two or more armies          metaballs: each pawn radiates w/(d²+ε); the strongest scaled field wins,
//                               with a dark rim where colours meet. Per-colour multipliers are calibrated
//                               against area-uniform samples so each colour's area share converges to its
//                               weight (presence, or win odds in a battle); "empty" competes as a constant
//                               field. Updates are damped (≤ ±6 %/frame), bounded, and the uniforms eased,
//                               so the blobs breathe instead of flickering.
//
// Any change of appearance grows in from the centroid: the old look stays outside a soft-edged radial
// mask that expands (ease-out) until the new look covers the territory.

import * as THREE from 'three';

const MAX_PAWNS = 48;
const SLOTS = 4;
const EPS = 0.45;
const MULT_MIN = 0.03;
const STEP = 0.06; // max relative multiplier change per frame
const REVEAL_SECONDS = 0.75;

export function createGround(stage, pawns) {
  const { map, board } = stage;
  const pos = board.land.geometry.attributes.position.array;
  const nrm = board.land.geometry.attributes.normal.array;
  const ox = map.width / 2;
  const oz = map.height / 2;
  const reveals = new Set();

  const makeMaterial = () => new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uMode: { value: 0 }, // 0 hidden, 1 solid, 2 metaball
      uColors: { value: Array.from({ length: SLOTS }, () => new THREE.Color()) },
      uMult: { value: new Array(SLOTS).fill(1) },
      uNeutral: { value: 0 },
      uPawns: { value: Array.from({ length: MAX_PAWNS }, () => new THREE.Vector3()) },
      uCount: { value: 0 },
      uAlpha: { value: 0.52 },
      uCenter: { value: new THREE.Vector2() },
      uReveal: { value: 1e4 }, // mask radius
      uInvert: { value: 0 }, // 1: draw only OUTSIDE the radius (the outgoing look)
    }]),
    vertexShader: VERT, fragmentShader: FRAG, fog: true, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });

  const tiles = map.territories.map((t) => {
    const [f0, f1] = board.topRanges[t.id];
    const positions = new Float32Array(pos.subarray(f0 * 9, f1 * 9));
    for (let i = 1; i < positions.length; i += 3) positions[i] += 0.03;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nrm.subarray(f0 * 9, f1 * 9)), 3));
    const mesh = new THREE.Mesh(geo, makeMaterial());
    mesh.renderOrder = 1;
    mesh.visible = false;
    stage.scene.add(mesh);
    const center = new THREE.Vector2(t.centroid[0] - ox, t.centroid[1] - oz);
    mesh.material.uniforms.uCenter.value.copy(center);
    let radius = 0;
    for (let i = 0; i < positions.length; i += 3) radius = Math.max(radius, Math.hypot(positions[i] - center.x, positions[i + 2] - center.y));
    return { mesh, geo, uniforms: mesh.material.uniforms, center, radius: radius + 0.8, samples: areaSamples(positions, 240), slots: [], targets: [], neutral: 0, mult: new Array(SLOTS).fill(1), neutralMult: 0.05, signature: '' };
  });

  const grey = new THREE.Color();
  const desaturate = (color, sat) => {
    const l = color.r * 0.3 + color.g * 0.59 + color.b * 0.11;
    grey.setRGB(l, l, l);
    return color.lerp(grey, 1 - sat);
  };

  // Called when the game state changes (animate = grow the new look from the centroid).
  function sync(views, players, { animate = true } = {}) {
    views.forEach((v) => {
      const tile = tiles[v.territory];
      const weights = new Map();
      let empty = 0;
      for (const o of v.outcomes) {
        const armies = Object.entries(o.cell).map(([p, n]) => [Number(p), n]);
        if (!armies.length) { empty += o.prob; continue; }
        const total = armies.reduce((a, [, n]) => a + n, 0);
        for (const [p, n] of armies) weights.set(p, (weights.get(p) ?? 0) + o.prob * (armies.length > 1 ? n / total : 1));
      }
      const slots = [...weights.keys()].sort((a, b) => a - b).slice(0, SLOTS);
      const mode = !slots.length ? 0 : slots.length === 1 ? 1 : 2;
      const sat = mode === 1 ? 0.25 + 0.75 * weights.get(slots[0]) : 1;
      const signature = `${mode}|${slots.join(',')}|${sat.toFixed(2)}|${slots.map((p) => players[p].color).join(',')}`;
      if (signature === tile.signature) { tile.targets = slots.map((p) => weights.get(p)); tile.neutral = empty; return; }

      if (animate && tile.signature) startReveal(tile, tile.mesh.visible && tile.uniforms.uMode.value !== 0);
      tile.signature = signature;
      tile.slots = slots;
      tile.targets = slots.map((p) => weights.get(p));
      tile.neutral = empty;
      const u = tile.uniforms;
      slots.forEach((p, i) => desaturate(u.uColors.value[i].set(players[p].color), i === 0 ? sat : 1));
      if (mode === 2 && u.uMode.value !== 2) { tile.mult.fill(1); tile.neutralMult = 0.05; u.uMult.value.fill(1); }
      u.uMode.value = mode;
      tile.mesh.visible = mode !== 0 || [...reveals].some((r) => r.tile === tile);
    });
  }

  // Keep the old look as an outgoing copy that is masked away as the new look grows from the centroid.
  function startReveal(tile, keepOld) {
    for (const r of reveals) if (r.tile === tile) finish(r); // a newer change supersedes a running one
    let old = null;
    if (keepOld) {
      old = new THREE.Mesh(tile.geo, tile.mesh.material.clone());
      old.material.uniforms.uInvert.value = 1;
      old.renderOrder = 1;
      stage.scene.add(old);
    }
    const entry = { tile, old, t: 0 };
    tile.uniforms.uReveal.value = 0;
    tile.mesh.visible = true;
    reveals.add(entry);
  }

  function calibrate(tile, t) {
    const u = tile.uniforms;
    const list = pawns.positions(t).filter((p) => tile.slots.includes(p.owner)).slice(0, MAX_PAWNS);
    list.forEach((p, i) => u.uPawns.value[i].set(p.x, p.z, tile.slots.indexOf(p.owner)));
    u.uCount.value = list.length;
    if (!list.length) return;
    const counts = new Array(SLOTS + 1).fill(0);
    const f = new Array(SLOTS).fill(0);
    for (const [sx, sz] of tile.samples) {
      f.fill(0);
      for (const p of list) f[tile.slots.indexOf(p.owner)] += 1 / ((sx - p.x) ** 2 + (sz - p.z) ** 2 + EPS);
      let best = SLOTS;
      let bestV = tile.neutralMult;
      for (let c = 0; c < tile.slots.length; c++) if (f[c] * tile.mult[c] > bestV) { bestV = f[c] * tile.mult[c]; best = c; }
      counts[best]++;
    }
    const n = tile.samples.length;
    const nudge = (m, target, area) => m * Math.min(1 + STEP, Math.max(1 - STEP, (target / Math.max(0.5 / n, area)) ** 0.25));
    for (let c = 0; c < tile.slots.length; c++) tile.mult[c] = nudge(tile.mult[c], tile.targets[c], counts[c] / n);
    tile.neutralMult = tile.neutral > 0.001 ? nudge(Math.max(tile.neutralMult, 1e-3), tile.neutral, counts[SLOTS] / n) : 0;
    const top = Math.max(...tile.mult.slice(0, tile.slots.length), 1e-9);
    for (let c = 0; c < tile.slots.length; c++) {
      tile.mult[c] = Math.max(MULT_MIN, tile.mult[c] / top);
      u.uMult.value[c] += (tile.mult[c] - u.uMult.value[c]) * 0.25; // eased onto the GPU
    }
    tile.neutralMult = Math.min(20, tile.neutralMult / top);
    u.uNeutral.value += (tile.neutralMult - u.uNeutral.value) * 0.25;
  }

  const easeOut = (k) => 1 - (1 - k) ** 3;
  const off = stage.onFrame((dt) => {
    tiles.forEach((tile, t) => { if (tile.uniforms.uMode.value === 2) calibrate(tile, t); });
    for (const r of reveals) {
      r.t = Math.min(1, r.t + dt / REVEAL_SECONDS);
      const radius = easeOut(r.t) * r.tile.radius;
      r.tile.uniforms.uReveal.value = radius;
      if (r.old) r.old.material.uniforms.uReveal.value = radius;
      if (r.t >= 1) finish(r);
    }
  });

  function finish(r) {
    if (r.old) { stage.scene.remove(r.old); r.old.material.dispose(); }
    r.tile.uniforms.uReveal.value = 1e4;
    r.tile.mesh.visible = r.tile.uniforms.uMode.value !== 0;
    reveals.delete(r);
  }

  return {
    sync,
    dispose() {
      off();
      for (const r of reveals) finish(r);
      for (const t of tiles) { stage.scene.remove(t.mesh); t.geo.dispose(); t.mesh.material.dispose(); }
    },
  };
}

// area-uniform random points over the tile's triangles, in world xz
function areaSamples(positions, count) {
  const tris = [];
  let total = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const ax = positions[i]; const az = positions[i + 2];
    const bx = positions[i + 3]; const bz = positions[i + 5];
    const cx = positions[i + 6]; const cz = positions[i + 8];
    total += Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2;
    tris.push({ ax, az, bx, bz, cx, cz, cum: total });
  }
  const out = [];
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let k = 0; k < count; k++) {
    const r = rnd() * total;
    const t = tris.find((x) => x.cum >= r) ?? tris[tris.length - 1];
    let u = rnd();
    let v = rnd();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    out.push([t.ax + u * (t.bx - t.ax) + v * (t.cx - t.ax), t.az + u * (t.bz - t.az) + v * (t.cz - t.az)]);
  }
  return out;
}

const VERT = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormal = normal;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAG = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform int uMode;
  uniform vec3 uColors[${SLOTS}];
  uniform float uMult[${SLOTS}];
  uniform float uNeutral;
  uniform vec3 uPawns[${MAX_PAWNS}];
  uniform int uCount;
  uniform float uAlpha;
  uniform vec2 uCenter;
  uniform float uReveal;
  uniform int uInvert;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    // radial reveal: soft 0.8-unit edge; the outgoing copy draws the complement
    float d = length(vWorld.xz - uCenter);
    float inside = 1.0 - smoothstep(uReveal - 0.8, uReveal, d);
    float mask = uInvert == 1 ? 1.0 - inside : inside;
    if (mask <= 0.001 || uMode == 0) discard;
    vec3 col = uColors[0];
    float alpha = uAlpha;
    if (uMode == 2) {
      float f[${SLOTS}];
      for (int c = 0; c < ${SLOTS}; c++) f[c] = 0.0;
      for (int i = 0; i < ${MAX_PAWNS}; i++) {
        if (i >= uCount) break;
        vec2 dd = vWorld.xz - uPawns[i].xy;
        int slot = int(uPawns[i].z + 0.5);
        float v = 1.0 / (dot(dd, dd) + ${EPS.toFixed(2)});
        for (int c = 0; c < ${SLOTS}; c++) if (c == slot) f[c] += v;
      }
      float best = uNeutral; float second = 0.0; int bi = -1;
      for (int c = 0; c < ${SLOTS}; c++) {
        float v = f[c] * uMult[c];
        if (v > best) { second = best; best = v; bi = c; } else if (v > second) { second = v; }
      }
      if (bi < 0) { alpha = 0.0; }
      else {
        for (int c = 0; c < ${SLOTS}; c++) if (c == bi) col = uColors[c];
        float edge = (best - second) / (best + second + 1e-5);
        col *= mix(0.55, 1.0, smoothstep(0.02, 0.12, edge));
        alpha = uAlpha + 0.1;
      }
    }
    // a bright leading edge on the growing mask
    float rim = uInvert == 0 && uReveal < 1e3 ? smoothstep(0.8, 0.0, abs(d - uReveal + 0.4)) : 0.0;
    float light = 0.8 + 0.2 * max(dot(normalize(vNormal), normalize(vec3(-0.5, 0.8, 0.3))), 0.0);
    gl_FragColor = vec4(mix(col * light, vec3(1.0), rim * 0.5), alpha * mask);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;
