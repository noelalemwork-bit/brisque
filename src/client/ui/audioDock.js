// Bottom-right audio dock, on every screen: a rotary master-volume knob (drag up/down, scroll, or
// arrow keys when focused) and a mute toggle. Both persist per browser.

import { h, clear } from './dom.js';

export function createAudioDock(root, audio) {
  const knob = h('div.knob', { tabindex: 0, role: 'slider', 'aria-label': 'Master volume', 'aria-valuemin': 0, 'aria-valuemax': 100 });
  const mute = h('button.mutebtn', { title: 'Mute / unmute (all sound)', on: { click: () => audio.setMuted(!audio.muted) } });
  const el = h('div#audio-dock', {}, knob, mute);
  root.append(el);

  // knob: 270° sweep, drag vertically
  let drag = null;
  knob.addEventListener('pointerdown', (e) => { drag = { y: e.clientY, v: audio.volume }; knob.setPointerCapture(e.pointerId); e.preventDefault(); });
  knob.addEventListener('pointermove', (e) => { if (drag) audio.setVolume(drag.v + (drag.y - e.clientY) / 160); });
  knob.addEventListener('pointerup', () => { drag = null; });
  knob.addEventListener('wheel', (e) => { e.preventDefault(); audio.setVolume(audio.volume - Math.sign(e.deltaY) * 0.05); }, { passive: false });
  knob.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { audio.setVolume(audio.volume + 0.05); e.preventDefault(); e.stopPropagation(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { audio.setVolume(audio.volume - 0.05); e.preventDefault(); e.stopPropagation(); }
  });
  knob.addEventListener('dblclick', () => audio.setMuted(!audio.muted));

  function render({ volume, muted }) {
    const a0 = -135;
    const a1 = a0 + 270 * volume;
    const arc = (from, to, r) => {
      const p = (a) => [50 + r * Math.sin((a * Math.PI) / 180), 50 - r * Math.cos((a * Math.PI) / 180)];
      const [x0, y0] = p(from);
      const [x1, y1] = p(to);
      return `M${x0} ${y0} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1} ${y1}`;
    };
    const [px, py] = [50 + 26 * Math.sin((a1 * Math.PI) / 180), 50 - 26 * Math.cos((a1 * Math.PI) / 180)];
    clear(knob).append(h('svg', { viewBox: '0 0 100 100' },
      h('path', { d: arc(-135, 135, 40), stroke: 'rgba(255,255,255,0.14)', 'stroke-width': 9, fill: 'none', 'stroke-linecap': 'round' }),
      volume > 0.005 ? h('path', { d: arc(-135, a1, 40), stroke: muted ? '#7d8a90' : '#f3d98b', 'stroke-width': 9, fill: 'none', 'stroke-linecap': 'round' }) : null,
      h('circle', { cx: 50, cy: 50, r: 30, fill: '#1b2d36', stroke: 'rgba(255,255,255,0.18)', 'stroke-width': 2 }),
      h('line', { x1: 50 + 12 * Math.sin((a1 * Math.PI) / 180), y1: 50 - 12 * Math.cos((a1 * Math.PI) / 180), x2: px, y2: py, stroke: '#f5eedd', 'stroke-width': 5, 'stroke-linecap': 'round' }),
    ));
    knob.setAttribute('aria-valuenow', Math.round(volume * 100));
    knob.title = `Master volume ${Math.round(volume * 100)}%${muted ? ' (muted)' : ''} · drag, scroll or arrow keys`;
    mute.textContent = muted ? '🔇' : volume < 0.34 ? '🔈' : volume < 0.67 ? '🔉' : '🔊';
    mute.classList.toggle('on', muted);
    el.classList.toggle('muted', muted);
  }
  audio.onChange(render);
  render({ volume: audio.volume, muted: audio.muted });
  return { el };
}
