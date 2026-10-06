// Authoritative game server: rooms, and every quantum outcome is computed here
// (keeps API tokens off clients and makes results the same for every player).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { MSG, WS_PATH, SERVER_PORT } from '../shared/protocol.js';
import { Circuit } from '../shared/quantum/circuit.js';
import { createBackend } from '../shared/quantum/backend.js';
import { loadEnv } from './env.js';
import { generateMap } from '../shared/mapgen/generate.js';
import { createEngine, GameError } from '../shared/game/index.js';
import { createSampler } from '../shared/quantum/sampler.js';
import { makeRng } from '../shared/rng.js';

loadEnv();
const backend = createBackend(process.env.BRISQUE_QUANTUM ?? 'local');
const rooms = new Map(); // id -> { id, seed, clients: Set<ws>, game?: { engine, state, seats: ws[], queue } }

const DIST = path.resolve(fileURLToPath(import.meta.url), '../../../dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.wav': 'audio/wav' };

// production: serve the built client; in dev Vite serves it and proxies /ws here
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = path.join(DIST, decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404).end('run `npm run build` first, or use `npm run dev`'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server, path: WS_PATH });
const send = (ws, t, data = {}) => ws.readyState === ws.OPEN && ws.send(JSON.stringify({ t, ...data }));
const roomState = (room) => ({ id: room.id, seed: room.seed, players: room.clients.size, started: !!room.game });
const broadcast = (room) => { for (const c of room.clients) send(c, MSG.ROOM_STATE, { room: roomState(room) }); };

function newRoomId() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id;
  do id = Array.from({ length: 5 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
  while (rooms.has(id));
  return id;
}

function leave(ws) {
  const room = ws.room;
  if (!room) return;
  room.clients.delete(ws);
  ws.room = null;
  if (room.clients.size === 0) rooms.delete(room.id);
  else broadcast(room);
}

const handlers = {
  [MSG.CREATE_ROOM](ws) {
    leave(ws);
    const room = { id: newRoomId(), seed: Math.floor(Math.random() * 2 ** 31), clients: new Set([ws]) };
    rooms.set(room.id, room);
    ws.room = room;
    broadcast(room);
  },
  [MSG.JOIN_ROOM](ws, { room: id }) {
    const room = rooms.get(String(id).toUpperCase());
    if (!room) return send(ws, MSG.ERROR, { message: `no room ${id}` });
    leave(ws);
    room.clients.add(ws);
    ws.room = room;
    broadcast(room);
  },
  // `hotseat: n` pads the room to n seats, all extra seats played by the host (solo testing)
  [MSG.GAME_START](ws, { hotseat = 0 }) {
    const room = ws.room;
    if (!room || [...room.clients][0] !== ws) return send(ws, MSG.ERROR, { message: 'only the room host can start' });
    if (room.game) return send(ws, MSG.ERROR, { message: 'game already started' });
    const seats = [...room.clients];
    while (seats.length < Math.min(6, hotseat)) seats.push(ws);
    const engine = createEngine(generateMap(room.seed));
    const { state, events } = engine.createGame({ players: seats.map((_, i) => ({ name: `Player ${i + 1}` })), seed: room.seed });
    room.game = { engine, state, seats, queue: Promise.resolve() };
    broadcastGame(room, events);
  },
  // actions are serialised per room: a collapse on Moth takes ~5 s and nothing may interleave with it
  [MSG.GAME_ACTION](ws, { action }) {
    const game = ws.room?.game;
    if (!game) return send(ws, MSG.ERROR, { message: 'no game in this room' });
    const seat = seatOf(game, ws);
    if (seat < 0) return send(ws, MSG.ERROR, { message: 'spectators cannot act' });
    const act = { ...action, player: seat };
    game.queue = game.queue.then(async () => {
      const reason = game.engine.validate(game.state, act);
      if (reason) return send(ws, MSG.GAME_REJECTED, { action: act, reason });
      try {
        const { state, events } = await game.engine.apply(game.state, act, { sample: roomSampler(ws.room) });
        game.state = state;
        broadcastGame(ws.room, events);
      } catch (err) {
        if (err instanceof GameError) send(ws, MSG.GAME_REJECTED, { action: act, reason: err.message });
        else { console.error(err); send(ws, MSG.ERROR, { message: 'internal error' }); }
      }
    });
  },
  // proves the client -> server -> backend -> client path; replace with real battle circuits
  async [MSG.QUANTUM_DEMO](ws) {
    const res = await backend.run(new Circuit(2).h(0).cx(0, 1), { shots: 64 });
    send(ws, MSG.QUANTUM_RESULT, res);
  },
};

function broadcastGame(room, events) {
  const { state, seats } = room.game;
  for (const c of room.clients) send(c, MSG.GAME_STATE, { state, events, seat: seatOf(room.game, c) });
}

// A socket may own several seats (hotseat): it acts as whichever of them is on turn.
function seatOf(game, ws) {
  const cur = game.state.turn.current;
  return game.seats[cur] === ws ? cur : game.seats.indexOf(ws);
}

// Every quantum outcome goes through here: tell clients a collapse started (bomb-fall animation covers
// the backend latency), then sample on the configured backend with a local fallback.
function roomSampler(room) {
  room.rng ??= makeRng(`sampler:${room.id}:${room.seed}`);
  const sample = createSampler({ backend, rand: room.rng.next, log: (m) => console.warn(`[${room.id}] ${m}`) });
  return async (probs, label) => {
    for (const c of room.clients) send(c, MSG.GAME_MEASURING, { label, probs });
    return sample(probs, label);
  };
}

wss.on('connection', (ws) => {
  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return send(ws, MSG.ERROR, { message: 'bad json' }); }
    const handler = handlers[msg.t];
    if (!handler) return send(ws, MSG.ERROR, { message: `unknown message ${msg.t}` });
    try { await handler(ws, msg); } catch (err) { send(ws, MSG.ERROR, { message: err.message }); }
  });
  ws.on('close', () => leave(ws));
});

server.listen(SERVER_PORT, () => console.log(`brisque server :${SERVER_PORT} (quantum backend: ${backend.name})`));
