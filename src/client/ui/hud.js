// In-game HTML HUD. Pure view: render(state, ctx) redraws from data; callbacks go to the controller.

import { h, clear, pct } from './dom.js';
import { icons, avatarFace } from './icons.js';
import { braidDiagram } from './braid.js';
import { territoryView, threadsView, playerView, measurementOutcomes } from '../../shared/game/index.js';
import { encodeDistribution } from '../../shared/quantum/sampler.js';
import { circuitSvg, bits } from './quantumPanel.js';
import { outcomeInfo, outcomeChip, setTerritoryNames } from './outcomes.js';
import { certainOwner } from '../../shared/game/worlds.js';

export function createHud(root, { engine, map, onAction, onMode, onSetValue = () => {}, onPause }) {
  const el = h('div#hud');
  root.append(el);

  const avatars = h('div.avatars');
  const banner = h('div.banner');
  const hint = h('div.hint');
  const threads = h('div.threads.hidden');
  const tip = h('div.tip.hidden');
  const collapse = h('div.collapse.off');
  // the measurement in flight: its circuit and a ticking Moth phase line; hovering the card keeps it open
  const live = { circ: h('div.ccirc'), phase: h('div.cphase'), run: null };
  const tickLive = () => {
    if (!live.run || live.run.done) return;
    live.phase.textContent = `${live.run.phase} · ${((performance.now() - live.run.t0) / 1000).toFixed(1)} s`;
    requestAnimationFrame(tickLive);
  };
  collapse.addEventListener('mouseenter', () => clearTimeout(collapse.timer));
  collapse.addEventListener('mouseleave', () => { if (!live.run) collapse.timer = setTimeout(() => collapse.classList.add('off'), 1500); });
  const toasts = h('div.toasts');
  // dock: the action bar sits in the exact centre; End turn is a sidecar in the right column
  const bar = h('div.actionbar');
  const endTurn = h('button.endturn', { on: { click: () => onAction({ type: 'endTurn' }) }, title: 'End turn (Space)' }, 'End turn', h('kbd', { text: 'Space' }));
  const dock = h('div.dock', {}, h('div'), bar, h('div.side', {}, endTurn));
  const picker = createPicker(onSetValue);
  const corner = h('div.corner', {}, h('button.btn', { on: { click: onPause }, title: 'Pause (Esc)' }, '❚❚'));
  el.append(avatars, banner, threads, picker.el, dock, hint, tip, collapse, toasts, corner);

  const speaking = new Map(); // pid -> level, fed by voice chat
  let lastTurnKey = '';
  let voice = null; // online games: adapter in game seats (see app.js voiceAdapter)
  let lastState = null;
  let temperaments = {}; // CPU seat -> traits from an entangled state (quantum.js temperaments)

  // --- avatars ------------------------------------------------------------------------------------
  function renderAvatars(state) {
    lastState = state;
    clear(avatars);
    // sidebar voice toggle: opt-in, nothing touches the microphone until you press it
    if (voice) {
      avatars.append(h('button.voicebar', {
        class: `voicebar${voice.joined ? ' on' : ''}`,
        title: voice.joined ? 'Leave voice chat' : 'Join voice chat (asks for your microphone)',
        on: { click: async () => { await (voice.joined ? voice.leave() : voice.join()); renderAvatars(lastState); } },
      }, voice.joined ? '🎧 Leave voice' : '🎙 Join voice'));
    }
    for (const p of state.players) {
      const certain = [...Array(map.territories.length).keys()].filter((t) => certainOwner(state.worlds, t) === p.id).length;
      const level = speaking.get(p.id) ?? 0;
      const self = voice?.joined && voice.selfSeat === p.id;
      const muted = voice?.joined && (self ? voice.selfMuted : voice.canHear(p.id) && voice.isMuted(p.id));
      avatars.append(h('div.avatar', {
        class: ['avatar', state.turn.current === p.id && state.winner === null ? 'active' : '', p.alive ? '' : 'dead', level > 0.05 ? 'speaking' : '', muted ? 'muted' : ''].join(' '),
        style: { '--c': p.color, '--level': level },
        'data-pid': p.id,
      },
      h('div.face', {}, h('div.ripple'), h('div.ripple'), h('div.ripple'), avatarFace(p, 64)),
      h('div.info', {},
        h('div.name', { style: { color: p.color }, text: p.name }),
        h('div.stats', { text: `${certain} land · ${p.inventory} reserve` }),
        h('div.stats', { text: `bombs ${p.bombs.filter((b) => b === 0).length}/${p.bombs.length}` }),
        temperaments[p.id] ? h('div.temper', { text: temperLabel(temperaments[p.id], state.players), title: temperTitle(temperaments[p.id]) }) : null,
      ),
      // voice buttons: your own mic, or mute/unmute each other speaker
      voice?.joined && (self || voice.canHear(p.id))
        ? h('button.vbtn', {
          class: `vbtn${muted ? ' off' : ''}`,
          title: self ? (muted ? 'Unmute your microphone' : 'Mute your microphone') : muted ? `Unmute ${p.name}` : `Mute ${p.name}`,
          on: { click: () => { if (self) voice.setSelfMuted(!voice.selfMuted); else voice.setMuted(p.id, !muted); renderAvatars(lastState); } },
        }, self ? (muted ? '🔇' : '🎙') : muted ? '🔇' : '🔊')
        : null,
      ));
    }
  }

  // --- action bar ------------------------------------------------------------------------------------
  function renderBar(state, ui) {
    clear(bar);
    const pv = playerView(state, state.turn.current, engine);
    const locked = ui.seat < 0;
    bar.classList.toggle('locked', locked);
    endTurn.disabled = locked;
    const ok = ui.available ?? {};
    const act = (mode, label, icon, n, key) =>
      h('button.act', { class: `act${ui.mode === mode ? ' on' : ''}`, disabled: mode !== 'move' && !ok[mode], title: `${label} (${key})`, on: { click: () => onMode(mode) } }, icon, h('span.label', { text: label }), h('span.n', { text: n }));
    bar.append(
      act('deploy', 'Deploy', icons.deploy(), `${Math.min(pv.deployLeft, pv.inventory)} left`, 'D'),
      act('move', 'Move', icons.move(), `${pv.movesLeft} left`, 'M'),
      act('split', 'Split', icons.split(), `${pv.splitsLeft} left`, 'S'),
      h('div.sep'),
      h('div.bombs', { class: `bombs${ui.mode === 'bomb' ? ' armed' : ''}${ok.bomb ? '' : ' spent'}`, title: 'Bombs (B): collapse a territory. Each recharges over 3 turns.' },
        h('span.label', { text: ui.mode === 'bomb' ? 'Armed' : 'Bombs' }),
        h('div.slots', {}, ...pv.bombs.map((cd) => h('button.bomb', {
          class: `bomb${cd ? ' cooling' : ''}`,
          style: { '--cool': cd / engine.rules.bombCooldown },
          on: { click: () => onMode('bomb') },
        }, icons.bomb(cd ? '#6b6b6b' : '#e0664f'), cd ? h('span.cd', { text: cd }) : null)))),
    );
  }

  const tname = (t) => map.territories[t]?.name ?? '?';
  setTerritoryNames(map.territories.map((x) => x.name));

  // --- threads / braid -------------------------------------------------------------------------------
  function renderThreads(state) {
    const live = threadsView(state);
    threads.classList.toggle('hidden', state.qubits.length === 0);
    if (!state.qubits.length) return;
    clear(threads).append(h('h4', { text: `WORLDLINES · ${live.length} live · ${state.worlds.length} futures` }), braidDiagram(state));
    for (const q of live) {
      const owner = state.players[q.owner];
      const where = q.to.map((t) => (t === q.from ? `stay in ${tname(t)}` : tname(t)));
      const left = Math.max(0, engine.rules.coherenceRounds - q.age);
      threads.append(h('div.thread', {},
        h('span.dot', { style: { background: owner.color } }),
        h('div', {},
          h('div.tname', {}, h('b', { text: `${q.n}` }), ` ${where[0]} `, h('span.muted', { text: 'or' }), ` ${where[1]}`),
          h('div.bar', {}, h('i', { style: { width: pct(1 - q.p1) } })),
          h('div.fine', { text: left ? `resolves by itself in ${left} round${left === 1 ? '' : 's'}` : 'resolves at the end of this round' }),
        )));
    }
  }

  return {
    el,
    setTemperaments(t) { temperaments = t ?? {}; if (lastState) renderAvatars(lastState); },
    render(state, ui) {
      const cur = state.players[state.turn.current];
      const turnKey = `${state.turn.round}:${state.turn.current}`;
      clear(banner).append(
        h('span.who', { style: { color: cur.color }, text: state.winner !== null ? `${state.players[state.winner].name} wins` : `${cur.name}${cur.cpu ? ' (CPU)' : ''}` }),
        h('span.meta', { text: state.winner !== null ? 'game over' : `round ${state.turn.round}${engine.rules.roundLimit ? ` / ${engine.rules.roundLimit}` : ''}` }),
        h('span.quantum', { text: ui.quantumInfo }),
      );
      if (turnKey !== lastTurnKey) { banner.classList.remove('flash'); void banner.offsetWidth; banner.classList.add('flash'); lastTurnKey = turnKey; }
      renderAvatars(state);
      renderBar(state, ui);
      picker.render(ui.picker);
      renderThreads(state);
      hint.textContent = ui.hint;
    },

    // opts.bomb: the player is aiming a bomb, so preview the measurement it would trigger
    tooltip(state, t, pointer, opts = {}) {
      if (t < 0 || !state) { tip.classList.add('hidden'); return; }
      tip.replaceChildren(...tooltipContent(state, t, engine, map), ...(opts.bomb ? [bombPreview(state, t, engine, opts.backend)] : []));
      tip.style.left = `${pointer.x}px`;
      tip.style.top = `${pointer.y}px`;
      tip.classList.remove('hidden');
    },

    measuring({ label }, source) {
      const [kind, id] = label.split(' ');
      const text = kind === 'bomb' ? `Bomb falling on ${tname(Number(id))}` : kind === 'territory' ? `${tname(Number(id))} is resolving` : 'A split is resolving';
      clear(collapse).append(h('div.ctitle', {}, h('span.spinner'), text), live.circ, live.phase, h('div.src', { text: `measuring with ${String(source).replace(/^⚛\s*/, '')}` }));
      clear(live.circ);
      live.phase.textContent = '';
      live.run = null;
      clearTimeout(collapse.timer);
      collapse.classList.remove('off');
    },

    // quantum trace for the measurement in flight: the circuit it runs, then each Moth phase as it happens
    trace(e) {
      if (e.kind === 'start') {
        live.run = { id: e.id, circuit: e.circuit, probs: e.probs, t0: performance.now(), phase: 'running once', source: e.source };
        clear(live.circ).append(h('div.ccap', { text: 'the circuit being measured' }), circuitSvg(e.circuit, null));
        tickLive();
      } else if (live.run?.id === e.id && e.kind === 'phase') {
        live.run.phase = { submitting: 'sending to Moth', queued: 'queued on Moth', processing: 'running on Moth', fetching: 'reading the result' }[e.phase] ?? e.phase;
      } else if (live.run?.id === e.id && e.kind === 'end') {
        Object.assign(live.run, { index: e.index, ms: e.ms, done: true });
      }
    },

    measured(state, e) {
      const q = e.qubit !== undefined ? state.qubits.find((x) => x.id === e.qubit) : null;
      const title = e.cause === 'bomb' ? `Bomb on ${tname(e.territory)}` : q ? `Split of ${q.n} resolved` : `${tname(e.territory)} resolved`;
      const info = (o) => outcomeInfo(state, o, q);
      // the traced run belongs to this measurement when its odds line up with these outcomes
      const run = live.run?.probs?.length === e.outcomes.length ? live.run : null;
      const m = run?.circuit?.numQubits ?? 0;
      const why = e.cause === 'bomb' ? null : q ? 'Nobody looked at this split for 3 rounds, so the environment measured it (decoherence).' : 'This battle went unobserved too long, so the environment measured it (decoherence).';
      clear(collapse).append(
        h('div.ctitle', { text: title }),
        why ? h('div.cwhy', { text: why }) : '',
        ...e.outcomes.map((o, i) => h('div.o', { class: `o${i === e.chosen ? ' win' : ''}` },
          h('span', { text: pct(o.prob) }), h('span.otext', {}, outcomeChip(info(o)), info(o).text), run ? h('span.ket', { text: `|${bits(i, m)}⟩` }) : '')),
        run ? h('div.ccirc', {}, h('div.ccap', { text: `read |${bits(e.chosen, m)}⟩: one run of this circuit picked the highlighted row` }), circuitSvg(run.circuit, e.chosen)) : '',
        h('div.src', { text: `${sourceText(e.source)}${e.ms > 50 ? ` · ${(e.ms / 1000).toFixed(1)} s` : ''}` }),
      );
      live.run = null;
      collapse.classList.remove('off');
      clearTimeout(collapse.timer);
      collapse.timer = setTimeout(() => collapse.classList.add('off'), run ? 6000 : 3500);
    },

    // one extra line on the open collapse card (e.g. the Majorana fusion of the split it just ended)
    note(text) {
      if (collapse.classList.contains('off')) return;
      collapse.append(h('div.cfuse', { text }));
    },

    toast(text, kind = 'error') {
      const t = h('div.toast', { class: `toast ${kind}`, text });
      toasts.append(t);
      setTimeout(() => t.remove(), 3000);
    },

    // floating "+N" on the avatar at turn start
    income(pid, n) {
      const a = avatars.querySelector(`[data-pid="${pid}"] .face`);
      if (!a) return;
      const tag = h('div.income', { text: `+${n}` });
      a.append(tag);
      setTimeout(() => tag.remove(), 1600);
    },

    // Online games: voice adapter (join/leave, mute self, mute others) in game seats.
    setVoice(adapter) { voice = adapter; if (lastState) renderAvatars(lastState); },

    // Voice level 0..1 drives the ripple rings behind that avatar (also while you've muted them).
    setSpeaking(pid, level) {
      speaking.set(pid, level);
      const a = avatars.querySelector(`[data-pid="${pid}"]`);
      if (a) { a.classList.toggle('speaking', level > 0.05); a.style.setProperty('--level', level); }
    },

    dispose() { el.remove(); },
  };
}


