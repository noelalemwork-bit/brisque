// Turns a generated board into three.js meshes: flat-shaded low-poly terrain that stays low near
// the coast and curves up toward the interior, a sandy beach skirt that flows out under the water,
// border lines, a pick lookup, and a coast-distance texture the water shader uses for foam.

import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { makeRng } from '../shared/rng.js';

export const RELIEF = {
  shore: 0.3, // top height right at the coastline
  peak: 3.2, // added height at the most inland point
  exponent: 2.4, // height ~ t^exponent, t = coast distance / max: flat lowlands, rising only near the centre
  roughness: 0.12, // noise amplitude, also scaled by t^exponent so lowlands stay smooth
  noiseFreq: 0.09,
  innerStride: 4, // outline points per inner-ring vertex: bigger = coarser facets
  beachWidth: 1.4, // how far the sand skirt flows out past the coastline
  beachDepth: -0.5, // skirt's outer edge, below the water line
  sandWidth: 0.55, // coast distance over which land blends into sand
};

// pastel, low-contrast (Bad North-ish)
const CONTINENT_COLORS = ['#9dbf7c', '#d6c07f', '#a79bc8', '#80b8b0', '#d69c80', '#bfc58e', '#8fa9cf', '#c893a8'];
const SAND = new THREE.Color('#ecd9a6');
const WET_SAND = new THREE.Color('#c7ae7c');
const HIGHLAND = new THREE.Color('#ece6d6');

export function buildMapMesh(map, relief = RELIEF) {
  const r = { ...RELIEF, ...relief };
  const coast = makeCoastField(map);
  const heightAt = makeHeightField(map, r, coast);
  const ox = map.width / 2;
  const oz = map.height / 2;
  const toWorld = ([x, y], h) => new THREE.Vector3(x - ox, h, y - oz);
  const rng = makeRng(`colors:${map.seed}`);

  const positions = [];
  const colors = [];
  const faceTerritory = [];

  const pushTri = (verts, cols, territory, forceUp = true) => {
    let [a, b, c] = verts;
    let [ca, cb, cc] = cols;
    if (forceUp) {
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      if (n.y < 0) { [b, c] = [c, b]; [cb, cc] = [cc, cb]; }
    }
    for (const v of [a, b, c]) positions.push(v.x, v.y, v.z);
    for (const col of [ca, cb, cc]) colors.push(col.r, col.g, col.b);
    faceTerritory.push(territory);
  };

  // per-vertex colour: continent tint -> pale highlands with height, -> sand near the coast
  const landColor = (base, p, h) => {
    const col = base.clone().lerp(HIGHLAND, THREE.MathUtils.clamp((h - r.shore) / r.peak, 0, 1) ** 1.5 * 0.5);
    const sand = 1 - THREE.MathUtils.smoothstep(coast.distance(p[0], p[1]), r.sandWidth * 0.35, r.sandWidth);
    return col.lerp(SAND, sand);
  };

  const topRanges = []; // per territory: [firstFace, endFace) of its top surface
  for (const t of map.territories) {
    const firstFace = faceTerritory.length;
    const base = new THREE.Color(CONTINENT_COLORS[t.continent % CONTINENT_COLORS.length]).offsetHSL(
      rng.range(-0.015, 0.015), rng.range(-0.05, 0.05), rng.range(-0.04, 0.04)
    );
    const vert = (p) => {
      const h = heightAt(p[0], p[1]);
      return { v: toWorld(p, h), c: landColor(base, p, h) };
    };
    const n = t.outline.length;
    const lerpC = (p, k) => [p[0] + (t.centroid[0] - p[0]) * k, p[1] + (t.centroid[1] - p[1]) * k];
    const edge = t.outline.map(vert);
    // narrow full-density ring just inside the outline: gives the sand band a crisp inner edge
    const outer = t.outline.map((p) => vert(lerpC(p, 0.12)));
    const m = Math.max(3, Math.round(n / r.innerStride));
    const idx = Array.from({ length: m }, (_, j) => Math.round((j * n) / m));
    const inner = idx.map((i) => {
      return vert(lerpC(t.outline[i % n], 0.45));
    });
    const center = vert(t.centroid);

    const face = (...vs) => pushTri(vs.map((x) => x.v), vs.map((x) => x.c), t.id);
    for (let i = 0; i < n; i++) {
      face(edge[i], edge[(i + 1) % n], outer[(i + 1) % n]);
      face(edge[i], outer[(i + 1) % n], outer[i]);
    }
    for (let j = 0; j < m; j++) {
      const i0 = idx[j];
      const i1 = j + 1 < m ? idx[j + 1] : n;
      for (let i = i0; i < i1; i++) face(inner[j], outer[i % n], outer[(i + 1) % n]);
      face(outer[i1 % n], inner[(j + 1) % m], inner[j]);
      face(center, inner[j], inner[(j + 1) % m]);
    }
    topRanges[t.id] = [firstFace, faceTerritory.length];
  }

  // beach skirt: each coast vertex is pushed outward along a shared (accumulated) normal so
  // neighbouring coast borders meet without cracks, sloping from shore height to below the water
  const outward = coastNormals(map);
  for (const b of map.borders) {
    if (b.b !== -1) continue;
    const ring = b.points.map((p) => {
      const n = outward.get(key(p));
      const q = [p[0] + n[0] * r.beachWidth, p[1] + n[1] * r.beachWidth];
      return { top: toWorld(p, heightAt(p[0], p[1])), out: toWorld(q, r.beachDepth) };
    });
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i];
      const c = ring[i + 1];
      pushTri([a.top, a.out, c.out], [SAND, WET_SAND, WET_SAND], b.a);
      pushTri([a.top, c.out, c.top], [SAND, WET_SAND, SAND], b.a);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals(); // non-indexed -> flat facets
  const land = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
  );
  land.castShadow = true;
  land.receiveShadow = true;

  const group = new THREE.Group();
  group.add(land, buildBorders(map, heightAt, toWorld));
  return { group, land, heightAt, toWorld, faceTerritory, topRanges, coastTexture: coast.texture(ox, oz) };
}

