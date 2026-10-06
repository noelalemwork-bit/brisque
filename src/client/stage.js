// The 3D view: renderer, camera, lights, water, the generated board, territory picking and the
// frame loop. It knows nothing about menus or rules; app.js drives it.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { generateMap } from '../shared/mapgen/generate.js';
import { buildMapMesh } from './mapMesh.js';
import { createWater } from './water.js';

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap; // blurred, soft-edged shadows
  renderer.toneMapping = THREE.NeutralToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#223f4b');
  scene.fog = new THREE.Fog('#223f4b', 110, 215);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  camera.position.set(0, 58, 80);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.42;
  controls.minDistance = 20;
  controls.maxDistance = 150;

  // soft, mostly-ambient light: big sky fill, gentle warm key, pale shadows
  scene.add(new THREE.HemisphereLight('#eef4f6', '#6f6858', 1.25));
  const sun = new THREE.DirectionalLight('#fff0d8', 1.35);
  sun.position.set(-40, 60, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.08;
  sun.shadow.radius = 8;
  sun.shadow.blurSamples = 16;
  sun.shadow.intensity = 0.55;
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 45, bottom: -45, far: 200 });
  scene.add(sun);

  const water = createWater();
  water.setSun(sun.position);
  scene.add(water.mesh);

  const outline = (color) => {
    const line = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    line.visible = false;
    line.renderOrder = 2;
    scene.add(line);
    return line;
  };
  const hoverLine = outline('#ffffff');
  const selectLine = outline('#ffe27a');

  let board = null;
  let map = null;
  let hovered = -1;
  let attract = true; // slow auto-orbit behind menus
  let shake = 0;
  // attract camera: orbit + dolly + drifting focus (see attend())
  let orbitAngle = Math.atan2(camera.position.z, camera.position.x);
  let attractTime = 0;
  const focusGoal = new THREE.Vector3();
  let shift = 0; // horizontal view offset (fraction of width), eased
  let shiftGoal = 0;
  let focusUntil = 0;
  const shakeOffset = new THREE.Vector3();
  const frameHooks = new Set();
  const listeners = { hover: new Set(), click: new Set(), wheel: new Set() };
  const emit = (type, ...args) => listeners[type].forEach((fn) => fn(...args));

  function loadBoard(seed) {
    if (board) {
      scene.remove(board.group);
      board.group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    }
    map = generateMap(seed);
    board = buildMapMesh(map);
    scene.add(board.group);
    water.setCoast(board.coastTexture, map);
    hoverLine.visible = selectLine.visible = false;
    hovered = -1;
    return { map, board };
  }

  function setOutline(line, t, lift) {
    if (t < 0 || !board) { line.visible = false; return; }
    const pts = map.territories[t].outline.map((p) => board.toWorld(p, board.heightAt(p[0], p[1]) + lift));
    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    line.visible = true;
  }

  // --- picking + input --------------------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pointerPx = { x: 0, y: 0 };
  canvas.addEventListener('pointermove', (e) => {
    pointerPx.x = e.clientX;
    pointerPx.y = e.clientY;
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = board && raycaster.intersectObject(board.land)[0];
    const id = hit ? board.faceTerritory[hit.faceIndex] : -1;
    if (id === hovered) return;
    hovered = id;
    setOutline(hoverLine, id, 0.12);
    emit('hover', id);
  });
  // a click is press + release without dragging (dragging orbits the camera)
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    emit('click', hovered, { shift: e.shiftKey, right: e.button === 2 });
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    if (!e.altKey) return;
    e.preventDefault();
    emit('wheel', e.deltaY);
  }, { passive: false });

  // --- projection helpers for the SVG layer ------------------------------------------------------
  const tmp = new THREE.Vector3();
  const project = (v) => {
    tmp.copy(v).project(camera);
    return { x: (tmp.x * 0.5 + 0.5) * innerWidth, y: (-tmp.y * 0.5 + 0.5) * innerHeight, behind: tmp.z > 1 };
  };
  const anchor = (t, lift = 0) => {
    const c = map.territories[t].centroid;
    return board.toWorld(c, board.heightAt(c[0], c[1]) + lift);
  };

  function focus(t) {
    if (t < 0 || !board) return;
    const target = anchor(t);
    controls.target.lerp(target, 0.6);
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  let last = performance.now() / 1000;
  renderer.setAnimationLoop(() => {
    const now = performance.now() / 1000;
    const dt = Math.min(0.1, now - last);
    last = now;
    if (attract) {
      attractTime += dt;
      orbitAngle += dt * 0.045;
      if (now > focusUntil) focusGoal.set(0, 0, 0);
      controls.target.lerp(focusGoal, Math.min(1, dt * 0.35));
      const radius = 74 + 16 * Math.sin(attractTime * 0.07);
      const height = 40 + 9 * Math.sin(attractTime * 0.05 + 1.3);
      camera.position.set(controls.target.x + Math.cos(orbitAngle) * radius, height, controls.target.z + Math.sin(orbitAngle) * radius);
      camera.lookAt(controls.target);
    }
    camera.position.sub(shakeOffset);
    controls.update();
    shift += (shiftGoal - shift) * Math.min(1, dt * 2.5);
    if (Math.abs(shift) > 1e-4) camera.setViewOffset(innerWidth, innerHeight, -shift * innerWidth, 0, innerWidth, innerHeight); else camera.clearViewOffset();
    shake = Math.max(0, shake - dt * 1.5);
    shakeOffset.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    camera.position.add(shakeOffset);
    water.update(now);
    for (const fn of frameHooks) fn(dt, now);
    renderer.render(scene, camera);
  });

  return {
    scene, camera, controls,
    loadBoard,
    get map() { return map; },
    get board() { return board; },
    get hovered() { return hovered; },
    get pointer() { return pointerPx; },
    select: (t) => setOutline(selectLine, t, 0.16),
    shake: (amount) => { shake = Math.max(shake, amount); },
    // slide the rendered scene sideways (e.g. to make room for the home card); eased
    setViewShift(fraction) { shiftGoal = fraction; },
    // attract mode: drift the camera's focus most of the way toward a territory for a few seconds
    attend(t) {
      if (!board) return;
      focusGoal.copy(anchor(t)).multiplyScalar(0.65);
      focusGoal.y = 0;
      focusUntil = performance.now() / 1000 + 6;
    },
    setAttract(on) {
      if (on && !attract) { orbitAngle = Math.atan2(camera.position.z - controls.target.z, camera.position.x - controls.target.x); }
      attract = on;
      controls.enabled = !on;
    },
    focus, project, anchor,
    on: (type, fn) => { listeners[type].add(fn); return () => listeners[type].delete(fn); },
    onFrame: (fn) => { frameHooks.add(fn); return () => frameHooks.delete(fn); },
  };
}
