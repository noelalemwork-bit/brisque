// A measured outcome in game terms, shared by the collapse card, the bomb preview and the quantum log:
// who it favours (their colour), what kind of result it is (glyph) and a sentence.
//   ⚔ someone wins a battle   ● someone holds the territory   ∅ left empty   → a split's branch

import { h } from './dom.js';

export function outcomeInfo(state, o, q = null) {
  const name = (p) => state.players[p]?.name ?? 'someone';
  const color = (p) => state.players[p]?.color ?? '#f2ead8';
  if (q) {
    const stays = q.to[o.branch] === q.from;
    return { color: color(q.owner), glyph: '→', text: stays ? `stayed in ${tname(state, q.from)}` : `went to ${tname(state, q.to[o.branch])}` };
  }
  const armies = Object.entries(o.cell ?? {}).map(([p, n]) => [Number(p), n]);
  if (!armies.length) return { color: '#9aa7ab', glyph: '∅', text: 'left empty' };
  if (o.victor !== null && o.victor !== undefined) {
    const others = armies.filter(([p]) => p !== o.victor).map(([, n]) => n);
    return { color: color(o.victor), glyph: '⚔', text: `${name(o.victor)} wins, ${o.cell[o.victor]} against ${others.join(' + ')}` };
  }
  return { color: color(armies[0][0]), glyph: '●', text: armies.map(([p, n]) => `${name(p)} holds it with ${n}`).join(', ') };
}

// Small coloured badge with the outcome's glyph
export const outcomeChip = (info) => h('span.ochip', { style: { '--c': info.color }, title: info.text, text: info.glyph });

let names = null;
function tname(state, t) { return names?.[t] ?? `territory ${t}`; }
// territory names come from the map, which state doesn't carry
export function setTerritoryNames(list) { names = list; }

// Rotation angle as a multiple of π: π/2, 2π/3, -π/4, else 0.37π. Battle angles are 2·asin(√p), so most
// read as decimals of π; the exact value stays in the gate's tooltip.
export function piLabel(theta) {
  const r = theta / Math.PI;
  const sign = r < 0 ? '−' : '';
  const a = Math.abs(r);
  if (a < 1e-9) return '0';
  for (let d = 1; d <= 8; d++) {
    const n = Math.round(a * d);
    if (n > 0 && Math.abs(a - n / d) < 5e-4) {
      const g = gcd(n, d);
      const [nn, dd] = [n / g, d / g];
      return `${sign}${nn === 1 ? '' : nn}π${dd === 1 ? '' : `/${dd}`}`;
    }
  }
  return `${sign}${a.toFixed(2)}π`;
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
