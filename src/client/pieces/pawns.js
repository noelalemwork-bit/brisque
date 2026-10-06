// 3D troop pieces: one chess-pawn per troop, drawn with instanced meshes.
//
// Certain territory: pawns spring into a non-overlapping sunflower cluster at the centroid.
// Uncertain territory: pawns are particles wandering inside the territory's smooth cell polygon,
// bouncing off its walls and each other, hopping. The player colour always stays saturated.
//
// Two independent cues (a pawn can carry both):
//   translucency = level of splitting: opacity follows the probability of the layer the troop belongs
//     to (certain = opaque, 50% clearly see-through, 25% / 12.5% fainter but readable). Translucent pawns
//     go on their own instanced mesh (depthWrite off, sorted back to front, no shadow).
//   iridescence = a contested territory: every pawn in a territory where two or more armies are (or may
//     be, in any branch) gets the film, certain or not. Alone in uncertain land = no film.
//
// Stability: fixed substeps with a dt clamp, capped positional correction, speed regulated toward a
// cruise speed with a hard cap, wander as a bounded lateral force, and a final containment clamp.
//
// Motion language (all eased): drop-in with gravity + squash, pop-in scale (ease-out-back), take-off
// crouch then an arc with a travel tilt and landing squash, and three exits on a separate translucent
// instanced mesh: blast (bomb losers: outward, bending, spinning, fading), evaporate (collapsed away
// by entanglement: drift up, spin, fade) and shrink (ease-in-back).
//
// Contested pawns shimmer with the Moth Entanglement Shader (entanglement-shader-v1 R/T lookup tables,
// prerendered to public/generated/), sampled at |N.V| with a noise-animated normal so the colour bands
// flow over the piece; the facing core keeps the player's colour, glancing angles and the rim go full
// film. The shimmer (attribute aIri) and the opacity (aAlpha) ease in and out per pawn.

import * as THREE from 'three';
import { vfxTexture } from '../vfx/sources.js';
import { ENTANGLE_GLSL, ENTANGLE_LUT_ROWS } from '../vfx/entangle.js';

const MAX = 1500;
const CAP = 16; // pawns drawn per army per territory; the pill shows the real number
const R_CLUSTER = 0.52;
const R_BOUNCE = 0.36; // smaller while bouncing so armies intermingle
const SPEED = 1.9;
const SUBSTEPS = 3;

// opacity falls off with each halving of the layer probability: 50% → 0.88, 25% → 0.76, 12.5% → 0.64, floor 0.4
const ALPHA_STEP = 0.12;
const ALPHA_MIN = 0.4;
const opacity = (prob) => Math.max(ALPHA_MIN, Math.min(1, 1 + ALPHA_STEP * Math.log2(Math.max(1e-3, prob))));

const easeOutBack = (k) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;
const easeInBack = (k) => 2.70158 * k ** 3 - 1.70158 * k ** 2;
const easeInOut = (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);

