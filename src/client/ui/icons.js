// Placeholder SVG art. Every icon is a function returning a fresh element so it can be restyled or
// swapped for pre-rendered Moth-engine art later without touching the HUD code.

import { h } from './dom.js';

const icon = (paths, size = 24) => h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, ...paths);

export const icons = {
  deploy: () => icon([h('path', { d: 'M12 3v12' }), h('path', { d: 'M7 10l5 5 5-5' }), h('path', { d: 'M5 20h14' })]),
  move: () => icon([h('path', { d: 'M4 17c4-8 10-10 16-10' }), h('path', { d: 'M15 3l5 4-4 5' })]),
  split: () => icon([h('path', { d: 'M4 12h6' }), h('path', { d: 'M10 12c3 0 4-6 9-6' }), h('path', { d: 'M10 12c3 0 4 6 9 6' }), h('circle', { cx: 19, cy: 6, r: 1.6, fill: 'currentColor' }), h('circle', { cx: 19, cy: 18, r: 1.6, fill: 'currentColor' })]),
  bomb: (color = 'currentColor') => icon([h('circle', { cx: 11, cy: 14, r: 7, fill: color, stroke: 'none' }), h('path', { d: 'M15 8l3-3' }), h('path', { d: 'M18 2v2M21 5h-2M20.5 2.5l-1.2 1.2' }), h('path', { d: 'M8 12a3 3 0 0 1 3-3', stroke: 'white', 'stroke-opacity': 0.6 })]),
  end: () => icon([h('path', { d: 'M5 12h14' }), h('path', { d: 'M13 6l6 6-6 6' })]),
  cpu: () => icon([h('rect', { x: 6, y: 6, width: 12, height: 12, rx: 2 }), h('path', { d: 'M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4' })], 14),
  swords: () => icon([h('path', { d: 'M4 4l10 10M20 4L10 14' }), h('path', { d: 'M6 16l-2 4 4-2M18 16l2 4-4-2' })]),
};

// Round avatar placeholder: player colour, initial, and a small CPU chip for bots.
export function avatarFace(player, size = 58) {
  const initial = (player.name.trim()[0] ?? '?').toUpperCase();
  return h('svg', { viewBox: '0 0 58 58', width: size, height: size },
    h('circle', { cx: 29, cy: 29, r: 27, fill: player.color, stroke: 'rgba(255,255,255,0.85)', 'stroke-width': 2 }),
    h('path', { d: 'M8 38 Q29 52 50 38', stroke: 'rgba(0,0,0,0.18)', 'stroke-width': 6, fill: 'none' }),
    h('text', { x: 29, y: 31, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'white', 'font-size': 24, 'font-weight': 800, 'font-family': 'system-ui' }, initial),
    player.cpu ? h('g', { transform: 'translate(38 38)' }, h('circle', { cx: 8, cy: 8, r: 9, fill: '#13232b' }), h('text', { x: 8, y: 9, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#9fd8ff', 'font-size': 8, 'font-weight': 700, 'font-family': 'monospace' }, 'CPU')) : null,
  );
}
