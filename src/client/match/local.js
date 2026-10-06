// A match played entirely in this browser: hotseat humans + CPU players. The engine runs here and
// every quantum outcome comes from the chosen quantum mode (emulator / Moth QPU pool / Moth live).
//
// Match interface (shared with future online matches, see docs/ONLINE.md):
//   on('state', ({ state, events }) => …)   authoritative state + the events that produced it
//   on('measuring', ({ label, probs }) => …) a collapse is in flight (bomb-fall animation starts)
//   on('rejected', ({ action, reason }) => …)
//   act(action)          action.player is filled in by the match
//   controls(state)      which seat this client may act for right now (-1: none)
//   setIdle(promise)     the UI's "animations finished" gate; CPU turns wait on it
//   dispose()

import { createEngine, botAction } from '../../shared/game/index.js';
import { makeRng } from '../../shared/rng.js';

export function createLocalMatch({ map, players, rules, seed, quantum, first = 0, temperaments = {}, cpuPolicy = null, cpuDelay = 350, maxActions = Infinity, localSeats = null }) {
  const engine = createEngine(map, rules);
  const listeners = { state: new Set(), measuring: new Set(), rejected: new Set() };
  const emit = (type, payload) => listeners[type].forEach((fn) => fn(payload));
  const botRng = makeRng(`bot:${seed}`);
  let { state, events: firstEvents } = engine.createGame({ players, seed, first });
  let queue = Promise.resolve();
  let idle = Promise.resolve();
  let disposed = false;

  const sample = async (probs, label) => {
    emit('measuring', { label, probs });
    return quantum.sample(probs, label);
  };

  function act(action) {
    const act = { ...action, player: state.turn.current };
    queue = queue.then(async () => {
      if (disposed) return;
      const reason = engine.validate(state, act);
      if (reason) return emit('rejected', { action: act, reason });
      const res = await engine.apply(state, act, { sample });
      state = res.state;
      emit('state', { state, events: res.events });
      driveCpu();
    });
    return queue;
  }

  // CPU seats act one action at a time, each after the previous animations have played
  let cpuBusy = false;
  async function driveCpu() {
    if (cpuBusy || disposed || state.winner !== null || !state.players[state.turn.current].cpu || state.log.length >= maxActions) return;
    cpuBusy = true;
    await idle;
    await new Promise((r) => setTimeout(r, typeof cpuDelay === 'function' ? cpuDelay() : cpuDelay));
    cpuBusy = false;
    if (disposed || state.winner !== null || !state.players[state.turn.current].cpu) return;
    act(cpuPolicy ? cpuPolicy(engine, map, state, botRng) : botAction(engine, map, state, botRng, temperaments[state.turn.current]));
  }

  return {
    engine,
    temperaments,
    get state() { return state; },
    start() { emit('state', { state, events: firstEvents }); driveCpu(); },
    on: (type, fn) => listeners[type].add(fn),
    act,
    // hotseat: whoever's turn it is, if human (online host: only its own seats)
    controls: (s = state) => (s.players[s.turn.current].cpu || s.winner !== null || (localSeats && !localSeats.includes(s.turn.current)) ? -1 : s.turn.current),
    setIdle(p) { idle = p; },
    dispose() { disposed = true; },
  };
}