export function createPawns(stage) {
  const { map, board } = stage;
  const ox = map.width / 2;
  const oz = map.height / 2;

  // --- geometry + instanced meshes (plain, contested film, translucent split, fading exits) ------------
  // the pawn profile through a Catmull-Rom spline; film / translucent pawns get a denser, smoother lathe
  // so the film bands flow over the curvature, plain opaque pawns a light one (most of the board)
  const spline = new THREE.SplineCurve([[0, 0], [0.34, 0], [0.34, 0.08], [0.26, 0.14], [0.17, 0.2], [0.12, 0.42], [0.2, 0.46], [0.2, 0.5], [0.1, 0.54], [0.17, 0.6], [0.19, 0.7], [0.14, 0.8], [0, 0.84]]
    .map(([x, y]) => new THREE.Vector2(x, y)));
  const lathe = (points, segments) => new THREE.LatheGeometry(spline.getPoints(points).map((v) => new THREE.Vector2(Math.max(0, v.x), v.y)), segments).scale(1.9, 2.1, 1.9);
  const instanced = (geometry, material) => {
    const m = new THREE.InstancedMesh(geometry, material, MAX);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    m.frustumCulled = false;
    m.count = 0;
    return m;
  };
  const geo = lathe(20, 12);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const mesh = instanced(geo, mat);
  mesh.castShadow = true;

  const geoHi = lathe(32, 22);
  const iriAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 2), 2); // (shimmer 0..1, seed)
  geoHi.setAttribute('aIri', iriAttr);
  const lut = vfxTexture('lut:peaked');
  const time = { value: 0 };
  const matHi = shimmer(new THREE.MeshLambertMaterial({ color: 0xffffff }), lut, time);
  const meshHi = instanced(geoHi, matHi);
  meshHi.castShadow = true;

  // translucent live pawns (a split layer below 100%): own mesh, no depth write, sorted, no shadow
  const geoT = geoHi.clone();
  const tAlpha = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
  const tIri = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 2), 2);
  geoT.setAttribute('aAlpha', tAlpha);
  geoT.setAttribute('aIri', tIri);
  const matT = shimmer(new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, depthWrite: false }), lut, time, true);
  const meshT = instanced(geoT, matT);

  const fadeGeo = geoHi.clone();
  const alphaAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
  const fadeIri = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 2), 2);
  fadeGeo.setAttribute('aAlpha', alphaAttr);
  fadeGeo.setAttribute('aIri', fadeIri);
  const fadeMat = shimmer(new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, depthWrite: false }), lut, time, true);
  const fadeMesh = instanced(fadeGeo, fadeMat);
  stage.scene.add(mesh, meshHi, meshT, fadeMesh);

  // --- per-territory bounds (world xz), inset so pawns stay visibly inside ----------------------------
  const regions = map.territories.map((t) => {
    const c = [t.centroid[0] - ox, t.centroid[1] - oz];
    let poly = t.hull.map(([x, y]) => [x - ox, y - oz]).map(([x, y]) => [c[0] + (x - c[0]) * 0.82, c[1] + (y - c[1]) * 0.82]);
    if (signedArea(poly) < 0) poly = poly.reverse();
    const edges = poly.map((a, i) => {
      const b = poly[(i + 1) % poly.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return { a, n: [-(b[1] - a[1]) / len, (b[0] - a[0]) / len] }; // inward normal (CCW)
    });
    return { c, poly, edges };
  });

  // ground height from a grid sampled once (heightAt memoises, so never feed it continuous positions)
  const GX = 160;
  const GZ = Math.round((GX * map.height) / map.width);
  const grid = new Float32Array((GX + 1) * (GZ + 1));
  for (let j = 0; j <= GZ; j++) for (let i = 0; i <= GX; i++) grid[j * (GX + 1) + i] = board.heightAt((i / GX) * map.width, (j / GZ) * map.height);
  const groundY = (wx, wz) => {
    const fx = Math.min(GX - 1e-6, Math.max(0, ((wx + ox) / map.width) * GX));
    const fz = Math.min(GZ - 1e-6, Math.max(0, ((wz + oz) / map.height) * GZ));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const g = (a, b) => grid[b * (GX + 1) + a];
    return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - v) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * v;
  };

  // --- state ------------------------------------------------------------------------------------------
  let pawns = []; // live
  let exits = []; // leaving (drawn on the fading mesh)
  const modes = new Array(map.territories.length).fill('cluster');
  const baseColor = new Map();
  const presence = new Map(); // `${t}:${owner}` -> chance that army is there
  const contested = new Array(map.territories.length).fill(false); // a battle in any branch
  let nextId = 0;
  let clock = 0;

  const insidePoint = (t) => {
    const { c, poly } = regions[t];
    for (let k = 0; k < 20; k++) {
      const a = poly[Math.floor(Math.random() * poly.length)];
      const s = Math.random() * 0.8;
      const p = [c[0] + (a[0] - c[0]) * s, c[1] + (a[1] - c[1]) * s];
      if (contains(poly, p)) return p;
    }
    return [...c];
  };

  function makePawn(t, owner, x, z) {
    const angle = Math.random() * Math.PI * 2;
    return { id: nextId++, t, owner, x, z, vx: Math.cos(angle) * SPEED, vz: Math.sin(angle) * SPEED, y: 0, vy: 0, phase: Math.random() * 6, age: 0, squash: 0, wander: Math.random() * 100, tilt: 0 };
  }

  function exit(p, kind, from) {
    const e = { ...p, kind, t0: clock, spin: (Math.random() - 0.5) * 14, bend: (Math.random() - 0.5) * 5 };
    if (kind === 'blast') {
      const dx = p.x - from[0];
      const dz = p.z - from[1];
      const d = Math.hypot(dx, dz) || 1;
      const power = 6 + Math.random() * 4;
      e.vx = (dx / d) * power;
      e.vz = (dz / d) * power;
      e.vy = 7 + Math.random() * 4;
    }
    exits.push(e);
  }

  // Match pawns to a board view. `removal(t)` picks the exit style for pawns that must go.
  function sync(views, players, { removal = () => 'shrink' } = {}) {
    for (const p of players) baseColor.set(p.id, new THREE.Color(p.color));
    const keep = [];
    const byT = new Map();
    for (const p of pawns) {
      if (p.fly) { keep.push(p); continue; }
      if (!byT.has(p.t)) byT.set(p.t, []);
      byT.get(p.t).push(p);
    }
    views.forEach((v) => {
      const t = v.territory;
      modes[t] = v.certain ? 'cluster' : 'bounce';
      const want = new Map();
      for (const o of v.outcomes) for (const [p, n] of Object.entries(o.cell)) want.set(Number(p), Math.max(want.get(Number(p)) ?? 0, Math.min(CAP, n)));
      contested[t] = (v.contested ?? v.outcomes.reduce((a, o) => a + (o.contested ? o.prob : 0), 0)) > 1e-6;
      for (const [p, pres] of Object.entries(v.presence)) presence.set(`${t}:${p}`, pres);
      // per pawn: the k-th pawn of an army belongs to the layer holding its k-th troop
      const layerProb = (owner, k) => {
        const ls = v.layers?.[owner] ?? [];
        let acc = 0;
        for (const l of ls) { acc += l.n; if (k < acc) return l.prob; }
        return null;
      };
      const here = byT.get(t) ?? [];
      const owners = new Set([...want.keys(), ...here.map((p) => p.owner)]);
      for (const owner of owners) {
        const mine = here.filter((p) => p.owner === owner).sort((a, b) => a.id - b.id);
        const n = want.get(owner) ?? 0;
        mine.slice(0, n).forEach((p, k) => { p.prob = layerProb(owner, k); keep.push(p); });
        mine.slice(n).forEach((p) => exit(p, removal(t), regions[t].c));
        for (let k = mine.length; k < n; k++) {
          const [x, z] = insidePoint(t);
          const p = makePawn(t, owner, x, z);
          p.y = 3 + Math.random() * 2.5; // drop in
          p.prob = layerProb(owner, k);
          p.alpha = opacity(p.prob ?? presence.get(`${t}:${owner}`) ?? 1); // born at its opacity
          keep.push(p);
        }
      }
    });
    pawns = keep;
  }

  // Fly n pawns of `owner` between territories (cosmetic lead-in; sync() reconciles counts).
  function transfer(from, to, owner, n, { copy = false, seconds = 0.8 } = {}) {
    n = Math.min(n, CAP);
    const src = pawns.filter((p) => p.t === from && p.owner === owner && !p.fly);
    for (let k = 0; k < n; k++) {
      let p = src[k];
      if (!p || copy) {
        const base = p ?? makePawn(from, owner, ...regions[from].c);
        p = makePawn(from, owner, base.x, base.z);
        p.age = 1;
        pawns.push(p);
      }
      const [tx, tz] = insidePoint(to);
      p.fly = { t: -k * 0.045 - 0.09, seconds, x0: p.x, z0: p.z, x1: tx, z1: tz, to }; // 0.09 s crouch first
      p.squash = 0.35;
    }
    return new Promise((resolve) => setTimeout(resolve, (seconds + 0.09 + n * 0.045) * 1000));
  }

  function spawn(t, owner, n) {
    for (let k = 0; k < Math.min(n, CAP); k++) {
      const [x, z] = insidePoint(t);
      const p = makePawn(t, owner, x, z);
      p.y = 4 + k * 0.35;
      pawns.push(p);
    }
  }

  // bomb impact: survivors get knocked outward and hop
  function shockwave(t, strength = 6) {
    const { c } = regions[t];
    for (const p of pawns) {
      if (p.t !== t || p.fly) continue;
      const dx = p.x - c[0];
      const dz = p.z - c[1];
      const d = Math.hypot(dx, dz) || 1;
      p.vx += (dx / d) * strength;
      p.vz += (dz / d) * strength;
      p.vy = 6;
      p.y = Math.max(p.y, 0.01);
      p.squash = 0.45;
    }
  }

  // --- simulation ------------------------------------------------------------------------------------
  function stepTerritory(t, list, dt) {
    const region = regions[t];
    if (modes[t] === 'cluster') {
      list.sort((a, b) => a.owner - b.owner || a.id - b.id);
      list.forEach((p, i) => {
        const r = 0.95 * Math.sqrt(i + 0.3);
        const a = i * 2.39996;
        const tx = region.c[0] + Math.cos(a) * r;
        const tz = region.c[1] + Math.sin(a) * r;
        const k = 60; // critically damped spring into the slot
        p.vx += ((tx - p.x) * k - p.vx * 2 * Math.sqrt(k)) * dt;
        p.vz += ((tz - p.z) * k - p.vz * 2 * Math.sqrt(k)) * dt;
        p.x += p.vx * dt;
        p.z += p.vz * dt;
      });
      return;
    }
    const h = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) {
      for (const p of list) {
        // wander: a smoothly varying lateral force, plus a gentle pull toward the middle
        p.wander += h * (0.7 + (p.id % 7) * 0.08);
        const sp = Math.hypot(p.vx, p.vz) || 1e-6;
        const lateral = Math.sin(p.wander * 2.3) + 0.5 * Math.sin(p.wander * 5.1 + p.id);
        const vx = p.vx;
        const vz = p.vz;
        p.vx += (-vz / sp) * lateral * 3.2 * h + (region.c[0] - p.x) * 0.35 * h;
        p.vz += (vx / sp) * lateral * 3.2 * h + (region.c[1] - p.z) * 0.35 * h;
        p.x += p.vx * h;
        p.z += p.vz * h;
      }
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          let dx = b.x - a.x;
          let dz = b.z - a.z;
          let d = Math.hypot(dx, dz);
          if (d >= 2 * R_BOUNCE) continue;
          if (d < 1e-6) { dx = Math.random() - 0.5; dz = Math.random() - 0.5; d = Math.hypot(dx, dz); }
          const nx = dx / d;
          const nz = dz / d;
          const push = Math.min(0.08, (2 * R_BOUNCE - d) / 2);
          a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
          const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
          if (rel < 0) { a.vx += rel * nx; a.vz += rel * nz; b.vx -= rel * nx; b.vz -= rel * nz; }
        }
      }
      for (const p of list) {
        for (const { a, n } of region.edges) {
          const dist = (p.x - a[0]) * n[0] + (p.z - a[1]) * n[1];
          if (dist < R_BOUNCE) {
            p.x += n[0] * (R_BOUNCE - dist);
            p.z += n[1] * (R_BOUNCE - dist);
            const vn = p.vx * n[0] + p.vz * n[1];
            if (vn < 0) { p.vx -= 2 * vn * n[0]; p.vz -= 2 * vn * n[1]; }
          }
        }
        if (!contains(region.poly, [p.x, p.z])) { p.x = region.c[0]; p.z = region.c[1]; }
      }
    }
    for (const p of list) {
      const sp = Math.hypot(p.vx, p.vz) || 1e-6;
      const k = Math.min(1 + (SPEED / sp - 1) * Math.min(1, 2 * dt), 5 / sp);
      p.vx *= k;
      p.vz *= k;
    }
  }

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const white = new THREE.Color('#fff');
  // the owner colour stays fully saturated: opacity (split level) and the film (battle) carry the quantum cues
  const colorFor = (p) => col.copy(baseColor.get(p.owner) ?? white);
  const translucent = []; // reused per frame
  const camPos = new THREE.Vector3();

  function update(dt) {
    dt = Math.min(dt, 1 / 30);
    clock += dt;
    const byT = new Map();
    for (const p of pawns) {
      if (p.fly) continue;
      if (!byT.has(p.t)) byT.set(p.t, []);
      byT.get(p.t).push(p);
    }
    for (const [t, list] of byT) stepTerritory(t, list, dt);

    let n = 0; // opaque, plain (light mesh)
    let h = 0; // opaque, contested (smooth film mesh)
    translucent.length = 0;
    const ease = Math.min(1, dt * 3);
    for (const p of pawns) {
      p.age += dt;
      let tiltX = 0;
      let tiltZ = 0;
      if (p.fly) {
        const f = p.fly;
        f.t += dt;
        if (f.t < 0) { p.squash = Math.max(p.squash, 0.3); } // crouch before take-off
        const k = Math.max(0, Math.min(1, f.t / f.seconds));
        const e = easeInOut(k);
        const dist = Math.hypot(f.x1 - f.x0, f.z1 - f.z0);
        p.x = f.x0 + (f.x1 - f.x0) * e;
        p.z = f.z0 + (f.z1 - f.z0) * e;
        p.y = Math.sin(e * Math.PI) * (2.2 + dist * 0.12);
        // lean into the direction of travel, strongest mid-flight
        const lean = Math.sin(k * Math.PI) * 0.45;
        tiltX = ((f.z1 - f.z0) / (dist || 1)) * lean;
        tiltZ = (-(f.x1 - f.x0) / (dist || 1)) * lean;
        if (k >= 1) { p.t = f.to; p.fly = null; p.y = 0; p.squash = 0.5; }
      } else if (p.y > 0 || p.vy > 0) {
        p.vy -= 30 * dt;
        p.y = Math.max(0, p.y + p.vy * dt);
        if (p.y === 0) { p.squash = Math.max(p.squash, Math.min(0.5, Math.abs(p.vy) * 0.04)); p.vy = 0; }
      }
      p.squash *= Math.max(0, 1 - dt * 8);
      if (n + h + translucent.length >= MAX) continue;
      const bouncing = modes[p.t] === 'bounce' && !p.fly;
      p.phase += dt * (bouncing ? 9 : 2.2);
      const hop = bouncing ? Math.abs(Math.sin(p.phase)) * 0.5 : Math.sin(p.phase) * 0.03;
      const pop = easeOutBack(Math.min(1, p.age / 0.4));
      const sq = p.squash;
      dummy.position.set(p.x, groundY(p.x, p.z) + p.y + hop, p.z);
      dummy.scale.set(pop * (1 + sq * 0.6), pop * (1 - sq), pop * (1 + sq * 0.6));
      dummy.rotation.set(tiltX, 0, tiltZ + (bouncing ? Math.atan2(p.vx, 6) * 0.3 : 0));
      dummy.updateMatrix();
      // film = contested territory (a battle in any branch); opacity = this troop's layer probability.
      // Both eased; a pawn stays on the film mesh until its shimmer has faded out
      const battle = contested[p.t] && !p.fly;
      p.iri = (p.iri ?? 0) + ((battle ? 1 : 0) - (p.iri ?? 0)) * ease;
      const want = opacity(p.prob ?? presence.get(`${p.t}:${p.owner}`) ?? 1);
      p.alpha = (p.alpha ?? want) + (want - (p.alpha ?? want)) * ease;
      if (p.alpha < 0.995) {
        (p.m ??= new THREE.Matrix4()).copy(dummy.matrix);
        translucent.push(p);
      } else if (battle || p.iri > 0.01) {
        meshHi.setMatrixAt(h, dummy.matrix);
        meshHi.setColorAt(h, colorFor(p));
        iriAttr.setXY(h, p.iri, (p.id * 0.6180339) % 1);
        h++;
      } else {
        mesh.setMatrixAt(n, dummy.matrix);
        mesh.setColorAt(n, colorFor(p));
        n++;
      }
    }
    // translucent pawns back to front (no depth write), so nearer ones blend over farther ones
    if (stage.camera) {
      camPos.setFromMatrixPosition(stage.camera.matrixWorld);
      for (const p of translucent) p.depth = (p.m.elements[12] - camPos.x) ** 2 + (p.m.elements[13] - camPos.y) ** 2 + (p.m.elements[14] - camPos.z) ** 2;
      translucent.sort((a, b) => b.depth - a.depth);
    }
    translucent.forEach((p, i) => {
      meshT.setMatrixAt(i, p.m);
      meshT.setColorAt(i, colorFor(p));
      tAlpha.setX(i, p.alpha);
      tIri.setXY(i, p.iri, (p.id * 0.6180339) % 1);
    });
    mesh.count = n;
    meshHi.count = h;
    meshT.count = translucent.length;
    for (const m of [mesh, meshHi, meshT]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    iriAttr.needsUpdate = true;
    tAlpha.needsUpdate = true;
    tIri.needsUpdate = true;
    time.value = clock;

    // exits
    let m = 0;
    exits = exits.filter((e) => {
      const age = clock - e.t0;
      const life = e.kind === 'blast' ? 1.15 : e.kind === 'evaporate' ? 0.9 : 0.35;
      const k = age / life;
      if (k >= 1 || m >= MAX) return false;
      let alpha = 1;
      let scale = 1;
      if (e.kind === 'blast') {
        // ballistic with a sideways bend, tumbling, fading in the second half
        e.vx += -e.vz * e.bend * 0.1 * dt;
        e.vz += e.vx * e.bend * 0.1 * dt;
        e.vy -= 22 * dt;
        e.x += e.vx * dt;
        e.z += e.vz * dt;
        e.y = Math.max(-0.5, e.y + e.vy * dt);
        alpha = 1 - Math.max(0, (k - 0.35) / 0.65) ** 1.5;
      } else if (e.kind === 'evaporate') {
        e.y += dt * (1.2 + k * 3);
        alpha = 1 - k * k;
        scale = 1 - 0.3 * k;
      } else {
        scale = Math.max(0, 1 - easeInBack(k));
        alpha = 1 - k * 0.5;
      }
      dummy.position.set(e.x, groundY(e.x, e.z) + e.y, e.z);
      dummy.scale.setScalar(scale);
      dummy.rotation.set(e.spin * age * 0.6, e.spin * age, e.spin * age * 0.3);
      dummy.updateMatrix();
      fadeMesh.setMatrixAt(m, dummy.matrix);
      fadeMesh.setColorAt(m, colorFor(e));
      alphaAttr.setX(m, alpha * (e.alpha ?? 1));
      fadeIri.setXY(m, e.iri ?? 0, (e.id * 0.6180339) % 1);
      m++;
      return true;
    });
    fadeMesh.count = m;
    fadeMesh.instanceMatrix.needsUpdate = true;
    fadeMesh.instanceColor.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    fadeIri.needsUpdate = true;
  }

  const off = stage.onFrame((dt) => update(dt));

  return {
    sync, transfer, spawn, shockwave, regions, groundY,
    positions(t) { return pawns.filter((p) => p.t === t && !p.fly).map((p) => ({ x: p.x, z: p.z, owner: p.owner })); },
    dispose() { off(); stage.scene.remove(mesh, meshHi, meshT, fadeMesh); geo.dispose(); geoHi.dispose(); geoT.dispose(); fadeGeo.dispose(); mat.dispose(); matHi.dispose(); matT.dispose(); fadeMat.dispose(); },
  };
}