// Where an outcome came from, in words.
function sourceText(source = '') {
  if (source.startsWith('moth-qrng live')) return `decided by fresh bits from an IBM quantum computer${source.match(/\((.*)\)/)?.[1] ? ` (${source.match(/\((.*)\)/)[1]})` : ''}, measured this game`;
  if (source.startsWith('moth-qrng')) return `decided by bits measured earlier on an IBM quantum computer${source.match(/\((.*)\)/)?.[1] ? ` (${source.match(/\((.*)\)/)[1]})` : ''}`;
  if (source.startsWith('moth-tomography') || source.startsWith('⚛ Moth · live')) return 'decided by a live circuit on Moth';
  if (source.includes('statevector') || source.includes('Emulator')) return 'decided by the quantum emulator';
  if (source.startsWith('⚛ Moth · IBM')) return 'IBM quantum randomness';
  if (source === 'certain') return 'there was only one possibility';
  return 'decided locally';
}

// Territory tooltip: name, continent, then each army's troops in its colour, centred.
function tooltipContent(state, t, engine, map) {
  const v = territoryView(state, t);
  const terr = map.territories[t];
  const cont = map.continents[terr.continent];
  const viewer = state.turn.current;
  const held = cont.territories.filter((u) => certainOwner(state.worlds, u) === viewer).length;
  const armies = Object.keys(v.presence).map(Number);
  // win share per army over the futures where this is a battle
  const winShare = (p) => v.outcomes.reduce((a, o) => {
    const e = Object.entries(o.cell);
    if (e.length < 2 || !o.cell[p]) return a;
    const total = e.reduce((x, [, n]) => x + n ** engine.rules.battleExponent, 0);
    return a + (o.prob * o.cell[p] ** engine.rules.battleExponent) / total;
  }, 0);
  const caption = (p) => {
    if (v.contested > 0.001) return `${Math.round(winShare(p) * 100)}% to win`;
    const ls = v.layers[p] ?? [];
    if (ls.length > 1) return ls.map((l, i) => (i === 0 && l.prob > 0.995 ? `${l.n}` : `+${l.n} at ${Math.round(l.prob * 100)}%`)).join(' ');
    if (v.presence[p] < 0.995) return `in ${Math.round(v.presence[p] * 100)}% of futures`;
    return '';
  };
  const most = (p) => Math.max(...v.outcomes.map((o) => o.cell[p] ?? 0));
  const tags = [];
  if (cont.bridge?.includes(t)) tags.push('land bridge');
  if (v.threads.length) tags.push(`entangled with ${v.threads.length} split${v.threads.length === 1 ? '' : 's'}`);
  return [
    h('div.tname', { text: terr.name }),
    h('div.tcont', { text: cont.name }),
    armies.length
      ? h('div.tarmies', {}, ...armies.flatMap((p, i) => [
        i ? h('span.tvs', { text: v.contested > 0.001 ? '⚔' : '·' }) : null,
        h('div.tarmy', { style: { color: state.players[p].color } },
          h('div.tcount', { text: String(most(p)) }),
          h('div.tpname', { text: state.players[p].name }),
          caption(p) ? h('div.tcap', { text: caption(p) }) : null),
      ]).filter(Boolean))
      : h('div.tempty', { text: 'Unclaimed' }),
    h('div.tbonus', { text: `Hold all ${cont.territories.length} of ${cont.name}: +${cont.bonus} troops a turn · ${held} of ${cont.territories.length} held` }),
    tags.length ? h('div.ttags', { text: tags.join(' · ') }) : null,
  ].filter(Boolean);
}

