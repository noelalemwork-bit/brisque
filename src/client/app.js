// Screen flow, with the 3D board always behind the menus:
//   home -> local setup -> game -> game over
//   home -> online (quick match | create | join) -> lobby -> game (host or guest) -> game over

import { createScreens } from './ui/screens.js';
import { createLocalMatch } from './match/local.js';
import { createHostMatch, createGuestMatch } from './match/online.js';
import { createSession } from './game/session.js';
import { createQuantum, QUANTUM_MODES, quantumTrace } from './quantum.js';
import { createCodaView } from './ui/codaView.js';
import { tutorialSeed, passivePolicy, createCoach, TUTORIAL_PLAYERS, TUTORIAL_RULES } from './tutorial.js';
import { createRoomCode, openRoom, quickMatch } from './online/net.js';
import { createVoice } from './online/voice.js';
import { h, prefs } from './ui/dom.js';
import { PLAYER_COLORS } from '../shared/game/index.js';
import { createAudio } from './audio/audio.js';
import { createAudioDock } from './ui/audioDock.js';

export function createApp({ stage, root }) {
  const screens = createScreens(root);
  const params = new URLSearchParams(location.search);
  const audio = createAudio();
  createAudioDock(root, audio);
  // every button click gets a soft tick
  root.addEventListener('click', (e) => { if (e.target.closest('button')) audio.play('click'); });
  let attractMatch = null;
  let attractSession = null;
  const newSeed = () => Math.floor(Math.random() * 1e6);
  let menuSeed = newSeed();
  let session = null;
  let match = null;
  let lastConfig = null;
  let room = null;
  let voice = null;
  let lobbyView = null;
  let cpus = [];
  const levels = {};

  stage.loadBoard(menuSeed);
  stage.setAttract(true);

  function home() {
    stage.setAttract(true);
    stage.setViewShift(0.17); // the island to the right of the home card
    audio.setPhase('menu');
    startAttract();
    screens.home({ onLocal: leaveHome(setup), onTutorial: leaveHome(tutorial), onOnline: leaveHome(online), onHelp: () => screens.help({ onBack: home }), credits: audio.credits });
  }
  const leaveHome = (next) => () => { stopAttract(); stage.setViewShift(0); next(); };

  // Attract mode: four CPUs play for real behind the home screen (no HUD, no input), camera drifting
  // toward the action. Restarts with a new island when a game ends.
  async function startAttract() {
    if (attractSession || params.has('noattract')) return;
    const seed = newSeed();
    stage.loadBoard(seed);
    menuSeed = seed;
    const quantum = await createQuantum('emulator', { seed });
    quantum.label = 'Emulator';
    const players = [['Ada', 0], ['Bohr', 1], ['Curie', 2], ['Dirac', 3]].map(([name, i]) => ({ name, color: PLAYER_COLORS[i], cpu: true }));
    attractMatch = createLocalMatch({ map: stage.map, players, rules: { roundLimit: 18 }, seed, quantum, cpuDelay: 900 });
    attractSession = createSession({
      stage, root, match: attractMatch, quantum, speed: 1, attract: true,
      onGameOver: () => { stopAttract(); if (!session) startAttract(); },
      onPause: () => {},
    });
    attractMatch.start();
  }
  function stopAttract() {
    attractSession?.dispose();
    attractMatch?.dispose();
    attractSession = attractMatch = null;
  }

  function setup() {
    screens.setup({
      seed: menuSeed,
      onBack: home,
      onReroll: () => { menuSeed = newSeed(); stage.loadBoard(menuSeed); return menuSeed; },
      onStart: start,
    });
  }

  const pendingNotes = []; // quantum-mode notes raised before the HUD exists
  async function prepareQuantum(mode, seed, apiKey) {
    const loading = h('div.loading', {}, h('span.spinner'), 'Preparing quantum backend…');
    root.append(loading);
    const quantum = await createQuantum(mode, { seed, apiKey, onLog: (m) => { console.warn('[quantum]', m); pendingNotes.push(m); session?.hud.toast(m, 'info'); } });
    quantum.label = QUANTUM_MODES.find((m) => m.id === quantum.mode)?.label ?? (quantum.mode === 'emulator' ? 'Emulator' : quantum.mode);
    loading.remove();
    return quantum;
  }

  // Who opens the game: a quantum coin toss (Moth coin-toss-v1 in Moth modes, Quantum Forge otherwise)
  // CPU temperaments come from one entangled state (Moth graph-v1 or the emulator), in parallel with the toss
  async function tossForFirst(quantum, players) {
    const loading = h('div.loading', {}, h('span.spinner'), quantum.moth ? 'Tossing a quantum coin and entangling the CPUs on Moth…' : 'Tossing a quantum coin…');
    root.append(loading);
    const cpuSeats = players.map((p, i) => (p.cpu ? i : -1)).filter((i) => i >= 0);
    try {
      const [{ first, source }, temperaments] = await Promise.all([
        quantum.chooseFirst(players.length),
        quantum.temperaments(cpuSeats).catch(() => ({})),
      ]);
      pendingNotes.push(`${players[first].name} opens · quantum coin toss (${source})`);
      return { first, temperaments };
    } catch (err) {
      console.warn('[quantum] coin toss failed', err);
      return { first: 0, temperaments: {} };
    } finally {
      loading.remove();
    }
  }

  let activeQuantum = null; // owns background Moth jobs (live QPU stream) until the game ends
  let coda = null; // game-over prediction card (its reservoir jobs outlive the match)
  let coach = null; // tutorial card
  function beginSession(quantum, speed, requested) {
    activeQuantum = quantum.dispose ? quantum : null;
    session = createSession({ stage, root, match, quantum, speed, onGameOver: gameOver, onPause: pause, audio });
    for (const m of pendingNotes.splice(0)) session.hud.toast(m, 'info');
    if (requested && quantum.mode !== requested) session.hud.toast(`Using ${quantum.label}: the chosen backend was unavailable`, 'info');
    for (const [seat, lvl] of Object.entries(levels)) session.hud.setSpeaking(gameSeatOf(Number(seat)), lvl);
    if (room && voice) session.hud.setVoice(voiceAdapter());
  }

  // The HUD speaks game seats; voice speaks room seats. CPUs and yourself can't be muted as peers.
  function voiceAdapter() {
    const roomSeat = (g) => (lastConfig.players[g]?.cpu ? undefined : lastConfig.players[g]?.seat);
    return {
      get joined() { return !!voice?.enabled; },
      get selfSeat() { return gameSeatOf(room.seat); },
      get selfMuted() { return !!voice?.muted; },
      canHear: (g) => roomSeat(g) !== undefined && roomSeat(g) !== room.seat,
      isMuted: (g) => voice.isPeerMuted(roomSeat(g)),
      setMuted: (g, m) => voice.setPeerMuted(roomSeat(g), m),
      setSelfMuted: (m) => voice.setMuted(m),
      join: () => voice.enable().catch((err) => session?.hud.toast(micHelp(err), 'info')),
      leave: () => voice.disable(),
    };
  }

  async function start(config) {
    lastConfig = config;
    screens.hide();
    const quantum = await prepareQuantum(config.quantum, config.seed + Date.now(), config.apiKey);
    stage.loadBoard(config.seed);
    stage.setAttract(false);
    const speed = config.speed ?? 1;
    const { first, temperaments } = await tossForFirst(quantum, config.players);
    match = createLocalMatch({ map: stage.map, players: config.players, rules: config.rules, seed: config.seed ^ Date.now(), quantum, first, temperaments, cpuDelay: speed ? 350 / speed : 0, maxActions: config.maxActions });
    beginSession(quantum, speed, config.quantum);
    match.start();
  }

  // Tutorial: you (red, first) against a passive sparring CPU on a board where every move is possible on
  // turn one; collapses use the shipped IBM QPU bits, so it is instant and spends no credits.
  async function tutorial() {
    const seed = tutorialSeed();
    lastConfig = { tutorial: true };
    screens.hide();
    const quantum = await prepareQuantum('moth-qpu-pool', seed);
    stage.loadBoard(seed);
    stage.setAttract(false);
    match = createLocalMatch({ map: stage.map, players: TUTORIAL_PLAYERS, rules: TUTORIAL_RULES, seed, quantum, first: 0, cpuPolicy: passivePolicy, cpuDelay: 350 });
    beginSession(quantum, 1, 'moth-qpu-pool');
    coach = createCoach(root, match, {});
    match.start();
  }

  function stop() {
    session?.dispose();
    match?.dispose();
    activeQuantum?.dispose();
    coda?.dispose();
    coach?.dispose();
    session = match = activeQuantum = coda = coach = null;
  }

  // --- online ------------------------------------------------------------------------------------------
  function online() {
    stage.setAttract(true);
    audio.setPhase('menu');
    let pending = null;
    screens.online({
      onBack: () => { pending?.cancel(); home(); },
      onQuick: async (size, me, busy) => {
        pending?.cancel();
        const q = quickMatch({ size, name: me.name, onUpdate: ({ waiting }) => busy(`Looking for players… ${waiting}/${size}`, () => q.cancel()) });
        pending = q;
        busy(`Looking for players… 1/${size}`, () => q.cancel());
        try {
          const { code } = await q.promise;
          await enterRoom(code, me, busy);
        } catch (err) { if (err.message !== 'cancelled') busy(err.message); else online(); }
      },
      onCreate: async (me, busy) => {
        busy('Creating a room…');
        try { await enterRoom(await createRoomCode(), me, busy); } catch (err) { busy(`Could not create a room: ${err.message}`); }
      },
      onJoin: async (code, me, busy) => {
        busy(`Joining ${code}…`);
        try { await enterRoom(code, me, busy); } catch (err) { busy(`Could not join: ${err.message}`); }
      },
    });
  }

  async function enterRoom(code, me, busy) {
    leaveRoom();
    room = openRoom(code, me);
    const welcome = await Promise.race([room.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('the server did not answer')), 10000))]);
    cpus = welcome.lobby?.cpus ?? [];
    voice = createVoice(room, { onLevel });
    room.on('peers', () => lobbyView?.update(lobbyState()));
    room.on('lobby', (m) => { cpus = m.cpus ?? []; lobbyView?.update(lobbyState()); });
    room.on('start', ({ config }) => startGuest(config));
    if (welcome.start && welcome.snapshot) { startGuest(welcome.start.config, welcome.snapshot.state); return; } // reconnecting mid-game
    showLobby();
    void busy;
  }

  const lobbyState = () => ({ levels, voice });
  function showLobby() {
    lobbyView = screens.lobby({
      room, cpus,
      onAddCpu: () => {
        const used = new Set([...room.peers.map((p) => p.color), ...cpus.map((c) => c.color)]);
        cpus.push({ name: ['Bohr', 'Curie', 'Dirac', 'Emmy', 'Feynman'][cpus.length % 5], color: PLAYER_COLORS.find((c) => !used.has(c)) ?? '#aaa', cpu: true });
        room.send({ t: 'lobby', cpus });
        showLobby();
      },
      onRemoveCpu: (i) => { cpus.splice(i, 1); room.send({ t: 'lobby', cpus }); showLobby(); },
      onVoice: async () => {
        try { await voice.enable(); } catch (err) { lobbyView?.note(micHelp(err)); }
        lobbyView?.update(lobbyState());
      },
      onMute: (m) => { voice.setMuted(m); lobbyView?.update(lobbyState()); },
      onPeerMute: (seat, m) => { voice.setPeerMuted(seat, m); lobbyView?.update(lobbyState()); },
      onVoiceLeave: () => { voice.disable(); lobbyView?.update(lobbyState()); },
      onLeave: () => { leaveRoom(); online(); },
      onStart: startHost,
    });
    // keep the voice status line fresh while connections come up
    clearInterval(showLobby.timer);
    showLobby.timer = setInterval(() => { if (!session) lobbyView?.update(lobbyState()); }, 1000);
  }

  function onLevel(seat, level) {
    levels[seat] = level;
    session?.hud.setSpeaking(gameSeatOf(seat), level);
  }
  // room seat -> game seat (humans first in room-seat order, then CPUs)
  const gameSeatOf = (roomSeat) => (lastConfig?.players ?? []).findIndex((p) => !p.cpu && p.seat === roomSeat);

  function onlineConfig() {
    const setupPrefs = prefs.get('setup', {});
    const humans = room.peers.filter((p) => p.online).map((p) => ({ name: p.name, color: p.color, cpu: false, seat: p.seat }));
    // every player needs a distinct colour and name: clashes get the first free colour / a number
    const players = [...humans, ...cpus.map((c) => ({ ...c, cpu: true }))];
    const colors = new Set();
    const names = new Map();
    for (const p of players) {
      if (colors.has(p.color)) p.color = PLAYER_COLORS.find((c) => !colors.has(c)) ?? p.color;
      colors.add(p.color);
      const n = (names.get(p.name) ?? 0) + 1;
      names.set(p.name, n);
      if (n > 1) p.name = `${p.name} ${n}`;
    }
    return {
      seed: newSeed(),
      players,
      quantum: setupPrefs.quantum ?? 'moth-qpu-pool',
      rules: { roundLimit: setupPrefs.roundLimit ?? 30, returnFraction: setupPrefs.returnFraction ?? 1 },
      speed: 1,
    };
  }

  async function startHost() {
    const config = onlineConfig();
    lastConfig = config;
    room.send({ t: 'start', config });
    clearInterval(showLobby.timer);
    screens.hide();
    const quantum = await prepareQuantum(config.quantum, config.seed);
    stage.loadBoard(config.seed);
    stage.setAttract(false);
    const { first, temperaments } = await tossForFirst(quantum, config.players);
    match = createHostMatch({ room, map: stage.map, config: { ...config, first, temperaments }, quantum });
    beginSession(quantum, 1, config.quantum);
    match.start();
  }

  function startGuest(config, snapshot = null) {
    lastConfig = config;
    clearInterval(showLobby.timer);
    screens.hide();
    stage.loadBoard(config.seed);
    stage.setAttract(false);
    match = createGuestMatch({ room, map: stage.map, config, initial: snapshot });
    const quantum = { mode: 'remote', label: 'host decides', sample: null };
    const go = () => { beginSession(quantum, 1); match.start(); };
    if (match.ready) go(); else room.on('state', function once() { if (!session) go(); });
  }

  // Voice needs microphone permission. Embedded pages (itch.io) may not be allowed to ask: point to the full site.
  function micHelp(err) {
    const embedded = window.top !== window;
    if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
      return embedded ? 'This page cannot use your microphone here. For voice chat, play at brisque.noelnegash.workers.dev' : 'Microphone permission was declined.';
    }
    return `Microphone unavailable: ${err?.message ?? err}`;
  }

  function leaveRoom() {
    voice?.disable();
    room?.close();
    clearInterval(showLobby.timer);
    room = voice = lobbyView = null;
    for (const k of Object.keys(levels)) delete levels[k];
  }

  function pause() {
    session?.setActive(false);
    screens.pause({
      onResume: () => { screens.hide(); session?.setActive(true); },
      onHelp: () => screens.help({ onBack: pause }),
      onQuit: () => { stop(); leaveRoom(); home(); },
    });
  }

  function gameOver(state, stats) {
    session?.setActive(false);
    coda?.dispose();
    coda = createCodaView({ state, moth: activeQuantum?.moth ?? null });
    screens.gameOver({
      state, stats, coda: coda.el,
      onRematch: () => { stop(); if (room) showLobby(); else if (lastConfig?.tutorial) tutorial(); else start({ ...lastConfig }); },
      onMenu: () => { stop(); leaveRoom(); home(); },
    });
  }

  // test handle (puppeteer): always in dev, and in production builds with ?e2e
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('e2e')) {
    window.__brisque = { get match() { return match; }, get session() { return session; }, get room() { return room; }, get voice() { return voice; }, get attract() { return attractMatch; }, stage, audio, screens, quantumTrace };
  }

  // test hooks: ?quick (saved setup) or ?quick=cpu (CPU-only autoplay) skip the menus
  const quick = params.get('quick');
  if (quick !== null) {
    const players = quick === 'cpu'
      ? [{ name: 'Ada', color: '#e05a47', cpu: true }, { name: 'Bohr', color: '#3f7fd9', cpu: true }, { name: 'Curie', color: '#e3b43a', cpu: true }]
      : [{ name: 'You', color: '#e05a47', cpu: false }, { name: 'Bohr', color: '#3f7fd9', cpu: true }, { name: 'Curie', color: '#e3b43a', cpu: true }];
    start({ players, seed: menuSeed, quantum: params.get('q') ?? 'emulator', rules: { roundLimit: Number(params.get('rounds') ?? 30) }, speed: params.has('instant') ? 0 : 1, maxActions: Number(params.get('actions') ?? Infinity) });
  } else home();

  return { home };
}
