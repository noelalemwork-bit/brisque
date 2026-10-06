// Online matches over a Room. Same interface as match/local.js, so the session can't tell them apart.
//
// Host: runs the real engine (a LocalMatch restricted to its own seats), streams every new state and
// every "a collapse is coming" notice to the room, and applies guests' actions when it is their turn.
// Guest: mirrors the host's states, validates its own actions locally (for instant feedback), and
// sends them to the host.

import { createEngine } from '../../shared/game/index.js';
import { createLocalMatch } from './local.js';

// the full log grows every action and guests never need it
const lean = (state) => ({ ...state, log: [] });

export function createHostMatch({ room, map, config, quantum }) {
  const humanSeats = config.players.map((p, i) => (p.cpu ? -1 : i)).filter((i) => i >= 0);
  const mine = humanSeats.filter((i) => config.players[i].seat === room.seat);
  const match = createLocalMatch({ map, players: config.players, rules: config.rules, seed: config.seed, quantum, first: config.first ?? 0, temperaments: config.temperaments ?? {}, cpuDelay: 450, localSeats: mine });
  match.on('state', ({ state, events }) => room.send({ t: 'state', state: lean(state), events }));
  match.on('measuring', (m) => room.send({ t: 'measuring', ...m }));
  const off = room.on('act', ({ from, action }) => {
    // `from` is a room seat; map it to the game seat that room seat plays
    const gameSeat = config.players.findIndex((p) => !p.cpu && p.seat === from);
    if (gameSeat >= 0 && match.state.turn.current === gameSeat && match.state.winner === null) match.act(action);
  });
  // explicit delegation: spreading the match would freeze its state getter at this moment
  return {
    engine: match.engine,
    get state() { return match.state; },
    start: match.start,
    on: match.on,
    act: match.act,
    controls: match.controls,
    setIdle: match.setIdle,
    dispose() { off(); match.dispose(); },
  };
}

export function createGuestMatch({ room, map, config, initial = null }) {
  const engine = createEngine(map, config.rules);
  const mySeat = config.players.findIndex((p) => !p.cpu && p.seat === room.seat);
  const listeners = { state: new Set(), measuring: new Set(), rejected: new Set() };
  const emit = (type, payload) => listeners[type].forEach((fn) => fn(payload));
  let state = initial;
  let started = false;
  const offs = [
    room.on('state', ({ state: s, events }) => {
      const first = !state;
      state = s;
      emit('state', { state: s, events: first ? [] : events });
    }),
    room.on('measuring', (m) => emit('measuring', m)),
  ];
  return {
    engine,
    get state() { return state; },
    get ready() { return !!state; },
    start() { if (!started && state) { started = true; emit('state', { state, events: [] }); } },
    on: (type, fn) => listeners[type].add(fn),
    act(action) { room.send({ t: 'act', action }); },
    controls: (s = state) => (s && s.turn.current === mySeat && s.winner === null ? mySeat : -1),
    setIdle() {},
    dispose() { offs.forEach((off) => off()); },
  };
}