function buildBorders(map, heightAt, toWorld) {
  const inner = [];
  const continental = [];
  for (const b of map.borders) {
    if (b.b === -1) continue;
    const between = map.territories[b.a].continent !== map.territories[b.b].continent;
    const lift = between ? 0.08 : 0.04;
    const target = between ? continental : inner;
    for (let i = 0; i < b.points.length - 1; i++) {
      for (const p of [b.points[i], b.points[i + 1]]) {
        const v = toWorld(p, heightAt(p[0], p[1]) + lift);
        target.push(v.x, v.y, v.z);
      }
    }
  }
  const lines = (arr, color, opacity) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  };
  const group = new THREE.Group();
  group.add(lines(inner, '#3a3528', 0.28), lines(continental, '#fffaf0', 0.85));
  return group;
}

const key = ([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`;

// Outward unit normal per coast vertex, averaged over every coast segment touching it.
// Border points follow their territory's outline order, so the outline's winding says which side is out.
function coastNormals(map) {
  const acc = new Map();
  for (const b of map.borders) {
    if (b.b !== -1) continue;
    const ccw = signedArea(map.territories[b.a].outline) > 0;
    for (let i = 0; i < b.points.length - 1; i++) {
      const [px, py] = b.points[i];
      const [qx, qy] = b.points[i + 1];
      const len = Math.hypot(qx - px, qy - py) || 1;
      const nx = ((ccw ? 1 : -1) * (qy - py)) / len;
      const ny = ((ccw ? -1 : 1) * (qx - px)) / len;
      for (const p of [b.points[i], b.points[i + 1]]) {
        const k = key(p);
        const n = acc.get(k) ?? [0, 0];
        acc.set(k, [n[0] + nx, n[1] + ny]);
      }
    }
  }
  for (const [k, [x, y]] of acc) {
    const l = Math.hypot(x, y) || 1;
    acc.set(k, [x / l, y / l]);
  }
  return acc;
}

function signedArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

// Distance to the nearest coastline segment (unsigned), memoised, plus a baked texture of it.
function makeCoastField(map) {
  const segs = [];
  for (const b of map.borders) {
    if (b.b !== -1) continue;
    for (let i = 0; i < b.points.length - 1; i++) segs.push([...b.points[i], ...b.points[i + 1]]);
  }
  const raw = (x, y) => {
    let d2 = Infinity;
    for (const [ax, ay, bx, by] of segs) {
      const dx = bx - ax;
      const dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      const ex = ax + t * dx - x;
      const ey = ay + t * dy - y;
      d2 = Math.min(d2, ex * ex + ey * ey);
    }
    return Math.sqrt(d2);
  };
  const cache = new Map();
  const distance = (x, y) => {
    const k = key([x, y]);
    let d = cache.get(k);
    if (d === undefined) cache.set(k, (d = raw(x, y)));
    return d;
  };

  // R8 texture over the map rectangle, distance / MAX_DIST in [0, 1]. MAX_DIST mirrors water.js.
  const texture = () => {
    const MAX_DIST = 8;
    const w = 200;
    const h = Math.round((w * map.height) / map.width);
    const data = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const d = raw(((i + 0.5) / w) * map.width, ((j + 0.5) / h) * map.height);
        data[j * w + i] = Math.min(255, Math.round((d / MAX_DIST) * 255));
      }
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.UnsignedByteType);
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  };
  return { distance, texture };
}

// h = shore + peak * s + roughness * noise * s, where s = (coastDistance / maxDistance)^exponent.
// Pure function of (x, y): shared border vertices match on both sides, so territories meet seamlessly.
function makeHeightField(map, r, coast) {
  let maxD = 1e-6;
  for (const t of map.territories) maxD = Math.max(maxD, coast.distance(t.centroid[0], t.centroid[1]));
  const noise = createNoise2D(makeRng(`relief:${map.seed}`).next);
  return (x, y) => {
    const s = Math.min(1, coast.distance(x, y) / maxD) ** r.exponent;
    const n = noise(x * r.noiseFreq, y * r.noiseFreq);
    return r.shore + (r.peak + r.roughness * n) * s;
  };
}
