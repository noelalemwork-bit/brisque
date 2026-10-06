// Screen-space SVG over the 3D board: one badge per territory (owner, troops, superposition ghosts,
// battles, thread dots), the input previews (move arrow, split fork, bomb crosshair + entangled rings)
// and short-lived FX. Everything is anchored to 3D points and re-projected every frame, so it tracks
// the camera. Placeholder art: swap badge()/fx for sprites or meshes later without touching callers.

import { h, clear } from './dom.js';
import { boardView } from '../../shared/game/index.js';

export function createBoardLayer(root, stage) {
  const svg = h('svg#board-layer');
  const defs = h('defs', {}, h('marker', { id: 'arrowhead', viewBox: '0 0 10 10', refX: 7, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' }, h('path', { d: 'M0 0L10 5L0 10z', fill: '#f3d98b' })));
  const gBadges = h('g');
  const gPreview = h('g');
  const gFx = h('g');
  svg.append(defs, gBadges, gPreview, gFx);
  root.append(svg);

  let badges = []; // per territory: { g, world }
  const fx = new Set(); // { update(dt, now) -> bool alive }
  let preview = null; // { kind, from, to[], labels[], rings[] }
  let speed = 1; // 1 normal, 2 fast, 0 instant (skip FX)

  function setBoard(map) {
    clear(gBadges);
    badges = map.territories.map((t) => {
      const g = h('g.badge');
      const inner = h('g.badge-inner');
      g.append(inner);
      gBadges.append(g);
      return { g, inner, signature: '', world: stage.anchor(t.id, 3.2) };
    });
  }

  // --- badges: floating pills above the pawns. Integers only. One block per army: the troops it has (or
  // could have) there, and above it, the chance it is there at all when that isn't certain. Blocks are
  // laid out left to right with measured widths so battles of any size stay centred; ⚔ sits between
  // armies in a battle. UI colours are always fully saturated (the board carries the uncertainty).
  const CH = 11; // mono glyph width at 18px
  const CH_SMALL = 8; // at 13px
  function render(state) {
    const views = boardView(state);
    views.forEach((v, t) => {
      const badge = badges[t];
      const armies = Object.keys(v.presence).map(Number);
      const most = (p) => Math.max(...v.outcomes.map((o) => o.cell[p] ?? 0));
      const blocks = armies.map((p) => ({
        color: state.players[p].color,
        count: String(most(p)),
        pct: v.presence[p] < 0.995 ? `${Math.round(v.presence[p] * 100)}%` : '',
      }));
      const signature = JSON.stringify([blocks, v.certain, v.contested > 0, v.threads]);
      if (signature === badge.signature) return;
      badge.signature = signature;
      const g = clear(badge.inner);
      if (!blocks.length) return;
      const H = 31;
      const widths = blocks.map((q) => Math.max(28 + CH * q.count.length, CH_SMALL * q.pct.length + 10));
      const gap = v.contested > 0 ? 24 : 6;
      const total = widths.reduce((x, y) => x + y, 0) + gap * (blocks.length - 1);
      let x = -total / 2;
      blocks.forEach((q, i) => {
        const w = widths[i];
        const cx = x + w / 2;
        g.append(h('rect', { x, y: -H / 2, width: w, height: H, rx: H / 2, fill: v.certain ? q.color : 'rgba(12,24,30,0.85)', stroke: q.color, 'stroke-width': 3.5, 'stroke-dasharray': v.certain ? null : '6 3' }));
        g.append(h('text', { x: cx, y: 1, fill: 'white', 'font-size': 18, text: q.count }));
        if (q.pct) g.append(h('text', { x: cx, y: -H / 2 - 9, fill: '#cdeeff', 'font-size': 13, text: q.pct }));
        x += w;
        if (i < blocks.length - 1) {
          if (v.contested > 0) g.append(h('text.pulse', { class: 'pulse', x: x + gap / 2, y: 1, fill: '#ff8a70', 'font-size': 18, text: '⚔' }));
          x += gap;
        }
      });
      v.threads.forEach((q, i) => {
        const owner = state.qubits.find((z) => z.id === q)?.owner;
        g.append(h('circle', { cx: -((v.threads.length - 1) * 9) / 2 + i * 9, cy: H / 2 + 7, r: 4, fill: state.players[owner]?.color ?? '#9fd8ff', stroke: '#9fd8ff', 'stroke-width': 1.5 }));
      });
      // pop the badge when it changes (ease-out-back via CSS)
      g.classList.remove('pop');
      void g.getBoundingClientRect();
      g.classList.add('pop');
    });
  }

  // --- previews -------------------------------------------------------------------------------------
  function setPreview(p) { preview = p; }

  function drawPreview() {
    clear(gPreview);
    if (!preview) return;
    const at = (t) => stage.project(badges[t].world);
    if (preview.kind === 'bomb') {
      for (const t of preview.rings ?? []) {
        const s = at(t);
        gPreview.append(h('circle', { cx: s.x, cy: s.y, r: 26, fill: 'none', stroke: '#9fd8ff', 'stroke-width': 2, 'stroke-dasharray': '4 4' }));
      }
      if (preview.target >= 0) {
        const s = at(preview.target);
        gPreview.append(h('g', { transform: `translate(${s.x} ${s.y})`, stroke: preview.ok ? '#e0664f' : '#8a949a', 'stroke-width': preview.ok ? 2.5 : 1.5, fill: 'none', opacity: preview.ok ? 1 : 0.7 },
          h('circle', { r: 22 }), h('path', { d: 'M-30 0h16M14 0h16M0 -30v16M0 14v16' })));
      }
      return;
    }
    const from = at(preview.from);
    preview.to.forEach((t, i) => {
      if (t < 0) return;
      const to = at(t);
      const label = preview.labels?.[i] ?? '';
      if (t === preview.from) {
        gPreview.append(h('circle', { cx: from.x, cy: from.y, r: 30, fill: 'none', stroke: '#f3d98b', 'stroke-width': 2, 'stroke-dasharray': '5 4' }));
        gPreview.append(h('text', { x: from.x, y: from.y - 40, fill: '#f3d98b', 'font-size': 12, text: label }));
        return;
      }
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2 - 30 - i * 14;
      gPreview.append(h('path', { d: `M${from.x} ${from.y} Q${mx} ${my} ${to.x} ${to.y}`, stroke: '#f3d98b', 'stroke-width': 3, fill: 'none', 'marker-end': 'url(#arrowhead)', 'stroke-dasharray': preview.kind === 'split' ? '7 5' : null }));
      gPreview.append(h('text', { x: mx, y: my - 6, fill: '#f3d98b', 'font-size': 12, text: label }));
    });
  }

  // --- FX -------------------------------------------------------------------------------------------
  // tween-driven: `k` 0->1 over `seconds`; draw(k, g) redraws group g each frame
  function effect(seconds, draw) {
    if (speed === 0) return Promise.resolve();
    seconds /= speed;
    const g = h('g');
    gFx.append(g);
    let t = 0;
    return new Promise((resolve) => {
      fx.add({
        update(dt) {
          t = Math.min(1, t + dt / seconds);
          clear(g);
          draw(t, g);
          if (t >= 1) { g.remove(); resolve(); return false; }
          return true;
        },
      });
    });
  }

  const fxApi = {
    // troop tokens travelling along an arc between territories (ghost when p < 1)
    march(from, to, n, color, p = 1, seconds = 0.6) {
      const a = badges[from].world;
      const b = badges[to].world;
      return effect(seconds, (k, g) => {
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        const w = a.clone().lerp(b, e);
        w.y += Math.sin(e * Math.PI) * 3;
        const s = stage.project(w);
        g.append(h('circle', { cx: s.x, cy: s.y, r: 9, fill: color, opacity: 0.3 + 0.7 * p, stroke: 'white', 'stroke-width': 2, 'stroke-dasharray': p < 1 ? '3 3' : null }));
        g.append(h('text', { x: s.x, y: s.y + 0.5, fill: 'white', 'font-size': 10, text: n }));
      });
    },
    popText(t, text, color = '#f3d98b', seconds = 0.9) {
      return effect(seconds, (k, g) => {
        const s = stage.project(badges[t].world);
        g.append(h('text', { x: s.x, y: s.y - 24 - k * 26, fill: color, 'font-size': 14, opacity: 1 - k * k, text }));
      });
    },
    ring(t, color = '#ffffff', seconds = 0.8, max = 70) {
      return effect(seconds, (k, g) => {
        const s = stage.project(badges[t].world);
        g.append(h('circle', { cx: s.x, cy: s.y, r: 10 + k * max, fill: 'none', stroke: color, 'stroke-width': 4 * (1 - k), opacity: 1 - k }));
      });
    },
    // bomb falls from the top of the screen and hovers above the target until `landed` resolves
    bomb(t, landed) {
      if (speed === 0) return landed;
      let done = false;
      landed.then(() => { done = true; });
      const g = h('g');
      gFx.append(g);
      let time = 0;
      return new Promise((resolve) => {
        fx.add({
          update(dt) {
            time += dt;
            const s = stage.project(badges[t].world);
            const fall = Math.min(1, time / 0.9);
            const hover = done ? 0 : Math.sin(time * 5) * 4;
            const y = -40 + (s.y - 60 + 40) * (fall * fall) + hover;
            clear(g).append(h('g', { transform: `translate(${s.x} ${y}) rotate(${Math.sin(time * 3) * 8})` },
              h('ellipse', { rx: 11, ry: 14, fill: '#2b2b2b', stroke: '#e0664f', 'stroke-width': 2 }),
              h('path', { d: 'M-6 -14l6 -8l6 8', fill: '#e0664f' })));
            if (done && fall >= 1) { g.remove(); resolve(); return false; }
            return true;
          },
        });
      });
    },
  };

  stage.onFrame((dt) => {
    for (const b of badges) {
      const s = stage.project(b.world);
      b.g.setAttribute('transform', `translate(${s.x.toFixed(1)} ${s.y.toFixed(1)})`);
      b.g.style.display = s.behind ? 'none' : '';
    }
    drawPreview();
    for (const f of fx) if (!f.update(dt)) fx.delete(f);
  });

  return { setBoard, render, setPreview, fx: fxApi, setSpeed(s) { speed = s; }, dispose: () => svg.remove(), show(on) { svg.style.display = on ? '' : 'none'; } };
}
