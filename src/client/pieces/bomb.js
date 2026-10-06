// The bomb: a mesh dropped by a player onto a territory, trailing a translucent streak in that
// player's colour. Timeline:
//   fall     gravity-style ease-in from the sky toward the target
//   (hover)  only if the measurement isn't back yet (live Moth circuits): bobs, fuse sparking,
//            the streak retracts
//   plunge   the moment the result is known; onImpact(result) fires on contact, so the collapse
//            (losers blown away, ground regrowing) happens exactly at detonation
//   blast    flash (ease-out-expo), shockwave ring (ease-out-cubic), camera shake, plus the
//            Moth-rendered VFX (vfx/blast.js): blast sprite sheet (deep-fryer-v1 -> blur-v1) as a
//            billboard + ground decal, and a screen glitch (telablur-v1 streaks, qpixl-v1 slab offsets)
//   (hover) also wraps the bomb in "quantum static" (blur-core-v1 shot-noise frames) and a faint
//            static vignette on screen while the API is still measuring
//   collapse full-screen post effect at detonation (vfx/post.js): the frame pinches toward the impact
//            (telablur-v1 cloud -> point) then a blur-core-v1 shockwave pushes it out, both scaled by the
//            outcome's normalised entropy (how much uncertainty this measurement removed)
// Also owns the split post effect: bombs.fork(from, to, bias) (telablur-v1 frames in qrc-image-v1 order).

import * as THREE from 'three';
import { createBlastVfx } from '../vfx/blast.js';
import { createPostFx, screenUv } from '../vfx/post.js';

const FALL = 0.75;
const PLUNGE = 0.14;
// test hook: ?hover=<seconds> forces a hover of at least that long (shows the waiting VFX offline)
const MIN_HOVER = Number(new URLSearchParams(globalThis.location?.search ?? '').get('hover') ?? 0) || 0;

