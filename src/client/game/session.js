// One running game on screen: binds a match (local now, online later) to the stage, HUD, SVG board
// layer, 3D pieces and controller. Each batch of engine events plays as animation; the pieces then
// settle on the batch's final state. CPU players wait for the playback to finish (match.setIdle).
//
// Collapse choreography: the bomb starts falling as soon as the collapse is requested (the
// `measuring` message, before the outcome exists). When the outcome arrives the bomb plunges, and
// on impact the board jumps to the collapsed state: losers in the target are blasted outward,
// possibilities that vanished elsewhere (entangled territories) evaporate, and ground colours regrow
// from each centroid.

import { createHud } from '../ui/hud.js';
import { createQuantumPanel } from '../ui/quantumPanel.js';
import { quantumTrace } from '../quantum.js';
import { createBoardLayer } from '../ui/boardLayer.js';
import { createController } from './controller.js';
import { createPawns } from '../pieces/pawns.js';
import { createGround } from '../pieces/ground.js';
import { createBombs } from '../pieces/bomb.js';
import { createWorldlines } from '../pieces/worldlines.js';
import { boardView } from '../../shared/game/index.js';
import { certainOwner } from '../../shared/game/worlds.js';
import { resetFusions, threadsResolved } from '../majorana/fusion.js';

const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

