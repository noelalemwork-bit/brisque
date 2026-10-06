// Texture-driven bomb VFX (all textures come from Moth engines, see sources.js):
//   impact(x, y, z, color)   billboard + ground decal playing the blast sheet, and a screen glitch burst
//   aura(color)              "quantum static" cloud around a bomb hovering while the measurement runs;
//                            also raises a faint static vignette on screen. Returns { mesh, update, dispose }.
// The screen layer is one full-screen additive quad (no post-processing pass needed): glitch streaks
// from the telablur texture, displaced row-wise by the qpixl slab offsets, RGB-split; static frames from
// blur-core-v1 in a vignette. Black in every texture means "no effect", so any source can be swapped in.

import * as THREE from 'three';
import { vfxTexture, vfxSlabs } from './sources.js';

const FRAMES = 8;
const IMPACT_SECONDS = 0.75;
const GLITCH_SECONDS = 0.42;

export function createBlastVfx(stage) {
  const blast = vfxTexture('blast');
  const glitch = vfxTexture('glitch', { wrap: THREE.RepeatWrapping });
  const stat = vfxTexture('static', { wrap: THREE.RepeatWrapping, srgb: false, nearest: true });
  const slabs = vfxSlabs();
  const slabTex = new THREE.DataTexture(new Uint8Array(400), 20, 20, THREE.RedFormat);
  slabTex.magFilter = THREE.NearestFilter;
  slabTex.wrapS = slabTex.wrapT = THREE.RepeatWrapping;
  let slabsUploaded = false;
  const uploadSlabs = () => {
    if (slabsUploaded || slabs.values.length !== slabTex.image.data.length) return;
    slabs.values.forEach((v, i) => { slabTex.image.data[i] = Math.round(Math.max(0, Math.min(1, v)) * 255); });
    slabTex.needsUpdate = true;
    slabsUploaded = slabs.loaded;
  };
  uploadSlabs();

  // ---- screen layer --------------------------------------------------------------------------
  const screenU = {
    uGlitch: { value: 0 }, uStatic: { value: 0 }, uTime: { value: 0 }, uSeed: { value: 0 },
    uGlitchTex: glitch.tex, uStaticTex: stat.tex, uSlabs: { value: slabTex }, uAspect: { value: 1 },
    uTint: { value: new THREE.Color('#ffffff') },
  };
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: screenU, vertexShader: SCREEN_VERT, fragmentShader: SCREEN_FRAG,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  screen.frustumCulled = false;
  screen.renderOrder = 1000;
  screen.visible = false;
  stage.scene.add(screen);

  let glitchT = 1;
  let glitchAmp = 0;
  const hovering = new Set(); // aura entries currently asking for screen static

  // ---- sheet material (billboard + decal) ------------------------------------------------------
  const sheetMaterial = (tex, color, frames) => new THREE.ShaderMaterial({
    uniforms: { uTex: tex, uFrame: { value: 0 }, uFrames: { value: frames }, uColor: { value: new THREE.Color(color) }, uAlpha: { value: 1 }, uRadial: { value: 0 } },
    vertexShader: SHEET_VERT, fragmentShader: SHEET_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });

  const live = new Set();

  function impact(x, y, z, color, amp = 1) {
    const tint = new THREE.Color(color).lerp(new THREE.Color('#fff3c4'), 0.55);
    const bill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sheetMaterial(blast.tex, tint, FRAMES));
    bill.position.set(x, y + 2.2, z);
    bill.scale.setScalar(13);
    bill.material.depthTest = false;
    bill.renderOrder = 6;
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), sheetMaterial(blast.tex, color, FRAMES));
    decal.position.set(x, y + 0.45, z);
    decal.scale.setScalar(16);
    decal.renderOrder = 5;
    stage.scene.add(bill, decal);
    live.add({ bill, decal, t: 0 });
    glitchT = 0;
    glitchAmp = amp;
    screenU.uSeed.value = Math.random();
    screenU.uTint.value.set(color).lerp(new THREE.Color('#ffffff'), 0.5);
  }

  function aura(color) {
    const mat = sheetMaterial(stat.tex, new THREE.Color(color).lerp(new THREE.Color('#e8f4ff'), 0.6), FRAMES);
    mat.uniforms.uRadial.value = 1;
    mat.uniforms.uAlpha.value = 0;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.scale.setScalar(5.2);
    mesh.renderOrder = 5;
    const entry = { level: 0, t: 0 };
    hovering.add(entry);
    return {
      mesh,
      // level 0..1: how strongly the static shows (ramps while the measurement is pending)
      update(dt, level) {
        entry.t += dt;
        entry.level = level;
        mat.uniforms.uFrame.value = (entry.t * 14) % FRAMES;
        mat.uniforms.uAlpha.value = 0.9 * level;
        mesh.quaternion.copy(stage.camera.quaternion);
      },
      dispose() { hovering.delete(entry); mesh.parent?.remove(mesh); mesh.geometry.dispose(); mat.dispose(); },
    };
  }

  const off = stage.onFrame((dt) => {
    screenU.uTime.value += dt;
    screenU.uAspect.value = innerWidth / Math.max(1, innerHeight);
    if (!slabsUploaded) uploadSlabs();
    for (const e of live) {
      e.t += dt;
      const k = Math.min(1, e.t / IMPACT_SECONDS);
      const frame = Math.min(FRAMES - 1.001, k * (FRAMES - 1));
      for (const m of [e.bill, e.decal]) m.material.uniforms.uFrame.value = frame;
      e.bill.quaternion.copy(stage.camera.quaternion);
      e.bill.material.uniforms.uAlpha.value = (0.8 + 1.4 * k) * (1 - k * k); // later frames are dimmer in the sheet
      e.decal.material.uniforms.uAlpha.value = (0.4 + 0.9 * k) * (1 - k);
      e.decal.scale.setScalar(16 + 6 * k);
      if (k >= 1) {
        for (const m of [e.bill, e.decal]) { stage.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
        live.delete(e);
      }
    }
    // glitch: a sharp burst that decays with a couple of aftershocks
    glitchT = Math.min(1, glitchT + dt / GLITCH_SECONDS);
    const after = glitchT < 1 ? (1 - glitchT) ** 2 * (0.75 + 0.25 * Math.sign(Math.sin(glitchT * 40))) : 0;
    screenU.uGlitch.value = glitchAmp * after;
    let s = 0;
    for (const h of hovering) s = Math.max(s, h.level);
    screenU.uStatic.value += (s - screenU.uStatic.value) * Math.min(1, dt * 6);
    screen.visible = screenU.uGlitch.value > 0.002 || screenU.uStatic.value > 0.002;
  });

  return {
    impact, aura,
    dispose() {
      off();
      stage.scene.remove(screen);
      screen.geometry.dispose(); screen.material.dispose(); slabTex.dispose();
      for (const e of live) for (const m of [e.bill, e.decal]) { stage.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    },
  };
}

const SHEET_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// frames laid out in a row; cross-fade between neighbours so 8 frames play smoothly
const SHEET_FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uFrame;
  uniform float uFrames;
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uRadial;
  varying vec2 vUv;
  vec3 frame(float f) { return texture2D(uTex, vec2((clamp(vUv.x, 0.01, 0.99) + f) / uFrames, vUv.y)).rgb; }
  void main() {
    float f0 = floor(uFrame);
    float f1 = mod(f0 + 1.0, uFrames);
    vec3 c = mix(frame(f0), frame(f1), fract(uFrame));
    if (uRadial > 0.5) {
      float lum = c.r;
      c = uColor * lum * smoothstep(0.5, 0.15, length(vUv - 0.5));
    } else {
      c *= mix(vec3(1.0), uColor * 1.6, 0.35) * smoothstep(0.5, 0.4, length(vUv - 0.5)); // hide the square
    }
    gl_FragColor = vec4(c * uAlpha, 1.0);
  }
`;

const SCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const SCREEN_FRAG = /* glsl */ `
  uniform float uGlitch;
  uniform float uStatic;
  uniform float uTime;
  uniform float uSeed;
  uniform float uAspect;
  uniform vec3 uTint;
  uniform sampler2D uGlitchTex;
  uniform sampler2D uStaticTex;
  uniform sampler2D uSlabs;
  varying vec2 vUv;
  void main() {
    vec3 col = vec3(0.0);
    if (uGlitch > 0.0) {
      // qpixl slab field: row band -> horizontal displacement; columns step through time
      float tick = floor(uTime * 24.0);
      float slab = texture2D(uSlabs, vec2(fract(tick / 20.0 + uSeed), vUv.y)).r;
      float band = smoothstep(0.35, 0.6, slab);
      float shift = (slab - 0.5) * 0.35 * uGlitch;
      vec2 g = vec2(vUv.x * 1.3 + shift + uSeed, vUv.y * 1.6 + tick * 0.137);
      float split = 0.012 + 0.03 * uGlitch;
      vec3 s = vec3(texture2D(uGlitchTex, g + vec2(split, 0.0)).r,
                    texture2D(uGlitchTex, g).g,
                    texture2D(uGlitchTex, g - vec2(split, 0.0)).b);
      col += s * (1.2 + 3.0 * band) * uGlitch * mix(vec3(1.0), uTint, 0.5);
      col += uTint * band * 0.06 * uGlitch; // faint tinted band lift
    }
    if (uStatic > 0.0) {
      float f = floor(mod(uTime * 12.0, 8.0));
      vec2 p = vec2(vUv.x * uAspect, vUv.y) * 3.0;
      float n = texture2D(uStaticTex, vec2((fract(p.x) + f) / 8.0, fract(p.y))).r;
      float vig = smoothstep(0.38, 0.95, length((vUv - 0.5) * vec2(uAspect, 1.0)) / max(1.0, uAspect * 0.62));
      col += vec3(0.75, 0.85, 1.0) * n * vig * uStatic * 0.22;
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;