export function createBombs(stage, pawns) {
  const active = new Set();
  const vfx = createBlastVfx(stage);
  const post = createPostFx(stage);
  const anchorUv = (t) => screenUv(stage, new THREE.Vector3(pawns.regions[t].c[0], pawns.groundY(...pawns.regions[t].c), pawns.regions[t].c[1]));

  function build(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 14), new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.35, metalness: 0.4 }));
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.09, 6, 24), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    band.rotation.x = Math.PI / 2;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.3, 12), new THREE.MeshStandardMaterial({ color: '#8a8f98', metalness: 0.7, roughness: 0.3 }));
    cap.position.y = 0.95;
    const fuse = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 6, 12, Math.PI * 0.9), new THREE.MeshLambertMaterial({ color: '#c9a66b' }));
    fuse.position.set(0.3, 1.1, 0);
    fuse.rotation.z = Math.PI / 2;
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd36b' }));
    spark.position.set(0.62, 1.42, 0);
    g.add(body, band, cap, fuse, spark);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return { g, spark };
  }

  // A vertical streak above the bomb: widest at the bomb, fading to nothing upward.
  function buildTrail(color) {
    const geo = new THREE.CylinderGeometry(0.05, 0.75, 1, 16, 1, true).translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 0.55 } },
      vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; varying float vY; void main(){ gl_FragColor = vec4(uColor, uAlpha * pow(1.0 - vY, 1.6)); \n#include <colorspace_fragment>\n}',
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 4;
    return mesh;
  }

  // drop(t, landed, { color, onImpact, uncertainty }): `landed` resolves with the result once measured.
  // `uncertainty` (0..1, normalised Shannon entropy of the outcomes) sets how loud the quantum static gets.
  // Resolves when the explosion has finished.
  function drop(t, landed, { color = '#ffffff', onImpact = () => {}, uncertainty = 1 } = {}) {
    const { g, spark } = build(color);
    const trail = buildTrail(color);
    const c = pawns.regions[t].c;
    const ground = pawns.groundY(c[0], c[1]);
    const startY = ground + 42;
    const hoverY = ground + 3.4;
    g.position.set(c[0], startY, c[1]);
    trail.position.set(c[0], startY + 0.6, c[1]);
    stage.scene.add(g, trail);
    let time = 0;
    let result;
    let known = false;
    let phase = 'fall';
    let phaseT = 0;
    let fromY = hoverY;
    let aura = null; // quantum static while waiting on the measurement
    let auraLevel = 0;
    landed.then((r) => { known = true; result = r; });

    const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0, depthWrite: false }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.2, 6, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
    ring.rotation.x = Math.PI / 2;
    flash.position.set(c[0], ground + 0.6, c[1]);
    ring.position.set(c[0], ground + 0.35, c[1]);

    const setTrail = (length) => {
      trail.scale.set(1, Math.max(0.01, length), 1);
      trail.position.y = g.position.y + 0.6;
    };

    return new Promise((resolve) => {
      const entry = (dt) => {
        time += dt;
        phaseT += dt;
        spark.scale.setScalar(0.7 + Math.random() * 0.8);
        g.rotation.y += dt * 2;
        if (aura) {
          if (phase === 'plunge') auraLevel = Math.max(0, auraLevel - dt * 8);
          aura.mesh.position.set(g.position.x, g.position.y + 0.3, g.position.z);
          aura.update(dt, auraLevel);
        }
        if (phase === 'fall') {
          const k = Math.min(1, phaseT / FALL);
          g.position.y = startY + (hoverY - startY) * k * k; // accelerating
          setTrail(Math.min(14, (startY - g.position.y) * 0.8));
          if (k >= 1) { phase = known && !MIN_HOVER ? 'plunge' : 'hover'; phaseT = 0; fromY = g.position.y; }
        } else if (phase === 'hover') {
          if (!aura) { aura = vfx.aura(color); stage.scene.add(aura.mesh); }
          auraLevel = Math.min(1, phaseT / 1.2) * (0.3 + 0.7 * uncertainty);
          g.position.y = hoverY + Math.sin(phaseT * 4) * 0.25;
          g.rotation.z = Math.sin(phaseT * 6) * 0.15;
          trail.scale.y += (2 - trail.scale.y) * Math.min(1, dt * 3); // streak retracts while waiting
          trail.position.y = g.position.y + 0.6;
          if (known && phaseT >= MIN_HOVER) { phase = 'plunge'; phaseT = 0; fromY = g.position.y; }
        } else if (phase === 'plunge') {
          const k = Math.min(1, phaseT / PLUNGE);
          g.position.y = fromY + (ground + 0.4 - fromY) * k * k;
          setTrail(3 + k * 3);
          if (k >= 1) {
            phase = 'blast';
            phaseT = 0;
            if (aura) { aura.dispose(); aura = null; }
            vfx.impact(c[0], ground, c[1], color, 0.35 + 0.65 * uncertainty);
            post.collapse(screenUv(stage, new THREE.Vector3(c[0], ground, c[1])), uncertainty);
            stage.scene.remove(g);
            stage.scene.add(flash, ring);
            pawns.shockwave(t, 5);
            stage.shake?.(0.45);
            onImpact(result);
          }
        } else {
          const k = Math.min(1, phaseT / 0.8);
          const expo = k === 1 ? 1 : 1 - 2 ** (-10 * k);
          const cubic = 1 - (1 - k) ** 3;
          flash.scale.setScalar(0.5 + expo * 5.5);
          flash.material.opacity = (1 - expo) * 0.45;
          ring.scale.setScalar(1 + cubic * 10);
          ring.material.opacity = (1 - cubic) * 0.85;
          trail.material.uniforms.uAlpha.value = 0.55 * (1 - k);
          if (k >= 1) {
            stage.scene.remove(flash, ring, trail);
            for (const m of [flash, ring, trail]) { m.geometry.dispose(); m.material.dispose(); }
            g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
            active.delete(entry);
            resolve();
          }
        }
      };
      active.add(entry);
    });
  }

  // a split from territory `from` toward to[0] / to[1] (either may be `from`); bias = P(to[1])
  function fork(from, to, bias = 0.5) {
    if (!to || to.length < 2) return;
    const a = anchorUv(to[0]); const b = anchorUv(to[1]);
    const dir = b.clone().sub(a).multiply(new THREE.Vector2(innerWidth, innerHeight));
    post.fork(anchorUv(from), dir.lengthSq() > 1 ? dir : new THREE.Vector2(1, 0), bias);
  }

  const off = stage.onFrame((dt) => { for (const f of active) f(dt); });
  return { drop, fork, dispose() { off(); vfx.dispose(); post.dispose(); } };
}