// Floating troop picker. Built once per shape (title + rows) and updated in place, so a slider being
// dragged is never rebuilt under the pointer. Hidden (faded, no layout change) when no count is needed.
function createPicker(onSetValue) {
  const el = h('div.picker.off');
  const title = h('div.ptitle');
  const total = h('div.ptotal');
  const rows = h('div.prows');
  el.append(h('div.phead', {}, title, total), rows);
  let shape = '';
  let refs = [];
  return {
    el,
    render(p) {
      if (!p || !p.rows.length) { el.classList.add('off'); return; }
      el.classList.remove('off');
      title.textContent = p.title;
      total.textContent = `${p.total} troop${p.total === 1 ? '' : 's'}`;
      const next = p.title + '|' + p.rows.map((r) => `${r.index}:${r.max}`).join(',');
      if (next !== shape) {
        shape = next;
        clear(rows);
        refs = p.rows.map((r) => {
          const slider = h('input', { type: 'range', min: 0, max: r.max, step: 1, value: r.n });
          slider.addEventListener('input', () => onSetValue(r.index, Number(slider.value)));
          const value = h('span.pval');
          const row = h('div.prow', {},
            h('div.plabel', {}, h('span', { text: r.label }), h('div.bar', {}, h('i', { style: { width: `${Math.round(r.prob * 100)}%` } }))),
            h('button.pbtn', { on: { click: () => onSetValue(r.index, 0) }, title: 'none' }, '0'),
            slider,
            h('button.pbtn', { on: { click: () => onSetValue(r.index, r.max) }, title: 'all' }, 'all'),
            value);
          rows.append(row);
          return { row, slider, value };
        });
      }
      p.rows.forEach((r, i) => {
        const ref = refs[i];
        if (document.activeElement !== ref.slider) ref.slider.value = r.n;
        ref.slider.style.setProperty('--fill', `${r.max ? (100 * r.n) / r.max : 0}%`);
        ref.value.textContent = `${r.n}/${r.max}`;
        ref.row.classList.toggle('focused', !!r.focused && p.rows.length > 1);
      });
    },
  };
}

