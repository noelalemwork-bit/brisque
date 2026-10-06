// Input -> actions. Modes: move (default), deploy, split, bomb. Every action is validated locally
// first so refusals are explained before anything is sent. Also drives the SVG previews.
//
//   move:   click own territory = source · click neighbour = move/attack · Shift+click = start split
//   split:  source, then first target, then second target (the source itself = "stay")
//   deploy: click own certain territory (right-click works in any mode: +1, Shift +5)
//   bomb:   click a superposed or contested territory
//
// Troop picker. A source can hold troops at several probability levels ("layers": 3 certain + 6 that
// exist in half the branches...). The pick is per layer and defaults to everything but one troop.
// Tab / Shift+Tab focus a layer; 1-9 set it, 0 = all of it, +/- and Alt+wheel adjust it; the action bar
// shows one mini stepper per layer. With a single layer this is just the familiar troop count.
//
//   keys: D M S B or ←/→ modes (unavailable ones are skipped; pressing the current one keeps it) · ↑/↓ or +/- count · Tab layer · 1-9 / 0 count
//         · Space end turn · Esc cancel/pause · C centre

import { territoryView } from '../../shared/game/index.js';
import { certainOwner, layers } from '../../shared/game/worlds.js';

export function createController({ engine, map, match, layer, stage, onChange, onToast, onPause }) {
  let mode = 'move';
  let source = -1;
  let first = -1;
  let pick = []; // [{ atLeast, n, max, prob }] for the current source
  let focus = 0;
  let deployN = null; // null = as many as allowed
  let hovered = -1;

  const state = () => match.state;
  const seat = () => match.controls(state());
  const mineAt = (t) => Math.max(0, ...state().worlds.map((w) => w.board[t][seat()] ?? 0));
  const isNeighbour = (a, b) => map.territories[a].neighbors.includes(b);
  const deployLeft = () => {
    const s = state();
    const p = s.players[s.turn.current];
    return Math.min(p.inventory, engine.rules.maxDeployPerTurn - s.turn.deployed);
  };
  const deployCount = () => Math.max(1, Math.min(deployN ?? Infinity, deployLeft()));
  const take = () => pick.filter((l) => l.n > 0).map(({ atLeast, n }) => ({ atLeast, n }));
  const picked = () => pick.reduce((a, l) => a + l.n, 0);
  const pct = (p) => `${Math.round(p * 100)}%`;
  // "2 + 6·50%": certain troops plain, uncertain ones with their probability
  const pickLabel = () => pick.filter((l) => l.n > 0).map((l) => (l.prob > 0.995 ? `${l.n}` : `${l.n}·${pct(l.prob)}`)).join(' + ') || '0';
  const needsCount = () => mode === 'deploy' || (source >= 0 && (mode === 'move' || mode === 'split'));
  const nameOf = (t) => map.territories[t]?.name ?? '?';
  // which modes can do anything right now (unavailable ones are greyed out and skipped by the arrows)
  const MODES = ['deploy', 'move', 'split', 'bomb'];
  function available() {
    const s = state();
    const me = seat();
    if (me < 0) return { deploy: false, move: false, split: false, bomb: false };
    const holdsSome = s.worlds[0].board.some((_, t) => certainOwner(s.worlds, t) === me);
    return {
      deploy: deployLeft() > 0 && holdsSome,
      move: s.turn.moves < engine.rules.movesPerTurn,
      split: s.turn.splits < engine.rules.splitsPerTurn,
      bomb: s.players[me].bombs.includes(0),
    };
  }

  function loadPick(t) {
    const ls = layers(state().worlds, t, seat());
    pick = ls.map((l, i) => ({ atLeast: l.atLeast, prob: l.prob, max: i === 0 ? l.n - 1 : l.n, n: i === 0 ? l.n - 1 : l.n }));
    focus = Math.max(0, pick.map((l) => l.max > 0).lastIndexOf(true));
  }
  const movable = () => pick.map((l, i) => i).filter((i) => pick[i].max > 0);

  // Keep a usable action selected on your turn: each turn opens on Deploy, and when the current action runs
  // out (troops deployed, split spent, no bomb ready) the next available one in bar order takes over.
  let turnKey = '';
  function ensureMode() {
    if (seat() < 0) return;
    const s = state();
    const key = `${s.turn.round}:${s.turn.current}`;
    const ok = available();
    if (key !== turnKey) { turnKey = key; mode = MODES.find((m) => ok[m]) ?? 'move'; return; }
    if (!ok[mode]) mode = MODES.find((m) => ok[m]) ?? 'move';
  }

  function reset(keepMode = false) {
    if (!keepMode) mode = 'move';
    ensureMode();
    source = first = -1;
    pick = [];
    stage.select(-1);
    layer.setPreview(null);
    changed();
  }

  function send(action) {
    const reason = engine.validate(state(), { ...action, player: state().turn.current });
    if (reason) { onToast(reason); return false; }
    match.act(action);
    return true;
  }

  function hint() {
    if (state().winner !== null) return '';
    if (seat() < 0) return `${state().players[state().turn.current].name} is thinking…`;
    const layered = pick.length > 1 ? ' · Tab picks a layer' : '';
    switch (mode) {
      case 'deploy': return `Deploy ${deployCount()} · click one of your territories (right-click +1 anywhere)`;
      case 'bomb': return 'Bomb · click an enemy or entangled territory in reach · rings show what else collapses';
      case 'split':
        if (source < 0) return 'Split · pick the source territory';
        if (first < 0) return `Split ${pickLabel()} from ${nameOf(source)} · pick the first destination (click ${nameOf(source)} itself to stay)${layered}`;
        return `Split · half to ${nameOf(first)} · pick where the other half goes`;
      default:
        return source < 0 ? 'Select one of your territories · ←/→ switch action · Space end turn'
          : `Move ${pickLabel()} from ${nameOf(source)} · click a neighbour · Shift+click to split${layered} · Esc cancel`;
    }
  }

  function changed() {
    updatePreview();
    onChange();
  }

  function updatePreview() {
    const t = hovered;
    if (seat() < 0) return layer.setPreview(null);
    if (mode === 'bomb') {
      const rings = [];
      if (t >= 0) {
        const threads = new Set(territoryView(state(), t).threads);
        if (threads.size) for (let u = 0; u < map.territories.length; u++) if (u !== t && territoryView(state(), u).threads.some((q) => threads.has(q))) rings.push(u);
      }
      return layer.setPreview({ kind: 'bomb', target: t, rings, ok: t >= 0 && engine.canBomb(state(), seat(), t) });
    }
    if (source < 0) return layer.setPreview(null);
    if (mode === 'split') {
      const to = first < 0 ? [t] : [first, t];
      const labels = first < 0 ? [pickLabel()] : ['50%', '50%'];
      return layer.setPreview({ kind: 'split', from: source, to: to.map((x) => (x === source || isNeighbour(source, x) ? x : -1)), labels });
    }
    if (t >= 0 && isNeighbour(source, t)) {
      const v = territoryView(state(), t);
      const enemy = Object.entries(v.expected).filter(([p]) => Number(p) !== seat()).reduce((a, [, x]) => a + x, 0);
      const n = picked();
      const label = enemy > 0 ? `${pickLabel()} ⚔ ~${Math.round((100 * n) / (n + enemy))}%` : pickLabel();
      return layer.setPreview({ kind: 'move', from: source, to: [t], labels: [label] });
    }
    layer.setPreview({ kind: 'move', from: source, to: [], labels: [] });
  }

  function select(t) {
    if (mineAt(t) < 2) { onToast('Need at least 2 troops there to move'); return; }
    source = t;
    first = -1;
    loadPick(t);
    stage.select(t);
    changed();
  }

  function setLayer(i, n) {
    if (!pick[i]) return;
    pick[i].n = Math.max(0, Math.min(pick[i].max, n));
    focus = i;
    changed();
  }

  return {
    // rows for the floating troop picker; empty when no count is needed right now
    ui: () => ({
      mode, hint: hint(), seat: seat(), available: available(),
      picker: !needsCount() || seat() < 0 ? null : {
        title: mode === 'deploy' ? 'Deploy from reserve' : mode === 'split' ? `Split from ${nameOf(source)}` : `Move from ${nameOf(source)}`,
        rows: mode === 'deploy'
          ? (deployLeft() > 0 ? [{ index: -1, label: 'reserve', n: deployCount(), max: deployLeft(), prob: 1, focused: true }] : [])
          : movable().map((i) => ({ index: i, label: pick[i].prob > 0.995 ? 'certain' : pct(pick[i].prob), n: pick[i].n, max: pick[i].max, prob: pick[i].prob, focused: i === focus })),
        total: mode === 'deploy' ? deployCount() : picked(),
      },
    }),
    setValue(index, n) {
      if (index < 0) { deployN = Math.max(1, Math.min(deployLeft() || 1, n)); return changed(); }
      setLayer(index, n);
    },

    hover(t) { hovered = t; updatePreview(); },

    click(t, { shift = false, right = false } = {}) {
      if (seat() < 0 || t < 0) { if (t < 0) reset(true); return; }
      if (right) { send({ type: 'deploy', territory: t, n: shift ? 5 : 1 }); return; }
      if (mode === 'deploy') { send({ type: 'deploy', territory: t, n: deployCount() }); return changed(); }
      if (mode === 'bomb') { if (send({ type: 'bomb', territory: t })) reset(); return; }
      if (mode === 'split') {
        if (source < 0) return select(t);
        if (first < 0) { first = t; return changed(); }
        if (send({ type: 'split', from: source, to: [first, t], take: take() })) reset();
        return;
      }
      // move mode
      if (source < 0 || (t !== source && !isNeighbour(source, t) && certainOwner(state().worlds, t) === seat())) return select(t);
      if (t === source) return reset();
      if (shift) { mode = 'split'; first = t; return changed(); }
      if (!isNeighbour(source, t)) { onToast('Not adjacent'); return; }
      if (send({ type: 'move', from: source, to: t, take: take() })) reset();
    },

    setMode(m) {
      if (seat() < 0) return;
      if (m !== 'move' && !available()[m]) return; // greyed out
      if (m === mode) return; // mode keys never toggle; Esc cancels
      mode = m;
      if (m !== 'split') first = -1;
      if (m === 'bomb' || m === 'deploy') { source = -1; pick = []; stage.select(-1); }
      changed();
    },
    // adjust the focused layer (or the deploy count)
    adjustCount(d) {
      if (mode === 'deploy' || !pick.length) { deployN = Math.max(1, Math.min(deployLeft() || 1, deployCount() + d)); return changed(); }
      setLayer(focus, pick[focus].n + d);
    },
    adjustLayer(i, d) { if (pick[i]) setLayer(i, pick[i].n + d); },
    toggleLayer(i) { if (pick[i]) setLayer(i, pick[i].n > 0 ? 0 : pick[i].max); },

    key(e) {
      const k = e.key;
      if (k === 'Escape') { if (mode !== 'move' || source >= 0) reset(); else onPause(); return; }
      if (seat() < 0) return;
      const lower = k.toLowerCase();
      if (k === 'Tab' && movable().length > 1) {
        e.preventDefault();
        const m = movable();
        focus = m[(m.indexOf(focus) + (e.shiftKey ? m.length - 1 : 1)) % m.length];
        return changed();
      }
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        e.preventDefault();
        const ok = available();
        const list = MODES.filter((m) => ok[m] || m === 'move');
        const i = list.indexOf(mode);
        return this.setMode(list[(i + (k === 'ArrowRight' ? 1 : list.length - 1)) % list.length]);
      }
      if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); return this.adjustCount(k === 'ArrowUp' ? +1 : -1); }
      if (lower === 'd') this.setMode('deploy');
      else if (lower === 'm') this.setMode('move');
      else if (lower === 's') this.setMode('split');
      else if (lower === 'b') this.setMode('bomb');
      else if (lower === 'c') stage.focus(source >= 0 ? source : hovered);
      else if (k === ' ' || k === 'Enter') { e.preventDefault(); if (send({ type: 'endTurn' })) reset(); }
      else if (/^[1-9]$/.test(k)) { if (mode === 'deploy' || !pick.length) { deployN = Number(k); changed(); } else setLayer(focus, Number(k)); }
      else if (k === '0') { if (mode === 'deploy' || !pick.length) { deployN = null; changed(); } else setLayer(focus, pick[focus].max); }
      else if (k === '+' || k === '=') this.adjustCount(+1);
      else if (k === '-' || k === '_') this.adjustCount(-1);
    },

    wheel(dy) { this.adjustCount(dy > 0 ? -1 : 1); },
    reset,
    endTurn() { if (send({ type: 'endTurn' })) reset(); },
  };
}
