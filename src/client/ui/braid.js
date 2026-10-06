// Branch braid, drawn from braidLayout(): one strand per branch, time flowing UP (latest at the top).
// Forks where a split happens (nested splits fork off their parent branch), woven crossings where
// branches of different threads meet, junction links where a thread's two branches coincide, ✕ where
// a branch collapses, ● where a thread resolves (two strands merge into one ● when they reconverged).
// A resolved thread whose worldline crossed others carries a fusion glyph per partner: ψ (fermion,
// linked) or 1 (vacuum, unlinked), from the Majorana experiment in ../majorana/fusion.js.

import { h } from './dom.js';
import { braidLayout } from './braidLayout.js';
import { fusionsFor } from '../majorana/fusion.js';

const ROW = 16;
const W = 226;
const HALO = 'rgb(12 24 30)';

export function braidDiagram(state, { rows: maxRows = 22 } = {}) {
  const { rows, owners } = braidLayout(state.history ?? [], state.qubits);
  const shown = rows.slice(-maxRows);
  const maxCols = Math.max(1, ...shown.map((r) => Math.max(r.before.length, r.after.length)));
  const colW = Math.min(20, (W - 24) / Math.max(1, maxCols - 1));
  const x0 = (W - (maxCols - 1) * colW) / 2;
  const x = (i) => x0 + i * colW;
  const H = shown.length * ROW + 12;
  const svg = h('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: { display: 'block', margin: '4px 0 8px' } });
  const color = (id) => state.players[owners[Number(id.split(':')[0])]]?.color ?? '#9fd8ff';
  const branchDash = (id) => (id.endsWith(':1') ? '5 3' : null); // branch 1 dashed, branch 0 solid
  // time flows up: row k (0 = oldest shown) spans yBottom(k) -> yTop(k)
  const yBottom = (k) => H - 6 - k * ROW;
  const yTop = (k) => yBottom(k) - ROW;

  const strandPath = (id, d, top = false) => {
    const out = [];
    if (top) out.push(h('path', { d, stroke: HALO, 'stroke-width': 8, fill: 'none', 'stroke-linecap': 'round' }));
    out.push(h('path', { d, stroke: color(id), 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', 'stroke-dasharray': branchDash(id) }));
    return out;
  };
  // ψ / 1 glyphs beside a resolved thread's end marker (left of it if the marker is near the edge)
  const fusionGlyphs = (q, cx, cy) => {
    const fs = fusionsFor(q);
    if (!fs.length) return [];
    const side = cx > W - 14 - fs.length * 12 ? -1 : 1;
    return fs.map((f, n) => {
      const gx = cx + side * (10 + n * 12);
      const fermion = f.outcome === -1;
      const name = state.players[owners[f.partner]]?.name ?? 'another thread';
      return h('text', {
        class: `braid-fuse${fermion ? ' fermion' : ''}`, x: gx, y: cy + 4, 'text-anchor': 'middle',
      }, h('title', { text: `${f.linked ? 'Linked' : 'Unlinked'} with ${name}'s worldline (crossed ${f.crossings}×): Majoranas fused to ${fermion ? 'a fermion (ψ)' : 'vacuum (1)'}` }), fermion ? 'ψ' : '1');
    });
  };
  const curve = (xa, ya, xb, yb) => `M${xa} ${ya} C${xa} ${(ya + yb) / 2} ${xb} ${(ya + yb) / 2} ${xb} ${yb}`;

  shown.forEach((r, k) => {
    const yb = yBottom(k);
    const yt = yTop(k);
    const under = [];
    const topLayer = [];
    for (const id of r.before) {
      const i0 = r.before.indexOf(id);
      const i1 = r.after.indexOf(id);
      if (i1 < 0) continue; // ends in this row (drawn below)
      const isOver = r.kind === 'swap' && r.over === id;
      (isOver ? topLayer : under).push(...strandPath(id, curve(x(i0), yb, x(i1), yt), isOver));
    }
    if (r.kind === 'fork') {
      const kids = r.after.filter((id) => !r.before.includes(id));
      const from = r.parent ? x(r.before.indexOf(r.parent)) : (x(r.after.indexOf(kids[0])) + x(r.after.indexOf(kids[1]))) / 2;
      for (const id of kids) topLayer.push(...strandPath(id, curve(from, yb, x(r.after.indexOf(id)), yt)));
      if (!r.parent) topLayer.push(h('circle', { cx: from, cy: yb, r: 4, fill: color(kids[0]) }));
      else topLayer.push(h('circle', { cx: from, cy: yb, r: 2.5, fill: '#f2ead8' }));
    }
    if (r.kind === 'junction') {
      const ia = r.after.indexOf(`${r.q}:0`);
      const ib = r.after.indexOf(`${r.q}:1`);
      const y = (yb + yt) / 2;
      topLayer.push(h('line', { x1: x(ia), y1: y, x2: x(ib), y2: y, stroke: '#f2ead8', 'stroke-width': 2 }));
      topLayer.push(h('circle', { cx: (x(ia) + x(ib)) / 2, cy: y, r: 3.5, fill: 'none', stroke: '#f2ead8', 'stroke-width': 1.5 }));
    }
    if (r.kind === 'mark') {
      const i = r.after.indexOf(r.strand);
      topLayer.push(h('circle', { cx: x(i), cy: (yb + yt) / 2, r: 2, fill: '#f2ead8', opacity: 0.8 }));
    }
    if (r.kind === 'end') {
      const cols = r.strands.map((id) => r.before.indexOf(id));
      if (r.how === 'reconverge') {
        const mid = (x(cols[0]) + x(cols[1])) / 2;
        r.strands.forEach((id, n) => topLayer.push(...strandPath(id, curve(x(cols[n]), yb, mid, yt + ROW / 2))));
        topLayer.push(h('circle', { cx: mid, cy: yt + ROW / 2, r: 4.5, fill: '#f2ead8', stroke: color(r.strands[0]), 'stroke-width': 2 }));
        topLayer.push(...fusionGlyphs(Number(r.strands[0].split(':')[0]), mid, yt + ROW / 2));
      } else {
        r.strands.forEach((id, n) => {
          const cx = x(cols[n]);
          const cy = (yb + yt) / 2;
          topLayer.push(...strandPath(id, `M${cx} ${yb} L${cx} ${cy}`));
          topLayer.push(r.how === 'collapse'
            ? h('path', { d: `M${cx - 4} ${cy - 4}L${cx + 4} ${cy + 4}M${cx + 4} ${cy - 4}L${cx - 4} ${cy + 4}`, stroke: '#f2ead8', 'stroke-width': 2 })
            : h('circle', { cx, cy, r: 4, fill: color(id), stroke: '#f2ead8', 'stroke-width': 1.5 }));
          if (r.how === 'resolve' && n === 0) topLayer.push(...fusionGlyphs(Number(id.split(':')[0]), cx, cy));
        });
      }
    }
    svg.append(...under, ...topLayer);
  });
  return svg;
}