// audio: optional (sound effects + music phase). attract: a menu backdrop, no HUD and no input, and the
// camera drifts toward whatever just happened.
const SILENT = { play() {}, setPhase() {} };
export function createSession({ stage, root, match, quantum, speed = 1, onGameOver, onPause, audio = SILENT, attract = false }) {
  const { map } = stage;
  const engine = match.engine;
  const layer = createBoardLayer(root, stage);
  layer.setBoard(map);
  layer.setSpeed(speed);
  const pawns = createPawns(stage);
  const ground = createGround(stage, pawns);
  const bombs = createBombs(stage, pawns);
  const worldlines = createWorldlines(stage, pawns);

  // Move every visual layer to `state`. removal(t) picks how departing pawns leave.
  function settle(state, { removal, animate = speed > 0 } = {}) {
    const views = boardView(state);
    pawns.sync(views, state.players, { removal: speed ? removal : () => 'shrink' });
    ground.sync(views, state.players, { animate });
    worldlines.sync(state);
    layer.render(state);
  }

  let shown = match.state;
  const stats = { collapses: 0, quantumCollapses: 0, source: quantum.mode };
  let landing = null; // { t, resolve, done } for the bomb in flight

  const controller = createController({
    engine, map, match, layer, stage,
    onChange: () => redraw(),
    onToast: (t) => hud.toast(t),
    onPause,
  });
  const hud = createHud(root, {
    engine, map,
    onAction: (a) => (a.type === 'endTurn' ? controller.endTurn() : match.act(a)),
    onMode: (m) => controller.setMode(m),
    onSetValue: (i, n) => controller.setValue(i, n),
    onPause,
  });
  hud.setTemperaments(match.temperaments);
  const qpanel = attract ? null : createQuantumPanel(hud.el, { map, mode: quantum.mode });
  const offTrace = attract ? () => {} : quantumTrace.on((e) => hud.trace(e)); // the collapse card tells each measurement's story

  function redraw() {
    hud.render(shown, { ...controller.ui(), quantumInfo: `⚛ ${quantum.label}` });
  }

  // --- event playback -------------------------------------------------------------------------------
  const color = (p) => shown.players[p]?.color ?? '#fff';
  const play = {
    // income is shown on the player's avatar, never on a territory (it read as troops appearing there)
    turnStarted: (e) => {
      if (e.income) hud.income(e.player, e.income);
      sfx(match.controls({ ...shown, turn: { ...shown.turn, current: e.player } }) >= 0 ? 'yourTurn' : 'turn');
    },
    deployed: async (e) => { sfx('deploy'); look(e.territory); pawns.spawn(e.territory, e.player, e.n); await layer.fx.popText(e.territory, `+${e.n}`, color(e.player), 0.5); },
    moved: (e) => (sfx('move'), look(e.to), speed ? pawns.transfer(e.from, e.to, e.player, Math.max(1, Math.round(e.expected)), { seconds: 0.8 / speed }) : null),
    // a split sends the same troops down both prongs: the pawns duplicate mid-air
    // + a full-screen "reality forks" post effect (vfx/post.js via bombs.fork), not behind the menus
    split: (e) => (sfx('split'), look(e.from), speed && !attract && bombs.fork(e.from, e.to, e.bias ?? 0.5), speed ? Promise.all(e.to.map((t, i) => (t === e.from
      ? layer.fx.popText(t, `${Math.round((i ? e.bias : 1 - e.bias) * 100)}% stay`, '#9fd8ff', 0.8)
      : pawns.transfer(e.from, t, e.player, e.n, { copy: i === 1 || e.to[0] !== e.from, seconds: 0.95 / speed })))) : null),
    contestStarted: (e) => (sfx('battle'), Promise.all([layer.fx.ring(e.territory, '#e0664f', 0.6), layer.fx.popText(e.territory, '⚔ battle', '#e0664f', 0.7)])),
    braided: (e) => layer.fx.popText(e.territory, 'futures cross', '#9fd8ff', 0.7),
    coincided: (e) => (speed ? Promise.all([layer.fx.ring(e.territory, '#f2ead8', 0.8, 80), layer.fx.popText(e.territory, 'both futures meet', '#f2ead8', 0.9)]) : null),
    bombed: (e) => { if (!landing && speed) startBomb(e.territory, color(e.player)); },
    measured: async (e, after) => {
      stats.collapses++;
      if (!['local', 'certain', 'local-fallback'].includes(e.source)) stats.quantumCollapses++;
      stats.source = e.source;
      hud.measured(shown, e);
      qpanel?.annotate(shown, e);
      if (e.cause === 'bomb' && landing) {
        // the outcome is in: the bomb plunges, and the board collapses at the moment of impact
        const flight = landing;
        landing = null;
        flight.resolve(after);
        await flight.done;
        return;
      }
      // decoherence: no bomb; the vanished possibilities evaporate
      sfx('collapse');
      settle(after, { removal: () => 'evaporate' });
      if (e.territory !== undefined && speed) await layer.fx.ring(e.territory, '#9fd8ff', 0.9, 90);
      else if (speed) await wait(0.5 / speed);
    },
    threadsClosed: (e, after) => (sfx('resolve'), attract || threadsResolved(after, e.qubits, fused), Promise.all(e.qubits.map((q) => {
      const t = shown.qubits.find((x) => x.id === q)?.from;
      return t === undefined || !speed ? null : layer.fx.popText(t, 'split resolved', '#9fd8ff', 0.8);
    }))),
    eliminated: (e) => hud.toast(`${shown.players[e.player].name} has been eliminated`, 'info'),
  };

  // Majorana braid (cosmetic): a resolved thread's crossed partners are fused on majorana-lattice in a
  // Worker; when a result lands, the braid strand ends get their ψ / 1, and the open collapse card (the
  // measurement that ended the thread) gains one line explaining it. No toast: it's flavour, not a decision.
  function fused({ q, r, linked, fermion }) {
    if (disposed) return;
    redraw();
    hud.note(`${fermion ? 'ψ' : '1'} · worldlines of splits #${q} and #${r} ${linked ? 'were linked' : 'never linked'}: their simulated Majoranas fused to ${fermion ? 'a fermion' : 'nothing (vacuum)'} (majorana-lattice)`);
  }

  function sfx(name) { if (speed) audio.play(name); }
  // attract mode: glide the camera's focus toward the latest action
  function look(t) { if (attract && t >= 0) stage.attend?.(t); }
  // music: early/midgame until the endgame (the last 40% of the round limit, or anyone holding 40% of
  // the map with certainty)
  function musicPhase(state) {
    if (attract) return;
    const limit = engine.rules.roundLimit;
    const late = (limit && state.turn.round >= limit * 0.6) || state.players.some((p) =>
      state.worlds[0].board.filter((_, t) => certainOwner(state.worlds, t) === p.id).length >= map.territories.length * 0.4);
    audio.setPhase(late ? 'late' : 'early');
  }

  function startBomb(t, bomberColor, probs = []) {
    let resolve;
    const landed = new Promise((r) => { resolve = r; });
    sfx('bombFall');
    look(t);
    const done = bombs.drop(t, landed, {
      color: bomberColor,
      uncertainty: entropy(probs),
      onImpact: (after) => { sfx('bombHit'); settle(after, { removal: (u) => (u === t ? 'blast' : 'evaporate') }); },
    });
    landing = { t, resolve, done };
  }

  let playback = Promise.resolve();
  match.on('state', ({ state, events }) => {
    playback = playback.then(async () => {
      for (const e of events) await play[e.type]?.(e, state);
      shown = state;
      settle(state);
      controller.reset(true);
      redraw();
      musicPhase(state);
      if (state.winner !== null) { sfx('win'); await wait(speed ? 1.2 : 0); onGameOver(state, stats); }
    });
    match.setIdle(playback);
  });

  // fired before the outcome exists: a bomb starts falling right away (it hovers if Moth is slow)
  match.on('measuring', ({ label, probs }) => {
    const bomb = label.match(/^bomb (\d+)/);
    if (bomb && !landing && speed) startBomb(Number(bomb[1]), color(match.state.turn.current), probs);
    hud.measuring({ label }, `⚛ ${quantum.label}`);
  });
  match.on('rejected', ({ reason }) => { sfx('reject'); hud.toast(reason); });

  let active = true;
  let disposed = false;
  if (!attract) resetFusions();
  const offs = [
    stage.on('hover', (t) => { if (active) { controller.hover(t); hud.tooltip(shown, t, stage.pointer, { bomb: controller.ui().mode === 'bomb' && controller.ui().seat >= 0, backend: quantum.label }); } }),
    stage.on('click', (t, mods) => { if (active) controller.click(t, mods); }),
    stage.on('wheel', (dy) => { if (active) controller.wheel(dy); }),
  ];
  const onKey = (e) => {
    if (!active || e.repeat) return;
    if (qpanel && (e.key === 'q' || e.key === 'Q') && !e.ctrlKey && !e.metaKey && !e.altKey) return qpanel.toggle();
    controller.key(e);
  };
  addEventListener('keydown', onKey);

  settle(shown, { animate: false });
  redraw();
  musicPhase(shown);
  if (attract) { hud.el.style.display = 'none'; active = false; }

  return {
    hud,
    qpanel,
    controller,
    setActive(on) { active = on; },
    dispose() {
      active = false;
      disposed = true;
      offs.forEach((off) => off());
      removeEventListener('keydown', onKey);
      qpanel?.dispose();
      offTrace();
      hud.dispose();
      layer.dispose();
      pawns.dispose();
      ground.dispose();
      bombs.dispose();
      worldlines.dispose();
      stage.select(-1);
    },
  };
}

// Shannon entropy of an outcome distribution, normalised to 0..1 (1: all outcomes equally likely)
function entropy(probs = []) {
  const p = probs.filter((x) => x > 1e-12);
  if (p.length < 2) return 0;
  const total = p.reduce((a, b) => a + b, 0);
  return -p.reduce((a, x) => a + (x / total) * Math.log2(x / total), 0) / Math.log2(p.length);
}
