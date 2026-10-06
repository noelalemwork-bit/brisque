// Worldlines on the map, drawn from the engine's causal branch history (state.trails / state.heads):
// every live branch shows each move it actually made as a glowing tube from centroid to centroid.
// Paths hug the terrain (clearance sampled along the way) and arc higher for longer hops. Branch 0 is
// solid, branch 1 dashed, and brightness follows the branch's probability. Tubes that share a route
// (branches of one thread that reconverged, or different threads) wind around each other as helices
// in placement order, so shared roads read as braids. Pulsing rings mark coincidences (both branches
// of a thread on one territory); a halo marks a branch that stayed put. New segments draw on (ease-out),
// stripes stream along them, and they fade out when their branch collapses or the thread resolves.

import * as THREE from 'three';
import { branchProb } from '../../shared/game/worlds.js';

const GROW = 0.7;
const FADE = 0.5;

export function createWorldlines(stage, pawns) {
  const group = new THREE.Group();
  stage.scene.add(group);
  const items = new Map(); // key -> { mesh, uniforms, state: 'grow'|'live'|'fade', t, kind }
  const { regions, groundY } = pawns;

  function pathPoints(from, to, phase, radius) {
    const [x0, z0] = regions[from].c;
    const [x1, z1] = regions[to].c;
    const len = Math.hypot(x1 - x0, z1 - z0) || 1;
    const steps = Math.max(12, Math.ceil(len / 0.35));
    const arc = 1.6 + len * 0.1;
    const dx = (x1 - x0) / len;
    const dz = (z1 - z0) / len;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const s = i / steps;
      const x = x0 + (x1 - x0) * s;
      const z = z0 + (z1 - z0) * s;
      let ground = groundY(x, z);
      for (const d of [-0.6, 0.6]) ground = Math.max(ground, groundY(x + dx * d, z + dz * d));
      const lift = 0.9 + arc * Math.sin(Math.PI * s);
      const r = radius * Math.sin(Math.PI * s); // helix pinned at both centroids
      const ang = phase + s * len * 1.1;
      pts.push(new THREE.Vector3(x - dz * Math.cos(ang) * r, ground + lift + Math.sin(ang) * r, z + dx * Math.cos(ang) * r));
    }
    return pts;
  }

  function tube(points, color, dashed, strength) {
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), points.length * 2, 0.21, 8, false);
    const uniforms = {
      uColor: { value: new THREE.Color(color) }, uProgress: { value: 0 }, uAlpha: { value: 1 }, uTime: { value: 0 },
      uDash: { value: dashed ? 1 : 0 }, uStrength: { value: strength },
    };
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false }));
    mesh.renderOrder = 3;
    group.add(mesh);
    return { mesh, uniforms };
  }

  function ring(t, color, radius, strength) {
    const [x, z] = regions[t].c;
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.12, 8, 40).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }),
    );
    mesh.position.set(x, groundY(x, z) + 0.7, z);
    mesh.renderOrder = 3;
    group.add(mesh);
    return { mesh, uniforms: null, strength };
  }

  function sync(state) {
    const live = state.qubits.filter((q) => q.status === 'live');
    const wanted = new Map();
    // every travelled edge of every live branch, grouped by route so shared routes can braid
    const routes = new Map();
    for (const q of live) {
      for (const b of [0, 1]) {
        const pb = branchProb(state.worlds, q.id, b);
        for (const e of state.trails[`${q.id}:${b}`] ?? []) {
          const route = e.from < e.to ? `${e.from}-${e.to}` : `${e.to}-${e.from}`;
          if (!routes.has(route)) routes.set(route, []);
          const list = routes.get(route);
          if (!list.some((x) => x.q === q.id && x.b === b && x.from === e.from)) list.push({ q: q.id, b, from: e.from, to: e.to, owner: q.owner, p: pb });
        }
      }
    }
    for (const [route, list] of routes) {
      list.sort((x, y) => x.q - y.q || x.b - y.b); // placement order sets the helix phase
      list.forEach((e, k) => {
        const key = `e${e.q}:${e.b}:${e.from}>${e.to}|${k}/${list.length}`;
        wanted.set(key, { kind: 'edge', ...e, phase: (2 * Math.PI * k) / list.length + e.q * 0.7, radius: list.length > 1 ? 0.5 : 0.1, route });
      });
    }
    for (const q of live) {
      const h0 = state.heads[`${q.id}:0`] ?? [];
      const h1 = state.heads[`${q.id}:1`] ?? [];
      for (const t of h0.filter((t) => h1.includes(t))) wanted.set(`c${q.id}@${t}`, { kind: 'coincide', t, owner: q.owner, p: 1 });
      for (const b of [0, 1]) {
        const hb = b ? h1 : h0;
        const trail = state.trails[`${q.id}:${b}`] ?? [];
        if (hb.includes(q.from) && !trail.some((e) => e.to === q.from)) wanted.set(`s${q.id}:${b}`, { kind: 'stay', t: q.from, owner: q.owner, p: branchProb(state.worlds, q.id, b) });
      }
    }

    for (const [key, item] of items) if (!wanted.has(key) && item.state !== 'fade') { item.state = 'fade'; item.t = 0; }
    for (const [key, w] of wanted) {
      const color = state.players[w.owner].color;
      const existing = items.get(key);
      if (existing) {
        if (existing.state === 'fade') { existing.state = 'live'; existing.t = 0; }
        if (existing.uniforms) existing.uniforms.uStrength.value = 0.35 + 0.65 * w.p;
        existing.strength = 0.35 + 0.65 * w.p;
        continue;
      }
      let made;
      if (w.kind === 'edge') made = tube(pathPoints(w.from, w.to, w.phase, w.radius), color, w.b === 1, 0.35 + 0.65 * w.p);
      else made = ring(w.t, w.kind === 'coincide' ? '#f2ead8' : color, w.kind === 'coincide' ? 2.2 : 1.5, 0.35 + 0.65 * w.p);
      items.set(key, { ...made, kind: w.kind, state: 'grow', t: 0, strength: 0.35 + 0.65 * w.p });
    }
  }

  const easeOut = (k) => 1 - (1 - k) ** 3;
  const off = stage.onFrame((dt, now) => {
    for (const [key, it] of items) {
      it.t += dt;
      const grow = it.state === 'grow' ? easeOut(Math.min(1, it.t / GROW)) : 1;
      const fade = it.state === 'fade' ? 1 - Math.min(1, it.t / FADE) : 1;
      if (it.state === 'grow' && it.t >= GROW) it.state = 'live';
      if (it.uniforms) {
        it.uniforms.uTime.value = now;
        it.uniforms.uProgress.value = grow;
        it.uniforms.uAlpha.value = fade;
      } else {
        // rings: pop in with a pulse, breathe while live
        const pulse = it.kind === 'coincide' ? 1 + 0.12 * Math.sin(now * 4) : 1;
        it.mesh.scale.setScalar((0.6 + 0.4 * grow) * pulse);
        it.mesh.material.opacity = 0.75 * it.strength * grow * fade;
      }
      if (it.state === 'fade' && it.t >= FADE) {
        group.remove(it.mesh);
        it.mesh.geometry.dispose();
        it.mesh.material.dispose();
        items.delete(key);
      }
    }
  });

  return {
    sync,
    dispose() { off(); stage.scene.remove(group); for (const it of items.values()) { it.mesh.geometry.dispose(); it.mesh.material.dispose(); } },
  };
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalV;
  void main() {
    vUv = uv;
    vNormalV = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uProgress;
  uniform float uAlpha;
  uniform float uTime;
  uniform float uDash;
  uniform float uStrength;
  varying vec2 vUv;
  varying vec3 vNormalV;
  void main() {
    if (vUv.x > uProgress) discard;
    if (uDash > 0.5 && fract(vUv.x * 9.0) > 0.62) discard; // branch 1: dashed
    float stripe = smoothstep(0.35, 0.5, fract(vUv.x * 14.0 - uTime * 1.2)) * 0.35;
    float head = uProgress < 1.0 ? smoothstep(0.06, 0.0, uProgress - vUv.x) : 0.0;
    float rim = pow(1.0 - abs(vNormalV.z), 2.0);
    vec3 col = uColor * (0.55 + 0.45 * uStrength + stripe) + vec3(1.0) * (head * 0.8 + rim * 0.25);
    gl_FragColor = vec4(col, (0.45 + 0.5 * uStrength + rim * 0.1) * uAlpha);
    #include <colorspace_fragment>
  }
`;
