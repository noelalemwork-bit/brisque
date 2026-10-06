// Matchmaking: one global Durable Object holding a queue per party size (2-4) over hibernating
// WebSockets. When enough players are waiting, it mints a room code and tells each of them to join,
// the first one as host.
//
//   client -> lobby   { t: 'queue', size, name }   { t: 'leave' }
//   lobby -> client   { t: 'queued', size, waiting }   { t: 'matched', code, host, players }

import { json } from './util.js';

export class Lobby {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(req) {
    if (new URL(req.url).pathname === '/budget') return this.budget();
    if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'expected websocket' }, 426);
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ size: 0, name: '', since: 0 });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  // The 'budget' instance counts Moth job submissions across every room, so creating rooms can't
  // drain the key's credits. One call per submission: { ok, count, limit }.
  async budget() {
    const day = new Date().toISOString().slice(0, 10);
    const limit = Number(this.env.MOTH_GLOBAL_DAILY_BUDGET ?? 600);
    const b = (await this.ctx.storage.get('moth')) ?? { day, count: 0 };
    if (b.day !== day) Object.assign(b, { day, count: 0 });
    if (b.count >= limit) return json({ ok: false, count: b.count, limit });
    b.count++;
    await this.ctx.storage.put('moth', b);
    return json({ ok: true, count: b.count, limit });
  }

  waiting(size) {
    return this.ctx.getWebSockets()
      .filter((ws) => ws.deserializeAttachment()?.size === size)
      .sort((a, b) => a.deserializeAttachment().since - b.deserializeAttachment().since);
  }

  async webSocketMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.t === 'leave') { ws.serializeAttachment({ size: 0, name: '', since: 0 }); return; }
    if (msg.t !== 'queue') return;
    const size = Math.min(4, Math.max(2, Number(msg.size) || 2));
    ws.serializeAttachment({ size, name: String(msg.name ?? 'Player').slice(0, 14), since: Date.now() });
    const queue = this.waiting(size);
    if (queue.length >= size) {
      const group = queue.slice(0, size);
      const code = newCode();
      const players = group.map((s) => s.deserializeAttachment().name);
      group.forEach((s, i) => {
        s.serializeAttachment({ size: 0, name: '', since: 0 });
        send(s, { t: 'matched', code, host: i === 0, players });
      });
      return;
    }
    for (const s of queue) send(s, { t: 'queued', size, waiting: queue.length });
  }

  async webSocketClose(ws) {
    const { size } = ws.deserializeAttachment() ?? {};
    if (size) for (const s of this.waiting(size).filter((x) => x !== ws)) send(s, { t: 'queued', size, waiting: this.waiting(size).length - 1 });
  }
}

export function newCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...crypto.getRandomValues(new Uint8Array(5))].map((b) => abc[b % abc.length]).join('');
}

function send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch { /* closed */ } }
