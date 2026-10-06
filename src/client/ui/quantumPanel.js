// Quantum panel: every collapse made in this browser, live. Shows the circuit that encodes the odds
// (binary-tree state prep: RY + CX, then measure), the outcome bars with the measured bitstring, and
// the backend's job timeline (submit → queue → run → fetch) with a ticking clock while Moth works.
// Background Atlas jobs (comet-qrng refills, coin tosses) get their own rows. Q toggles it.
// Fed by quantumTrace (see createSampler in shared/quantum/sampler.js and client/quantum.js).
//
// Dev only: ?fakemoth emits synthetic remote jobs on quantumTrace (no API calls) to exercise the timeline.
// Timing uses performance.now + requestAnimationFrame, which ?capture replaces with its virtual clock.

import { piLabel, outcomeInfo, outcomeChip } from './outcomes.js';
import { h, clear, prefs } from './dom.js';
import { quantumTrace } from '../quantum.js';
import { encodeDistribution, pickIndex } from '../../shared/quantum/sampler.js';

const HISTORY = 8;
const JOB_ROWS = 2;
const PHASE_SHORT = { submitting: 'submit', queued: 'queue', processing: 'run', fetching: 'fetch' };

// Coin tosses and background jobs can start before a match (and its panel) exists: keep them until a
// panel takes them.
let backlog = [];
quantumTrace.on((e) => { if (e.kind === 'job' || e.kind === 'coin') backlog.push(e); });