// "bold dreamer · rival of Curie": the strongest Bloch components of a CPU's qubit, and its most anti-correlated peer
function temperLabel(t, players) {
  const words = [['aggression', 'bold', 'wary'], ['superposition', 'dreamer', 'realist'], ['expansion', 'settler', 'homebody']]
    .map(([k, pos, neg]) => ({ v: t[k] ?? 0, w: (t[k] ?? 0) > 0 ? pos : neg }))
    .filter((x) => Math.abs(x.v) > 0.3)
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .slice(0, 2)
    .map((x) => x.w);
  const [rival, zz] = Object.entries(t.rivals ?? {}).sort((a, b) => a[1] - b[1])[0] ?? [];
  const parts = [words.join(' ') || 'balanced'];
  if (zz < -0.3) parts.push(`rival of ${players[rival]?.name ?? '?'}`);
  return parts.join(' · ');
}
function temperTitle(t) {
  const f = (v) => (v >= 0 ? '+' : '') + (v ?? 0).toFixed(2);
  return `Temperament from one qubit of an entangled state (${t.source}): ⟨Z⟩ ${f(t.aggression)} aggression · ⟨X⟩ ${f(t.superposition)} superposition · ⟨Y⟩ ${f(t.expansion)} expansion`;
}

// Bomb aim preview: the outcomes this bomb would measure (the engine's exact list) and the circuit that runs
// once to pick one of them. Each row is labelled by the bitstring that selects it.
function bombPreview(state, t, engine, backend = '') {
  if (!engine.isUncertain(state, t)) return h('div.tbomb', {}, h('div.tbomb-h', { text: 'Nothing to measure: this territory is already certain' }));
  const outs = measurementOutcomes(state, t, engine.rules);
  const { circuit } = encodeDistribution(outs.map((o) => o.prob));
  const m = circuit.numQubits;
  const rows = outs.map((o, i) => ({ i, p: o.prob, info: outcomeInfo(state, { cell: o.group.cell, victor: o.victor }) })).filter((r) => r.p > 1e-9);
  return h('div.tbomb', {},
    h('div.tbomb-h', { text: 'If you bomb here, one of these happens' }),
    ...rows.slice(0, 6).map((r) => h('div.o', {}, h('span', { text: pct(r.p) }), h('span.otext', {}, outcomeChip(r.info), r.info.text), h('span.ket', { text: `|${bits(r.i, m)}⟩` }))),
    rows.length > 6 ? h('div.tbomb-n', { text: `+${rows.length - 6} less likely outcomes` }) : '',
    h('div.ccirc', {}, circuitSvg(circuit.toJSON(), null)),
    h('div.tbomb-n', { text: `This circuit holds those odds as amplitudes. The bomb runs it once${backend ? ` (${backend})` : ''}, and the bitstring it reads picks the row.` }));
}
