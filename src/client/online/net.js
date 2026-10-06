// Online plumbing: API base, rooms (WebSocket to the Room Durable Object) and matchmaking.

// Where the Brisque Worker lives: an explicit build-time URL (itch builds), local `wrangler dev` while
// developing, otherwise the page's own origin (the Worker serves the game itself).
export const API = (import.meta.env.VITE_BRISQUE_API || (import.meta.env.DEV ? 'http://localhost:8788' : location.origin)).replace(/\/$/, '');
const WS = API.replace(/^http/, 'ws');

const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
};

export async function createRoomCode() {
  const res = await fetch(`${API}/api/rooms`, { method: 'POST' });
  if (!res.ok) throw new Error(`server said ${res.status}`);
  return (await res.json()).code;
}

// Open a room. Resolves once the server has given us a seat. Reconnects automatically (resuming the
// same seat with its token) until close() is called.
export function openRoom(code, { name, color }) {
  const listeners = new Map();
  const emit = (t, msg) => (listeners.get(t) ?? []).forEach((fn) => fn(msg));
  const tokenKey = `brisque:room:${code}`;
  const room = { code, seat: -1, host: -1, peers: [], connected: false };
  let ws = null;
  let closed = false;
  let queue = [];
  let resolveReady;
  let rejectReady;
  const ready = new Promise((res, rej) => { resolveReady = res; rejectReady = rej; });

  function connect() {
    ws = new WebSocket(`${WS}/api/rooms/${code}/ws`);
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ t: 'hello', name, color, token: store.get(tokenKey) ?? undefined }));
    });
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.t === 'welcome') {
        room.seat = msg.seat;
        room.host = msg.host;
        room.connected = true;
        store.set(tokenKey, msg.token);
        room.token = msg.token;
        for (const m of queue.splice(0)) ws.send(m);
        resolveReady(msg);
      }
      if (msg.t === 'peers') { room.peers = msg.peers; room.host = msg.host; }
      if (msg.t === 'error' && room.seat < 0) rejectReady(new Error(msg.message));
      emit(msg.t, msg);
    });
    ws.addEventListener('close', () => {
      room.connected = false;
      emit('disconnected', {});
      if (!closed) setTimeout(connect, 1200);
    });
  }
  connect();

  // (a getter: Object.assign would freeze its value at assign time)
  Object.defineProperty(room, 'isHost', { get: () => room.seat >= 0 && room.seat === room.host });
  return Object.assign(room, {
    ready,
    on(t, fn) { if (!listeners.has(t)) listeners.set(t, []); listeners.get(t).push(fn); return () => listeners.set(t, listeners.get(t).filter((f) => f !== fn)); },
    send(msg) {
      const data = JSON.stringify(msg);
      if (ws?.readyState === WebSocket.OPEN && room.seat >= 0) ws.send(data); else queue.push(data);
    },
    close() { closed = true; ws?.close(); },
  });
}

// Join the matchmaking queue for a party of `size`. onUpdate({ waiting, size }) while waiting.
export function quickMatch({ size = 2, name, onUpdate = () => {} }) {
  const ws = new WebSocket(`${WS}/api/matchmake`);
  let cancel;
  const promise = new Promise((resolve, reject) => {
    ws.addEventListener('open', () => ws.send(JSON.stringify({ t: 'queue', size, name })));
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.t === 'queued') onUpdate(msg);
      if (msg.t === 'matched') { ws.close(); resolve(msg); }
    });
    ws.addEventListener('error', () => reject(new Error('could not reach the matchmaking server')));
    cancel = () => { try { ws.send(JSON.stringify({ t: 'leave' })); } catch { /* closed */ } ws.close(); reject(new Error('cancelled')); };
  });
  return { promise, cancel: () => cancel?.() };
}