export function createQuantumPanel(root, { map, mode = '', hud = root } = {}) {
  const inflight = new Map(); // collapse id -> record still waiting for its 'end'
  const history = []; // finished collapses, newest first
  const jobs = new Map(); // background job id -> record, insertion order
  const totals = { n: 0, byCode: new Map(), remoteMs: [], jobs: 0 };
  let current = null; // the collapse on display
  let open = prefs.get('qlog.open', false); // a log, opened on demand: each measurement tells its story in the collapse card
  let raf = 0;
  let live = []; // timelines whose running segment grows each frame

  const clock = h('span.qp-clock');
  const title = h('span.qp-title');
  const head = h('button.qp-head', { title: 'Quantum log: every measurement and Moth job this game (Q)', on: { click: () => api.toggle() } },
    h('span.qp-logo', { text: '⚛' }), title, clock, h('kbd', { text: 'Q' }));
  const backend = h('div.qp-backend');
  const circ = h('div.qp-circuit');
  const bars = h('div.qp-probs');
  const timeline = h('div.qp-timeline');
  const jobsEl = h('div.qp-jobs');
  const strip = h('div.qp-history');
  const stats = h('div.qp-stats');
  const el = h('div.qpanel', {}, head, h('div.qp-body', {}, h('div.qp-inner', {}, backend, circ, bars, timeline, jobsEl, strip, stats)));
  root.append(el);

  // the worldlines panel above shrinks to leave room for this one
  const ro = new ResizeObserver(() => hud.style.setProperty('--qp-h', `${el.offsetHeight}px`));
  ro.observe(el);

  const nice = (label = '') => {
    const [kind, n] = label.split(' ');
    const name = map?.territories?.[Number(n)]?.name;
    if (kind === 'bomb') return `Bomb · ${name ?? n}`;
    if (kind === 'territory') return name ?? label;
    if (kind === 'thread') return `Split #${n}`;
    return label || 'collapse';
  };

  function onTrace(e) {
    if (e.kind === 'start') {
      const r = { id: e.id, label: e.label, probs: e.probs, circuit: e.circuit, source: e.source, t0: performance.now(), phases: [], done: false };
      inflight.set(e.id, r);
      current = r;
      render();
      tick();
    } else if (e.kind === 'phase') {
      const r = inflight.get(e.id);
      if (!r) return;
      r.phases.push({ phase: e.phase, ms: e.ms ?? performance.now() - r.t0 });
      if (e.jobId) r.jobId = e.jobId;
      if (r === current) { renderBackend(); renderTimeline(); }
    } else if (e.kind === 'end') {
      const r = inflight.get(e.id);
      if (!r) return;
      Object.assign(r, { done: true, index: e.index, endSource: e.source, ms: e.ms ?? performance.now() - r.t0, error: e.error, u: e.u });
      if (e.jobId) r.jobId = e.jobId;
      inflight.delete(e.id);
      finished(r);
    } else if (e.kind === 'coin') {
      // the quantum coin toss that picked the opener: H on every bit, measure
      const bitsN = Math.max(1, Math.ceil(Math.log2(e.players)));
      const r = { id: `coin-${performance.now()}`, label: 'Who goes first', probs: Array(e.players).fill(1 / e.players), done: true,
        circuit: { numQubits: bitsN, ops: Array.from({ length: bitsN }, (_, q) => ({ gate: 'h', qubits: [q], params: [] })) },
        source: e.source, endSource: e.source, index: e.first, ms: e.ms ?? 0, phases: [], t0: performance.now() };
      finished(r);
    } else if (e.kind === 'job') {
      let j = jobs.get(e.id);
      if (!j) {
        j = { id: e.id, engine: e.engine, mode: e.mode, t0: performance.now() - (e.ms ?? 0), phases: [], done: false };
        jobs.set(e.id, j);
        while (jobs.size > 12) jobs.delete(jobs.keys().next().value);
      }
      if (e.jobId) j.jobId = e.jobId;
      if (e.phase === 'done' || e.phase === 'failed') {
        Object.assign(j, { done: true, failed: e.phase === 'failed', ms: e.ms ?? performance.now() - j.t0, detail: e.detail });
        totals.jobs++;
      } else j.phases.push({ phase: e.phase, ms: e.ms ?? performance.now() - j.t0 });
      render();
      tick();
    }
  }

  function finished(r) {
    const info = backendInfo(r.endSource);
    r.remote = r.phases.length > 0 || info.remote;
    r.fresh = true;
    history.unshift(r);
    history.length = Math.min(history.length, HISTORY);
    totals.n++;
    totals.byCode.set(info.code, (totals.byCode.get(info.code) ?? 0) + 1);
    if (r.remote && !r.error) totals.remoteMs.push(r.ms);
    if (!current || current === r || current.done) current = r;
    if (current === r) { el.classList.remove('landed'); void el.offsetWidth; el.classList.add('landed'); }
    render();
  }

  // --- rendering ------------------------------------------------------------------------------------
  function render() {
    el.classList.toggle('collapsed', !open);
    el.classList.toggle('live', inflight.size > 0);
    el.classList.toggle('empty', !current);
    const busy = inflight.size + [...jobs.values()].filter((j) => !j.done).length;
    title.textContent = !open ? `Quantum log · ${totals.n} measured${busy ? ` · ${busy} running` : ''}` : current ? `${current === history[0] || inflight.has(current.id) ? 'Latest' : 'Past'}: ${nice(current.label)}` : 'Quantum log';
    renderClock();
    renderBackend();
    renderCircuit();
    renderBars();
    renderTimeline();
    renderJobs();
    renderHistory();
    renderStats();
  }

  function renderClock() {
    clock.textContent = current ? fmtMs(elapsed(current), !current.done) : '';
    clock.classList.toggle('ticking', !!current && !current.done);
  }

  function renderBackend() {
    clear(backend);
    if (!current) {
      backend.append(h('div.qp-note', { text: mode === 'remote'
        ? 'In an online game the host\'s browser runs the circuits.'
        : 'Every uncertain territory collapses through a quantum circuit. Each one shows up here.' }));
      return;
    }
    const r = current;
    const info = backendInfo(r.endSource ?? r.source);
    const sub = [info.sub];
    if (r.u !== undefined) sub.push(`u = ${r.u.toFixed(4)} → inverse CDF`);
    if (r.done && r.phases.length && r.endSource !== r.source) sub.unshift(`${backendInfo(r.source).name} failed, fallback`);
    if (r.jobId) sub.push(`job ${shortId(r.jobId)}`);
    backend.append(
      h('span.qp-chip', { class: `qp-chip ${info.tone}`, text: info.code }),
      h('div.qp-bname', {}, h('b', { text: info.name }), h('span', { text: sub.filter(Boolean).join(' · ') })),
    );
  }

  function renderCircuit() {
    clear(circ);
    const r = current;
    if (!r?.circuit) return;
    const { numQubits: m, ops } = r.circuit;
    const pooled = (r.endSource ?? r.source ?? '').startsWith('moth-qrng');
    circ.append(h('div.qp-cap', {},
      h('span', { text: pooled ? 'equivalent circuit' : 'circuit' }),
      h('span', { text: `${m} qubit${m === 1 ? '' : 's'} · ${ops.length} gate${ops.length === 1 ? '' : 's'} · 1 shot` })));
    circ.append(h('div.qp-scroll', {}, circuitSvg(r.circuit, r.done ? r.index : null)));
  }

  function renderBars() {
    clear(bars);
    const r = current;
    if (!r?.probs) return;
    const m = r.circuit?.numQubits ?? Math.max(1, Math.ceil(Math.log2(r.probs.length)));
    const total = r.probs.reduce((a, b) => a + b, 0) || 1;
    const max = Math.max(...r.probs) / total;
    const many = r.probs.length > 8;
    bars.classList.toggle('many', many);
    bars.classList.toggle('done', r.done);
    r.probs.forEach((p, i) => {
      const share = p / total;
      bars.append(h('div.qp-col', { class: `qp-col${r.done && i === r.index ? ' hit' : ''}`, title: `|${bits(i, m)}⟩ ${(share * 100).toFixed(1)}%` },
        h('span.qp-pct', { text: many ? '' : `${Math.round(share * 100)}%` }),
        h('div.qp-bar', {}, h('i', { style: { height: `${max ? Math.max(4, (share / max) * 100) : 0}%` } })),
        h('span.qp-ket', { text: `|${bits(i, m)}⟩` }),
        r.outcomes?.[i] ? outcomeChip(r.outcomes[i]) : null));
    });
    if (r.done) {
      bars.append(h('div.qp-result', {},
        h('span', { text: 'measured' }),
        h('b', { text: bits(r.index, m) }),
        h('span', { text: `${Math.round((r.probs[r.index] / total) * 100)}% chance` })));
    }
  }

  function renderTimeline() {
    clear(timeline);
    live = live.filter((t) => t.job);
    const r = current;
    if (!r) return;
    const info = backendInfo(r.endSource ?? r.source);
    if (!r.phases.length) {
      if (!r.done) {
        timeline.append(h('div.qp-seg', {}, h('i.waiting.active', { style: { flexGrow: 1 } })), h('div.qp-legend', { text: `waiting on ${info.name}…` }));
      } else {
        timeline.append(
          h('div.qp-seg.instant', {}, h('i', { class: info.tone, style: { flexGrow: 1 } })),
          h('div.qp-legend', {}, h('b', { text: r.ms < 1 ? '0 ms' : fmtMs(r.ms) }), ` · ${info.instant}`));
      }
    } else timeline.append(...phaseBar(r).nodes);
    if (r.error) timeline.append(h('div.qp-err', { text: `fell back to local: ${r.error}` }));
  }

  // segmented bar + legend for a record with phases; the running segment grows with the clock
  function phaseBar(r) {
    const seg = h('div.qp-seg');
    const legend = h('div.qp-legend');
    const parts = r.phases.map((p) => {
      const bar = h('i', { class: p.phase, title: p.phase });
      const lab = h('span', { class: `qp-ph ${p.phase}` });
      seg.append(bar);
      legend.append(lab);
      return { ...p, bar, lab };
    });
    const t = { r, parts };
    layout(t);
    if (!r.done) live.push(t);
    return { nodes: [seg, legend], t };
  }

  function layout({ r, parts }) {
    const end = elapsed(r);
    const durs = parts.map((p, i) => Math.max(0, (parts[i + 1]?.ms ?? end) - p.ms));
    const total = durs.reduce((a, b) => a + b, 0) || 1;
    parts.forEach((p, i) => {
      p.bar.style.flexGrow = Math.max(durs[i], total * 0.07);
      p.bar.classList.toggle('active', !r.done && i === parts.length - 1);
      p.lab.textContent = `${PHASE_SHORT[p.phase] ?? p.phase} ${fmtMs(durs[i])}`;
    });
  }

  // background Atlas jobs: newest first, running ones always shown
  function renderJobs() {
    clear(jobsEl);
    live = live.filter((t) => !t.job);
    const list = [...jobs.values()].reverse().filter((j, i) => !j.done || i < JOB_ROWS).slice(0, JOB_ROWS + 1);
    if (!list.length) return;
    jobsEl.append(h('div.qp-cap', {}, h('span', { text: 'Atlas jobs' }), h('span', { text: `${totals.jobs} finished` })));
    for (const j of list) {
      const clockEl = h('span.qp-jclock', { text: fmtMs(elapsed(j), !j.done) });
      const row = h('div.qp-job', { class: `qp-job${j.done ? '' : ' running'}${j.failed ? ' failed' : ''}` },
        h('div.qp-jhead', {},
          h('span.qp-chip', { class: `qp-chip ${engineTone(j.engine)}`, text: engineCode(j.engine) }),
          h('b', { text: engineName(j) }),
          h('span.qp-jmode', { text: j.done ? (j.failed ? 'failed' : 'done') : j.phases.at(-1)?.phase ?? '' }),
          clockEl));
      if (j.phases.length) {
        const { nodes: [seg, legend], t } = phaseBar(j);
        Object.assign(t, { job: true, clockEl });
        row.append(seg, j.done ? h('div.qp-legend', { text: j.failed ? `failed: ${j.detail ?? ''}` : (j.detail ?? `job ${shortId(j.jobId ?? '')}`) }) : legend);
      }
      jobsEl.append(row);
    }
  }

  function renderHistory() {
    clear(strip);
    for (const r of history) {
      const info = backendInfo(r.endSource);
      strip.append(h('button.qp-hist', {
        class: `qp-hist ${info.tone}${r === current ? ' on' : ''}${r.error ? ' err' : ''}${r.fresh ? ' new' : ''}`,
        title: `${nice(r.label)} · ${info.name} · ${fmtMs(r.ms)}`,
        on: { click: (ev) => { ev.stopPropagation(); current = r; render(); } },
      }, h('b', { text: info.code }), h('span', { text: r.ms < 1 ? '0' : fmtMs(r.ms, false, true) })));
      r.fresh = false; // only a new chip pops in
    }
  }

  function renderStats() {
    clear(stats);
    if (!totals.n && !totals.jobs) return;
    const codes = [...totals.byCode].map(([c, n]) => `${c} ${n}`).join(' · ');
    if (totals.n) stats.append(h('span', {}, h('b', { text: `${totals.n}` }), ` collapse${totals.n === 1 ? '' : 's'} · ${codes}`));
    const ms = totals.remoteMs;
    const line = [];
    if (ms.length) line.push(`remote avg ${fmtMs(ms.reduce((a, b) => a + b, 0) / ms.length)} · median ${fmtMs(median(ms))}`);
    if (totals.jobs) line.push(`${totals.jobs} Atlas job${totals.jobs === 1 ? '' : 's'}`);
    if (line.length) stats.append(h('span', { text: line.join(' · ') }));
  }

  // live clocks while anything is in flight (the rAF loop stops itself when nothing is)
  function tick() {
    if (raf) return;
    const step = () => {
      raf = 0;
      renderClock();
      for (const t of live) {
        layout(t);
        if (t.clockEl) t.clockEl.textContent = fmtMs(elapsed(t.r), true);
      }
      if (inflight.size || [...jobs.values()].some((j) => !j.done)) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  const off = quantumTrace.on(onTrace);
  const pending = backlog;
  backlog = [];
  pending.forEach(onTrace);
  const stopFake = import.meta.env.DEV && new URLSearchParams(location.search).has('fakemoth') ? fakeMoth() : null;
  render();

  const api = {
    // the engine's `measured` event: label the matching collapse's outcomes with who they favour
    annotate(state, e) {
      const q = e.qubit !== undefined ? state.qubits.find((x) => x.id === e.qubit) : null;
      const r = [current, ...history].find((x) => x && !x.outcomes && x.done && x.probs?.length === e.outcomes.length && x.index === e.chosen);
      if (!r) return;
      r.outcomes = e.outcomes.map((o) => outcomeInfo(state, o, q));
      if (r === current) renderBars();
    },
    el,
    toggle(force) {
      open = force ?? !open;
      prefs.set('qlog.open', open);
      render();
    },
    dispose() {
      off();
      stopFake?.();
      cancelAnimationFrame(raf);
      ro.disconnect();
      hud.style.removeProperty('--qp-h');
      el.remove();
      backlog = [];
    },
  };
  return api;
}

const elapsed = (r) => (r.done ? r.ms : performance.now() - r.t0);

// --- circuit diagram ----------------------------------------------------------------------------------
// Qubit m-1 on top, so the meters read top to bottom as the measured bitstring. Wide circuits shrink to fit
// the panel (max-width), small ones are drawn larger.
const ROW = 26;
const COL = { ry: 34, rx: 34, rz: 34, cx: 15, cz: 15, swap: 15 };

export function circuitSvg({ numQubits: m, ops }, measured) {
  const y = (q) => 12 + (m - 1 - q) * ROW;
  const left = 20;
  let x = left + 4;
  const parts = [];
  for (const op of ops) {
    const w = COL[op.gate] ?? 20;
    const cx = x + w / 2;
    if (op.gate === 'cx' || op.gate === 'cz') {
      const [c, t] = op.qubits;
      parts.push(h('line.qp-link', { x1: cx, x2: cx, y1: y(c), y2: y(t) }), h('circle.qp-ctrl', { cx, cy: y(c), r: 3 }));
      if (op.gate === 'cx') {
        parts.push(h('circle.qp-targ', { cx, cy: y(t), r: 6.5 }),
          h('line.qp-plus', { x1: cx - 6.5, x2: cx + 6.5, y1: y(t), y2: y(t) }),
          h('line.qp-plus', { x1: cx, x2: cx, y1: y(t) - 6.5, y2: y(t) + 6.5 }));
      } else parts.push(h('circle.qp-ctrl', { cx, cy: y(t), r: 3 }));
    } else if (op.qubits.length === 1) {
      const q = op.qubits[0];
      const angle = op.params?.[0];
      const g = h('g.qp-gate', {},
        h('title', { text: `${op.gate.toUpperCase()}${angle !== undefined ? `(${piLabel(angle)} = ${angle.toFixed(4)} rad)` : ''} on q${q}${op.gate === 'ry' && angle !== undefined ? `: tilts the qubit from |0⟩ toward |1⟩; on its own it would read 1 with probability sin²(θ/2) = ${(Math.sin(angle / 2) ** 2 * 100).toFixed(1)}%` : ''}` }),
        h('rect', { x: x + 1, y: y(q) - 11, width: w - 2, height: 22, rx: 4 }),
        h('text.qp-gname', { x: cx, y: y(q) - (angle !== undefined ? 4 : 0) }, op.gate.toUpperCase()));
      if (angle !== undefined) g.append(h('text.qp-angle', { x: cx, y: y(q) + 5.5 }, piLabel(angle)));
      parts.push(g);
    } else {
      const ys = op.qubits.map(y);
      parts.push(h('line.qp-link', { x1: cx, x2: cx, y1: Math.min(...ys), y2: Math.max(...ys) }),
        ...ys.map((yy) => h('text.qp-gname', { x: cx, y: yy }, '×')));
    }
    x += w + 2;
  }
  const meterX = x + 4;
  const width = meterX + 22 + (measured !== null ? 18 : 4);
  const height = 12 + (m - 1) * ROW + 13;
  const wires = [];
  const meters = [];
  for (let q = 0; q < m; q++) {
    wires.push(h('text.qp-qlabel', { x: 2, y: y(q) }, `q${q}`), h('line.qp-wire', { x1: left - 4, x2: meterX, y1: y(q), y2: y(q) }));
    const bit = measured !== null ? (measured >> q) & 1 : null;
    meters.push(h('g.qp-meter', { class: bit !== null ? 'qp-meter set' : 'qp-meter' },
      h('rect', { x: meterX, y: y(q) - 9, width: 20, height: 18, rx: 3 }),
      h('path', { d: `M${meterX + 4} ${y(q) + 4} A6 6 0 0 1 ${meterX + 16} ${y(q) + 4}` }),
      h('line.qp-needle', { x1: meterX + 10, y1: y(q) + 4, x2: meterX + 10 + (bit === null ? 0 : bit ? 4.5 : -4.5), y2: y(q) - 3.5,
        style: { transformOrigin: `${meterX + 10}px ${y(q) + 4}px` } }),
      bit !== null ? h('text.qp-bit', { x: meterX + 30, y: y(q) }, String(bit)) : null));
  }
  return h('svg.qp-svg', { viewBox: `0 0 ${width} ${height}`, style: { width: `${width / 11}rem` } }, ...wires, ...parts, ...meters);
}

// --- helpers ------------------------------------------------------------------------------------------
// A source string in words. Unknown sources (new modes) keep their own name.
export function backendInfo(source = '') {
  const dev = source.match(/\((.*)\)/)?.[1];
  if (source.startsWith('moth-qrng live')) return { code: 'QPU', tone: 'qpu', name: 'Moth · live IBM QPU stream', sub: `fresh comet-qrng bytes${dev ? ` · ${dev}` : ''}`, instant: 'certified QPU entropy, streamed this game' };
  if (source.startsWith('moth-qrng')) return { code: 'QPU', tone: 'qpu', name: 'Moth · IBM QPU pool', sub: `comet-qrng${dev ? ` · ${dev}` : ''}`, instant: 'pre-fetched QPU entropy' };
  if (source.startsWith('moth-tomography')) return { code: 'LIVE', tone: 'live', name: 'Moth · tomography-api-v2', sub: 'live OpenQASM circuit', remote: true, instant: 'live circuit' };
  if (source.startsWith('moth coin-toss')) return { code: 'COIN', tone: 'live', name: 'Moth · coin-toss-v1', sub: 'one shot per bit', remote: true, instant: 'quantum coin toss' };
  if (source.startsWith('quantum-forge')) return { code: 'QF', tone: 'emu', name: 'Quantum Forge', sub: 'WebAssembly simulator in this tab', instant: 'simulated in this tab' };
  if (source.includes('statevector')) return { code: 'EMU', tone: 'emu', name: 'in-browser statevector', sub: 'exact simulation in this tab', instant: 'simulated in this tab' };
  if (source === 'local-fallback') return { code: 'FB', tone: 'warn', name: 'local fallback', sub: 'the remote job failed or timed out', instant: 'seeded fallback' };
  if (source === 'local') return { code: 'LOC', tone: 'loc', name: 'seeded local sampler', sub: 'no quantum backend', instant: 'seeded sampler' };
  const code = source.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || '?';
  return { code, tone: 'other', name: source || 'unknown backend', sub: '', instant: 'resolved' };
}
const engineName = ({ engine = '', mode }) => `${mode === 'qpu' ? 'IBM QPU' : mode === 'emu' ? 'emulator' : mode ?? ''} · ${engine.replace(/-v\d+$/, '')}`;
const engineCode = (e = '') => (e.startsWith('comet') ? 'QRNG' : e.startsWith('coin') ? 'COIN' : e.startsWith('tomography') ? 'TOMO' : e.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || '?');
const engineTone = (e = '') => (e.startsWith('comet') ? 'qpu' : e.startsWith('coin') || e.startsWith('tomography') ? 'live' : 'other');

export const bits = (i, m) => i.toString(2).padStart(m, '0');
const shortId = (id) => (String(id).length > 12 ? `${String(id).slice(0, 6)}…${String(id).slice(-4)}` : String(id));
function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const k = s.length >> 1;
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
}
// live: two decimals while ticking; tiny: history chips
function fmtMs(ms, live = false, tiny = false) {
  if (ms < 1000) return `${Math.round(ms)}${tiny ? '' : ' '}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(live ? 2 : 1)}${tiny ? '' : ' '}s`;
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}${tiny ? '' : ' min'}`;
}

// Dev harness: synthetic Moth-style collapses with every phase (an unknown source now and then), and
// one background comet-qrng job.
function fakeMoth() {
  const timers = new Set();
  const later = (ms, fn) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
  const emit = quantumTrace.emit;
  let id = 1e6;
  const job = () => {
    const k = 2 + Math.floor(Math.random() * 4);
    const raw = Array.from({ length: k }, () => Math.random() + 0.08);
    const sum = raw.reduce((a, b) => a + b, 0);
    const probs = raw.map((p) => p / sum);
    const { circuit } = encodeDistribution(probs);
    const n = id++;
    const jobId = `fake-${Math.random().toString(16).slice(2, 10)}-${n}`;
    const source = Math.random() < 0.2 ? 'quantum-forge (fake)' : 'moth-tomography';
    emit({ kind: 'start', id: n, label: Math.random() < 0.4 ? `bomb ${Math.floor(Math.random() * 42)}` : `territory ${Math.floor(Math.random() * 42)}`, probs, circuit: circuit.toJSON(), source });
    const q = 250 + Math.random() * 400;
    const p = q + 1500 + Math.random() * 4500;
    const f = p + 300 + Math.random() * 900;
    const d = f + 150 + Math.random() * 300;
    emit({ kind: 'phase', id: n, phase: 'submitting', ms: 0 });
    later(q, () => emit({ kind: 'phase', id: n, phase: 'queued', ms: q, jobId }));
    later(p, () => emit({ kind: 'phase', id: n, phase: 'processing', ms: p, jobId }));
    later(f, () => emit({ kind: 'phase', id: n, phase: 'fetching', ms: f, jobId }));
    later(d, () => emit({ kind: 'end', id: n, index: pickIndex(probs, Math.random()), source, ms: d, jobId }));
    later(d + 5000, job);
  };
  const comet = (phase, ms, extra = {}) => emit({ kind: 'job', id: 'comet-fake', engine: 'comet-qrng-v1', mode: 'qpu', phase, ms, jobId: 'fake-comet-0001', ...extra });
  comet('submitting', 0);
  later(600, () => comet('queued', 600));
  later(9000, () => comet('processing', 9000));
  later(16000, () => comet('fetching', 16000));
  later(16500, () => comet('done', 16500, { detail: '16384 B from ibm_fake, Bell S = 2.61' }));
  later(1500, job);
  return () => { timers.forEach(clearTimeout); timers.clear(); };
}