// Entanglement-shader film on a Lambert material (keeps lights, VSM shadows and fog). The film colour
// comes from the engine's R/T LUTs (entanglement-shader-v1) at |N.V|, but N is the shading normal
// wobbled by slow, domain-warped 3D noise (object space, seeded per pawn), so |N.V| sweeps across the
// LUT and the colour bands flow over the piece: the motion is what separates it from plain diffuse.
// Fresnel-like split: the facing core keeps the player colour (lightly tinted by the film), glancing
// angles turn into a saturated film that ignores the albedo, plus an additive film rim and a faint glow.
// Zoomed out (few pixels per pawn, measured with fwidth) the bands get broader, the glow stronger and a
// slow per-pawn hue drift keeps even a handful of pixels visibly shimmering.
function shimmer(material, lut, time, fade = false) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uLut = lut.tex;
    sh.uniforms.uLutOn = lut.ready;
    sh.uniforms.uTime = time;
    sh.vertexShader = `attribute vec2 aIri;\nvarying vec2 vIri;\nvarying vec3 vObj;\n${fade ? 'attribute float aAlpha;\nvarying float vAlpha;\n' : ''}`
      + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\nvIri = aIri;\nvObj = position;\n${fade ? 'vAlpha = aAlpha;' : ''}`);
    sh.fragmentShader = `uniform sampler2D uLut;\nuniform float uLutOn;\nuniform float uTime;\nvarying vec2 vIri;\nvarying vec3 vObj;\nfloat gFilmEdge = 0.0;\n${fade ? 'varying float vAlpha;\n' : ''}${ENTANGLE_GLSL}${FILM_GLSL}`
      + sh.fragmentShader
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          if (vIri.x > 0.002 && uLutOn > 0.5) {
            float k = vIri.x;
            float seed = vIri.y;
            vec3 V = normalize(vViewPosition);
            // pawn height on screen in pixels (object units per pixel, from derivatives)
            float pawnPx = SHIMMER_HEIGHT / max(length(fwidth(vObj)), 1e-4);
            float near = smoothstep(SHIMMER_FAR_PX, SHIMMER_NEAR_PX, pawnPx); // 0 zoomed out .. 1 close
            float t = uTime * SHIMMER_SPEED;
            // domain-warped noise field -> normal offset (slow; broader when far so it does not alias)
            vec3 q = vObj * mix(SHIMMER_SCALE_FAR, SHIMMER_SCALE, near) + seed * vec3(37.0, 11.0, 23.0);
            vec3 w = vec3(vnoise(q + vec3(0.0, t * 0.21, t * 0.13)), vnoise(q + vec3(5.2, 1.3 - t * 0.17, 2.8)), vnoise(q + vec3(9.1, 4.7, 7.3 + t * 0.19))) - 0.5;
            vec3 qw = q + w * SHIMMER_WARP;
            vec3 g = vec3(vnoise(qw + vec3(0.0, t * 0.15, 0.0)), vnoise(qw + vec3(3.1, 0.0, t * 0.12)), vnoise(qw + vec3(0.0, 6.7 - t * 0.11, 1.9))) - 0.5;
            float cosG = abs(dot(normal, V));                          // geometric facing, for the Fresnel split
            vec3 nF = normalize(normal + g * SHIMMER_WOBBLE * k);      // film normal: strongly animated
            normal = normalize(normal + g * SHIMMER_WOBBLE_LIGHT * k); // lighting gets a hint of the same motion
            float cosT = abs(dot(nF, V));
            // fewer, broader bands when far; slow per-pawn hue drift as a film-phase offset
            float thick = mix(SHIMMER_THICK_FAR, SHIMMER_THICK, near) + SHIMMER_DRIFT * (w.x + g.y);
            // oil-slick stripes: phase climbs the piece (bands wrap round it), warped by the noise, scrolling
            float phase = seed + t * SHIMMER_HUE + 0.35 * sin(t * 0.7 + seed * 6.2831)
              + (vObj.y * mix(SHIMMER_STRIPE_FAR, SHIMMER_STRIPE, near) - t * SHIMMER_SCROLL) + w.y * SHIMMER_STRIPE_WARP;
            vec3 R; vec3 T;
            filmRT(uLut, cosT, thick, phase, R, T);
            vec3 tint = entangleTint(R * 0.8 + T * 0.2, mix(SHIMMER_GAIN_FAR, SHIMMER_GAIN, near));
            float lum = max(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 0.25);
            // core: the player colour with the film's bands multiplied in and its hue pushed (stays in the
            // owner's family); edge: the film itself, saturated, no albedo (grey base + LUT offsets)
            vec3 core = clamp(diffuseColor.rgb * mix(vec3(1.0), tint, SHIMMER_CORE_TINT) + (tint - 1.0) * lum * SHIMMER_PUSH, 0.0, 1.0);
            vec3 pure = clamp(mix(vec3(max(lum, SHIMMER_FILM_L)), diffuseColor.rgb * 1.2, SHIMMER_PURE_HUE) + (tint - 1.0) * SHIMMER_FILM_AMP, 0.0, 1.0);
            float pl = dot(pure, vec3(0.299, 0.587, 0.114));
            pure = clamp(mix(vec3(pl), pure, SHIMMER_SAT), 0.0, 1.0);
            float F = pow(1.0 - cosG, SHIMMER_FRESNEL);                // 0 facing core .. 1 silhouette
            diffuseColor.rgb = mix(diffuseColor.rgb, mix(core, pure, F), k * mix(SHIMMER_CORE, SHIMMER_EDGE, F));
            // additive film: only its saturated peaks emit (no grey wash), a rim, and more glow when far
            vec3 peak = max(pure - vec3(pl) * 0.75, 0.0) * 2.0;
            float glow = SHIMMER_RIM * pow(1.0 - cosT, 2.5) + SHIMMER_GLOW * mix(SHIMMER_FAR_GLOW, 1.0, near);
            totalEmissiveRadiance += peak * glow * k;
            gFilmEdge = F * k; // a translucent piece's film rim stays visible, like a soap bubble
          }`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>\n${fade ? 'gl_FragColor.a = mix(gl_FragColor.a * vAlpha, 1.0, gFilmEdge * 0.6 * (1.0 - vAlpha));' : ''}`);
  };
  material.customProgramCacheKey = () => (fade ? 'pawn-shimmer-fade' : 'pawn-shimmer');
  return material;
}

const FILM_GLSL = /* glsl */ `
  #define SHIMMER_HEIGHT 1.76
  #define SHIMMER_FAR_PX 14.0
  #define SHIMMER_NEAR_PX 70.0
  #define SHIMMER_SPEED 1.0
  #define SHIMMER_SCALE 0.45
  #define SHIMMER_SCALE_FAR 0.3
  #define SHIMMER_WARP 1.4
  #define SHIMMER_WOBBLE 0.85
  #define SHIMMER_WOBBLE_LIGHT 0.18
  #define SHIMMER_THICK 560.0
  #define SHIMMER_THICK_FAR 330.0
  #define SHIMMER_DRIFT 160.0
  #define SHIMMER_HUE 0.06
  #define SHIMMER_GAIN 2.0
  #define SHIMMER_GAIN_FAR 2.4
  #define SHIMMER_PUSH 0.18
  #define SHIMMER_FILM_L 0.5
  #define SHIMMER_FILM_AMP 0.45
  #define SHIMMER_PURE_HUE 0.45
  #define SHIMMER_STRIPE 0.9
  #define SHIMMER_STRIPE_FAR 0.35
  #define SHIMMER_SCROLL 0.12
  #define SHIMMER_STRIPE_WARP 0.8
  #define SHIMMER_SAT 1.15
  #define SHIMMER_FRESNEL 4.0
  #define SHIMMER_CORE 0.6
  #define SHIMMER_EDGE 0.75
  #define SHIMMER_CORE_TINT 0.45
  #define SHIMMER_RIM 0.5
  #define SHIMMER_GLOW 0.12
  #define SHIMMER_FAR_GLOW 1.6
  // HEIGHT: pawn height in object units (lathe 0.84 * 2.1); FAR_PX / NEAR_PX: on-screen pawn height (px)
  // treated as fully zoomed out / close; SCALE(_FAR): noise frequency; WOBBLE(_LIGHT): normal-noise
  // amplitude for the film / for lighting; THICK(_FAR): film spacing in nm (about two bands close, one
  // broad band far); HUE: film-phase cycles per second; CORE: film share in the facing core (the player
  // colour lives there); FRESNEL: falloff of the glancing film; RIM / GLOW: additive film terms.
  float vhash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(vhash(i), vhash(i + vec3(1, 0, 0)), f.x), mix(vhash(i + vec3(0, 1, 0)), vhash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(vhash(i + vec3(0, 0, 1)), vhash(i + vec3(1, 0, 1)), f.x), mix(vhash(i + vec3(0, 1, 1)), vhash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  // entangleRT (vfx/entangle.js) with an extra film-phase offset, for the hue drift
  void filmRT(sampler2D lut, float cosT, float thick, float phase, out vec3 r, out vec3 t) {
    const float H = ${ENTANGLE_LUT_ROWS}.0;
    cosT = clamp(cosT, 0.0, 1.0);
    float a = acos(cosT) / 1.5707963;
    vec3 s = fract(-2.0 * thick * cosT / vec3(650.0, 530.0, 470.0) + phase);
    float vR = (0.5 + a * (H - 1.0)) / (2.0 * H);
    float vT = vR + 0.5;
    r = vec3(texture2D(lut, vec2(s.r, vR)).r, texture2D(lut, vec2(s.g, vR)).r, texture2D(lut, vec2(s.b, vR)).r);
    t = vec3(texture2D(lut, vec2(s.r, vT)).r, texture2D(lut, vec2(s.g, vT)).r, texture2D(lut, vec2(s.b, vT)).r);
  }
`;

function signedArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

function contains(poly, [x, y]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
