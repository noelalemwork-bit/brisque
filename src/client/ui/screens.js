// Full-screen HTML menus layered over the 3D view: home, local setup, how to play, pause, game over.

import { h, clear, prefs } from './dom.js';
import { avatarFace } from './icons.js';
import { PLAYER_COLORS } from '../../shared/game/index.js';
import { QUANTUM_MODES, BRISQUE_API } from '../quantum.js';
import { createQrngPool } from '../../shared/quantum/qrng.js';

const NAMES = ['Ada', 'Bohr', 'Curie', 'Dirac', 'Emmy', 'Feynman'];
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

export function createScreens(root) {
  const layer = h('div.screen.hidden');
  root.append(layer);
  const show = (card) => { layer.classList.remove('home'); clear(layer).append(card); layer.classList.remove('hidden'); };
  const hide = () => layer.classList.add('hidden');

  function home({ onLocal, onTutorial, onOnline, onHelp, credits = '' }) {
    show(h('div.card', {},
      h('h1.logo', { text: 'BRISQUE' }),
      h('p.tagline', { text: 'Risk, in superposition. Split your armies across possible worlds, then collapse them.' }),
      h('div.menu', {},
        h('button.btn.primary', { on: { click: onLocal } }, 'Play local', h('small', { text: 'Hotseat and CPU opponents on this device' })),
        h('button.btn', { on: { click: onTutorial } }, 'Tutorial', h('small', { text: 'Learn every move against a gentle CPU, in a few minutes' })),
        h('button.btn', { on: { click: onOnline } }, 'Play online', h('small', { text: 'Quick match, private rooms and voice chat' })),
        h('button.btn', { on: { click: onHelp } }, 'How to play', h('small', { text: 'Rules, quantum moves and controls' })),
      ),
      h('p.fine', { style: { textAlign: 'center', marginTop: '1.4rem' }, text: 'Moth Hack 2026 · Global Quantum Game Jam' }),
      h('p.fine', { style: { textAlign: 'center', marginTop: '0.2rem' }, text: ['Quantum by Moth Quantum and IBM', 'Powered by Quantum Forge', credits].filter(Boolean).join(' · ') }),
    ));
    layer.classList.add('home');
  }

  // Player editor + match options. Calls onStart({ players, seed, quantum, apiKey, rules }).
  function setup({ onStart, onBack, onReroll, seed }) {
    const saved = prefs.get('setup', null);
    let players = saved?.players?.length >= MIN_PLAYERS ? saved.players : [
      { name: 'Ada', color: PLAYER_COLORS[0], cpu: false },
      { name: 'Bohr', color: PLAYER_COLORS[1], cpu: true },
      { name: 'Curie', color: PLAYER_COLORS[2], cpu: true },
    ];
    const canLive = import.meta.env.DEV || !!BRISQUE_API;
    let quantum = QUANTUM_MODES.some((m) => m.id === saved?.quantum) ? saved.quantum : canLive ? 'moth-stream' : 'moth-qpu-pool';
    let apiKey = prefs.get('mothKey', '');
    let mapSeed = seed;
    let roundLimit = saved?.roundLimit ?? 30;
    let returnFraction = saved?.returnFraction ?? 1;
    let speed = saved?.speed ?? 1;

    const list = h('div.players');
    const qList = h('div.options');
    const keyField = h('div.field', {});
    const seedLabel = h('span.muted');

    function renderPlayers() {
      clear(list);
      players.forEach((p, i) => {
        const taken = new Set(players.filter((_, j) => j !== i).map((q) => q.color));
        list.append(h('div.player-row', {},
          avatarFace(p, 36),
          h('div', {},
            h('input', { type: 'text', value: p.name, maxLength: 14, on: { input: (e) => { p.name = e.target.value || `Player ${i + 1}`; save(); } } }),
            h('div.swatches', { style: { marginTop: '6px' } }, ...PLAYER_COLORS.map((c) =>
              h('button.swatch', { class: `swatch${p.color === c ? ' on' : ''}`, style: { background: c }, disabled: taken.has(c), title: c, on: { click: () => { p.color = c; renderPlayers(); } } }))),
          ),
          h('button.chip-toggle', { class: `chip-toggle${p.cpu ? ' on' : ''}`, on: { click: () => { p.cpu = !p.cpu; renderPlayers(); } } }, p.cpu ? 'CPU' : 'Human'),
          h('button.icon-btn', { title: 'Remove player', disabled: players.length <= MIN_PLAYERS, on: { click: () => { players.splice(i, 1); renderPlayers(); } } }, '✕'),
        ));
      });
      if (players.length < MAX_PLAYERS) {
        list.append(h('button.btn', { on: { click: () => {
          const color = PLAYER_COLORS.find((c) => !players.some((p) => p.color === c));
          const name = NAMES.find((n) => !players.some((p) => p.name === n)) ?? `Player ${players.length + 1}`;
          players.push({ name, color, cpu: true });
          renderPlayers();
        } } }, '+ Add player'));
      }
      save();
    }

    function renderQuantum() {
      clear(qList);
      for (const m of QUANTUM_MODES) {
        qList.append(h('label.option', { class: `option${quantum === m.id ? ' on' : ''}`, on: { click: () => { quantum = m.id; renderQuantum(); save(); } } },
          h('input', { type: 'radio', name: 'q', checked: quantum === m.id }),
          h('div', {}, h('b', { text: m.label }), h('small', { text: m.detail })),
        ));
      }
      const live = QUANTUM_MODES.find((m) => m.id === quantum)?.live;
      if (live) qList.append(h('p.fine.qnote', { text: 'Moth runs jobs on a shared queue, so a live call can take seconds to minutes, and engines sometimes time out. For smooth real-time play pick Moth · IBM QPU pool (real hardware randomness, instant) or Quantum Forge (in-browser simulation, instant).' }));
      clear(keyField);
      if (QUANTUM_MODES.find((m) => m.id === quantum)?.live && !canLive) {
        keyField.append(h('span.fine', { text: 'Moth API key (stored only in this browser)' }),
          h('input', { type: 'password', value: apiKey, placeholder: 'moth_…', on: { input: (e) => { apiKey = e.target.value.trim(); prefs.set('mothKey', apiKey); } } }));
      }
    }

    function save() { prefs.set('setup', { players, quantum, roundLimit, returnFraction, speed }); }
    const setSeed = (s) => { mapSeed = s; seedLabel.textContent = `map #${s}`; };
    setSeed(seed);

    show(h('div.card', {},
      h('h2', { text: 'LOCAL GAME' }),
      h('h3', { text: `Players (${MIN_PLAYERS}–${MAX_PLAYERS})` }), list,
      h('h3', { text: 'Map' }),
      h('div.row.spread', {}, seedLabel, h('button.btn', { on: { click: () => setSeed(onReroll()) } }, '↻ New map')),
      h('h3', { text: 'Game length' }),
      h('div.row', {},
        h('select', { on: { change: (e) => { roundLimit = Number(e.target.value); save(); } } },
          ...[[20, '20 rounds'], [30, '30 rounds'], [50, '50 rounds'], [0, 'Until one player remains']].map(([v, l]) => h('option', { value: v, selected: v === roundLimit, text: l }))),
        h('span.fine', { text: 'At the limit, the most territory held with certainty wins.' })),
      h('h3', { text: 'Defeated troops' }),
      h('div.row', {},
        h('select', { on: { change: (e) => { returnFraction = Number(e.target.value); save(); } } },
          ...[[1, 'Return to reserve'], [0.5, 'Half return, half lost'], [0, 'Destroyed (classic Risk)']].map(([v, l]) => h('option', { value: v, selected: v === returnFraction, text: l }))),
        h('span.fine', { text: 'Returning troops makes attacks cheap and games long.' })),
      h('h3', { text: 'Animation speed' }),
      h('div.row', {}, h('select', { on: { change: (e) => { speed = Number(e.target.value); save(); } } },
        ...[[1, 'Normal'], [2, 'Fast'], [0, 'Instant']].map(([v, l]) => h('option', { value: v, selected: v === speed, text: l })))),
      h('h3', { text: 'Quantum' }), qList, keyField,
      h('div.row.spread', { style: { marginTop: '22px' } },
        h('button.btn', { on: { click: onBack } }, '← Back'),
        h('button.btn.primary', { on: { click: () => onStart({ players: structuredClone(players), seed: mapSeed, quantum, apiKey, rules: { roundLimit, returnFraction }, speed }) } }, 'Start game'),
      ),
    ));
    renderPlayers();
    renderQuantum();
  }

  // Online menu. Calls onQuick(size), onCreate(), onJoin(code); name/colour go to prefs('online').
  function online({ onQuick, onCreate, onJoin, onBack }) {
    const me = prefs.get('online', { name: prefs.get('setup', null)?.players?.find((p) => !p.cpu)?.name ?? 'Player', color: PLAYER_COLORS[0] });
    const status = h('div.status', {});
    const code = h('input.code', { type: 'text', placeholder: 'ROOM', maxLength: 5, on: { input: (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); } } });
    const swatches = h('div.swatches', {});
    const drawSwatches = () => {
      clear(swatches).append(...PLAYER_COLORS.map((c) => h('button.swatch', { class: `swatch${me.color === c ? ' on' : ''}`, style: { background: c }, on: { click: () => { me.color = c; prefs.set('online', me); drawSwatches(); } } })));
    };
    drawSwatches();
    const busy = (text, cancel) => {
      clear(status).append(h('span.spinner'), text, cancel ? h('button.linkbtn', { on: { click: cancel } }, 'Cancel') : null);
    };
    show(h('div.card', {},
      h('h2', { text: 'PLAY ONLINE' }),
      h('div.player-row.single', {},
        h('input', { type: 'text', value: me.name, maxLength: 14, on: { input: (e) => { me.name = e.target.value || 'Player'; prefs.set('online', me); } } }),
        swatches),
      h('h3', { text: 'Quick match' }),
      h('div.row', {},
        h('button.btn.primary', { on: { click: () => onQuick(2, me, busy, status) } }, '1 vs 1'),
        h('button.btn', { on: { click: () => onQuick(4, me, busy, status) } }, '4 players')),
      h('h3', { text: 'Private room' }),
      h('div.row', {},
        h('button.btn', { on: { click: () => onCreate(me, busy, status) } }, 'Create room'),
        code,
        h('button.btn', { on: { click: () => code.value.length === 5 && onJoin(code.value, me, busy, status) } }, 'Join')),
      status,
      h('div.row', { style: { marginTop: '1.2rem' } }, h('button.btn', { on: { click: onBack } }, '← Back')),
    ));
  }

  // Lobby for one room. Returns { update } so peer / voice changes re-render in place.
  function lobby({ room, cpus, onStart, onAddCpu, onRemoveCpu, onVoice, onMute, onPeerMute = () => {}, onVoiceLeave = () => {}, onLeave }) {
    const seats = h('div.players', {});
    const actions = h('div.row.spread', { style: { marginTop: '1.2rem' } });
    const voiceRow = h('div.row', {});
    const copy = h('button.btn', { on: { click: () => { navigator.clipboard?.writeText(room.code); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy'; }, 1200); } } }, 'Copy');
    show(h('div.card', {},
      h('h2', { text: 'LOBBY' }),
      h('div.row.spread', {}, h('div', {}, h('div.fine', { text: 'Room code' }), h('div.roomcode', { text: room.code })), copy),
      h('h3', { text: 'Players' }), seats,
      h('h3', { text: 'Voice' }), voiceRow,
      actions,
    ));
    function update({ levels = {}, voice = null } = {}) {
      clear(seats);
      for (const p of room.peers) {
        const level = levels[p.seat] ?? 0;
        const me = p.seat === room.seat;
        const muted = voice?.enabled && (me ? voice.muted : voice.isPeerMuted(p.seat));
        seats.append(h('div.player-row.lobby', { class: `player-row lobby${level > 0.05 ? ' speaking' : ''}${muted ? ' muted' : ''}`, style: { '--c': p.color, '--level': level } },
          avatarFace({ name: p.name, color: p.color }, 36),
          h('div', {}, h('b', { text: p.name }), h('div.fine', { text: [p.seat === room.host ? 'host' : '', me ? 'you' : '', p.online ? '' : 'offline'].filter(Boolean).join(' · ') })),
          voice?.enabled
            ? h('button.vbtn', { class: `vbtn${muted ? ' off' : ''}`, title: me ? (muted ? 'Unmute your microphone' : 'Mute your microphone') : muted ? `Unmute ${p.name}` : `Mute ${p.name}`, on: { click: () => (me ? onMute(!muted) : onPeerMute(p.seat, !muted)) } }, me ? (muted ? '🔇' : '🎙') : muted ? '🔇' : '🔊')
            : h('span.dot', { class: `dot${p.online ? ' on' : ''}` }),
        ));
      }
      cpus.forEach((c, i) => seats.append(h('div.player-row.lobby', {},
        avatarFace({ ...c, cpu: true }, 36),
        h('div', {}, h('b', { text: c.name }), h('div.fine', { text: 'CPU' })),
        room.isHost ? h('button.icon-btn', { on: { click: () => onRemoveCpu(i) }, title: 'Remove' }, '✕') : h('span'))));
      if (room.isHost && room.peers.length + cpus.length < 6) seats.append(h('button.btn', { on: { click: onAddCpu } }, '+ Add CPU'));
      clear(voiceRow).append(
        voice?.enabled
          ? h('button.btn', { on: { click: onVoiceLeave } }, '🎧 Leave voice')
          : h('button.btn', { on: { click: onVoice } }, '🎙 Join voice'),
        h('span.fine', { text: voice?.enabled ? `${Object.values(voice.status().peers).filter((p) => p.state === 'connected').length} connected · mute anyone with their button` : 'Opt-in: your microphone is only used after you join' }),
      );
      const players = room.peers.length + cpus.length;
      clear(actions).append(
        h('button.btn', { on: { click: onLeave } }, '← Leave'),
        room.isHost
          ? h('button.btn.primary', { disabled: players < 2, on: { click: onStart } }, players < 2 ? 'Waiting for players…' : 'Start game')
          : h('span.muted', { text: 'Waiting for the host to start…' }),
      );
    }
    const noteEl = h('div.fine', { style: { marginTop: '0.4rem', color: 'var(--gold)' } });
    voiceRow.after(noteEl);
    update();
    return { update, note(text) { noteEl.textContent = text; } };
  }

  function help({ onBack }) {
    const keys = [
      ['Click own territory', 'select it as the source'],
      ['← / →', 'switch action (deploy, move, split, bomb); unavailable ones are skipped'],
      ['↑ / ↓', 'more / fewer troops'],
      ['Click a neighbour', 'move troops there (attack if it holds an enemy)'],
      ['Shift+click ×2 / S', 'split: troops go to one of two places (click the source itself to "stay")'],
      ['Right-click own', 'deploy +1 (Shift: +5); or D then click'],
      ['B, then click', 'bomb: collapse a superposed or contested territory'],
      ['Troop picker', 'sliders per layer (certain, 50%, …) float above the bar; Tab switches layer'],
      ['1–9, 0, + / −, Alt+wheel', 'troop count of the focused layer (0 = all)'],
      ['Space / Enter', 'end turn'],
      ['Esc', 'cancel, or pause'],
      ['C', 'centre camera on the selection'],
      ['Drag / wheel', 'orbit / zoom the camera'],
    ];
    show(h('div.card', {},
      h('h2', { text: 'HOW TO PLAY' }),
      h('p', { text: 'Conquer the map. Each turn you gain troops, deploy them, move and attack. Brisque adds three quantum moves:' }),
      h('p', {}, h('b', { text: 'Split' }), ' sends troops to one of two places at once, 50/50. Until someone looks, both futures exist. Split uncertain troops again for 25%, 12.5%, and so on.'),
      h('p', {}, h('b', { text: 'Battles' }), ' are superpositions too. When armies meet, each side’s chance of winning equals its share of the troops in that future. You can retreat from a battle, leaving at least one troop.'),
      h('p', {}, h('b', { text: 'Bombs' }), ' collapse a territory. The outcome is measured, and every possibility that disagrees vanishes, including entangled ones elsewhere. Losers’ surviving troops return to reserve. You have 5 bombs, and each takes 3 turns to recharge.'),
      h('p.muted', { text: 'Only territory you hold with certainty pays income, so superposition is a gamble. Splits and battles also collapse on their own after a few rounds.' }),
      h('h3', { text: 'Controls' }),
      h('div.help-grid', {}, ...keys.flatMap(([k, v]) => [h('kbd', { text: k }), h('span', { text: v })])),
      h('div.row', { style: { marginTop: '20px' } }, h('button.btn', { on: { click: onBack } }, '← Back'),
        h('button.btn.primary', { on: { click: () => physics({ onBack: () => help({ onBack }) }) } }, 'The quantum inside →')),
    ));
  }

  // For a general audience: each rule of the game is a piece of real quantum mechanics. The demo qubit is
  // measured with certified IBM QPU randomness from the bundled Moth comet-qrng pool.
  function physics({ onBack }) {
    let a = 6;
    let b = 4;
    let tally = [0, 0];
    let pool = null;
    fetch('./generated/qrng-qpu.json').then((r) => r.json()).then((f) => { pool = createQrngPool({ hex: f.hex, offset: Math.floor(Math.random() * (f.hex.length / 8)) }); }).catch(() => {});
    const draw = () => pool?.next() ?? Math.random();

    // Steane-code survival measured with Moth's tamagotchi-v1 QEC engine (tools/moth/qec-sweep.mjs)
    const qec = h('div.qec');
    fetch('./generated/tamagotchi-v1/qec.json').then((r) => r.json()).then(({ runs }) => {
      const levels = [...new Set(runs.map((r) => r.p))];
      const rate = (r) => r.result?.output?.per_logical?.[0]?.logical_error_rate;
      qec.append(h('div.qec-grid', {}, h('span'), ...[...new Set(runs.map((r) => r.rounds))].map((n) => h('small.muted', { text: `${n} round${n > 1 ? 's' : ''}` })),
        ...levels.flatMap((p) => [
          h('small', { text: `${(p * 100).toFixed(1)}% noise` }),
          ...runs.filter((r) => r.p === p && rate(r) !== undefined).map((r) => h('div.qec-cell', { title: `${r.result.output.corrections_applied} corrections over ${r.params.shots} shots · job ${r.job_id}` },
            h('span.qbar', { style: { width: `${100 * (1 - rate(r))}%`, background: p === levels[0] ? '#81b29a' : '#e07a5f' } }),
            h('b', { text: `${(100 * (1 - rate(r))).toFixed(0)}%` }))),
        ])),
        h('small.muted', { text: 'Chance the stored qubit survives, after N rounds of error correction. Simulated on Moth (tamagotchi-v1, Qiskit QEC).' }));
    }).catch(() => {});

    const svg = h('svg', { viewBox: '-60 -60 120 120', width: 150, height: 150, class: 'bloch' });
    const readout = h('div.qdemo-read');
    const bars = h('div.qdemo-bars');
    function render() {
      const p = a / (a + b); // chance the attacker wins
      const theta = 2 * Math.asin(Math.sqrt(p));
      clear(svg);
      svg.append(
        h('circle', { r: 50, fill: 'none', stroke: 'currentColor', 'stroke-opacity': 0.25 }),
        h('line', { x1: 0, y1: -54, x2: 0, y2: 54, stroke: 'currentColor', 'stroke-opacity': 0.2 }),
        h('text', { x: 0, y: -46, 'text-anchor': 'middle', 'font-size': 9, fill: 'currentColor', text: '|0⟩ defender' }),
        h('text', { x: 0, y: 52, 'text-anchor': 'middle', 'font-size': 9, fill: 'currentColor', text: '|1⟩ attacker' }),
        h('line', { x1: 0, y1: 0, x2: 50 * Math.sin(theta), y2: -50 * Math.cos(theta), stroke: '#e07a5f', 'stroke-width': 3, 'stroke-linecap': 'round' }),
        h('circle', { cx: 50 * Math.sin(theta), cy: -50 * Math.cos(theta), r: 4, fill: '#e07a5f' }),
      );
      readout.textContent = `${a} attackers vs ${b} defenders → RY(θ = ${theta.toFixed(2)} rad) → P(attacker) = sin²(θ/2) = ${(p * 100).toFixed(0)}%`;
      const n = tally[0] + tally[1];
      clear(bars);
      if (n) bars.append(
        h('div', {}, h('b', { text: `Attacker ${tally[1]}` }), h('span.qbar', { style: { width: `${(100 * tally[1]) / n}%`, background: '#e07a5f' } })),
        h('div', {}, h('b', { text: `Defender ${tally[0]}` }), h('span.qbar', { style: { width: `${(100 * tally[0]) / n}%`, background: '#81b29a' } })),
        h('small.muted', { text: `${n} measurements with ${pool ? 'IBM quantum hardware randomness' : 'browser randomness'}` }),
      );
    }
    const slider = (label, get, set) => h('label.qdemo-slider', {}, h('span', { text: label }),
      h('input', { type: 'range', min: 1, max: 20, value: get(), on: { input: (e) => { set(Number(e.target.value)); tally = [0, 0]; render(); } } }));
    const measure = (k) => { const p = a / (a + b); for (let i = 0; i < k; i++) tally[draw() < p ? 1 : 0]++; render(); };

    show(h('div.card.physics', {},
      h('h2', { text: 'THE QUANTUM INSIDE' }),
      h('p', { text: 'Every rule in Brisque is a real piece of quantum mechanics, and every outcome is decided by a real quantum measurement.' }),
      h('p', {}, h('b', { text: 'Superposition (Split). ' }), 'A quantum object can be in several states at once. When you split troops, the game keeps both futures: one where they went left, one where they went right. Neither is "the real one" until something measures it.'),
      h('p', {}, h('b', { text: 'The Born rule (Battles). ' }), 'Quantum mechanics only predicts probabilities: the chance of an outcome is the square of its amplitude. A battle is one qubit rotated by an angle set by the troop ratio. Try it:'),
      h('div.qdemo', {}, svg, h('div', { style: { flex: 1 } },
        slider('Attackers', () => a, (v) => { a = v; }),
        slider('Defenders', () => b, (v) => { b = v; }),
        readout,
        h('div.row', {}, h('button.btn', { on: { click: () => measure(1) } }, 'Measure once'), h('button.btn', { on: { click: () => measure(100) } }, 'Measure ×100')),
        bars)),
      h('p', {}, h('b', { text: 'Measurement and collapse (Bombs). ' }), 'Looking at a quantum system forces it to pick one outcome, and every other possibility disappears. A bomb is a measurement: the territory snaps to one owner, and every future that disagrees is gone.'),
      h('p', {}, h('b', { text: 'Entanglement (threads). ' }), 'Two things can share one quantum state, so measuring one instantly tells you about the other. Troops that split from the same move are entangled: collapse one territory and its twin, anywhere on the map, collapses with it. The braid at the side shows these threads.'),
      h('p', {}, h('b', { text: 'Braiding (ψ and 1). ' }), 'In two dimensions some particles remember how they were wound around each other. Majorana modes are the famous example: make two pairs from nothing, loop one pair through the other, and when each pair is brought back together it leaves behind a fermion instead of nothing. When two threads’ worldlines link (they cross an odd number of times), the game simulates real Majorana modes on Moth’s majorana-lattice (James Wootton’s matching code, a stabilizer simulation run in your browser): linked pairs fuse to a fermion, marked ψ on the braid, and unlinked ones fuse back to nothing, marked 1. This is the physics behind topological quantum computers, which store information in the braid itself.'),
      h('p', {}, h('b', { text: 'Decoherence (timers). ' }), 'Superpositions are fragile: the environment measures them for you sooner or later. That is why splits and battles collapse on their own after a few rounds. Real quantum computers fight back with error correction: one logical qubit is spread over 7 physical qubits (the Steane code), checked and repaired every round. Even so, errors creep in, faster on noisier hardware:'),
      qec,
      h('p', {}, h('b', { text: 'Where the dice come from. ' }), 'Computers cannot make true randomness by themselves. Brisque asks an IBM quantum computer through Moth Quantum (the comet-qrng engine): qubits are measured, and a Bell test (S > 2, impossible for any classical system) shows the device was really quantum. You can also send each battle circuit to Moth live, or simulate it in your browser with Quantum Forge. In a game, press Q to watch every circuit and API call.'),
      h('div.row', { style: { marginTop: '20px' } }, h('button.btn', { on: { click: onBack } }, '← Back')),
    ));
    render();
  }

  function pause({ onResume, onHelp, onQuit }) {
    show(h('div.card', {},
      h('h2', { text: 'PAUSED' }),
      h('div.menu', {},
        h('button.btn.primary', { on: { click: onResume } }, 'Resume'),
        h('button.btn', { on: { click: onHelp } }, 'How to play'),
        h('button.btn', { on: { click: onQuit } }, 'Quit to menu'),
      ),
    ));
  }

  function gameOver({ state, stats, onMenu, onRematch, coda = null }) {
    const w = state.players[state.winner];
    show(h('div.card', { style: { textAlign: 'center' } },
      h('div', { style: { display: 'grid', placeItems: 'center', marginBottom: '10px' } }, avatarFace(w, 84)),
      h('h2', { text: `${w.name.toUpperCase()} WINS` }),
      h('p.muted', { text: `after ${state.turn.round - 1} rounds · ${stats.collapses} collapses, ${stats.quantumCollapses} of them decided ${decidedBy(stats.source)}` }),
      coda,
      h('div.menu', { style: { marginTop: '16px' } },
        h('button.btn.primary', { on: { click: onRematch } }, 'Rematch'),
        h('button.btn', { on: { click: onMenu } }, 'Main menu'),
      ),
    ));
  }

  return { home, setup, online, lobby, help, physics, pause, gameOver, hide, get open() { return !layer.classList.contains('hidden'); } };
}

function decidedBy(source = '') {
  if (source.startsWith('moth-qrng live')) return 'by fresh randomness from an IBM quantum computer';
  if (source.startsWith('moth-qrng')) return 'by an IBM quantum computer';
  if (source.startsWith('moth-tomography')) return 'by live circuits on Moth';
  if (source.startsWith('quantum-forge')) return 'by the Quantum Forge simulator';
  return 'by the quantum emulator';
}
