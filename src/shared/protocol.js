// Wire messages, JSON over one WebSocket. Keep every type listed here so client and server agree.
export const MSG = {
  // client -> server
  CREATE_ROOM: 'room:create',
  JOIN_ROOM: 'room:join',
  QUANTUM_DEMO: 'quantum:demo',
  GAME_START: 'game:start', // { hotseat? } host only; seats = room members in join order, padded to `hotseat` by the host
  GAME_ACTION: 'game:action', // { action } — server overwrites action.player with the sender's seat
  // server -> client
  ROOM_STATE: 'room:state',
  QUANTUM_RESULT: 'quantum:result',
  GAME_STATE: 'game:state', // { state, events, seat } full state + the events that produced it
  GAME_MEASURING: 'game:measuring', // { label, probs } a collapse is in flight (Moth: ~5 s) -> start bomb-fall animation
  GAME_REJECTED: 'game:rejected', // { action, reason }
  ERROR: 'error',
};

export const WS_PATH = '/ws';
export const SERVER_PORT = Number(globalThis.process?.env?.BRISQUE_PORT ?? 8787);
