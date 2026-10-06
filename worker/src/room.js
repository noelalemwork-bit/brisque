// One Durable Object per room. Deliberately thin: it does not run the game engine (the host client
// does, keeping Worker CPU near zero); it keeps seats, relays messages, stores the latest state
// snapshot for reconnects / host migration, relays WebRTC voice signalling, and proxies a budgeted,
// allowlisted slice of the Moth API with the secret key.
//
// WebSocket protocol (JSON, field `t`):
//   client -> room
//     hello   { name, color, token? }          join (or resume a seat with its token)
//     lobby   { players: [...], settings }     host only: publish seats / CPU players / options
//     start   { config }                       host only
//     act     { action }                       guest -> host (relayed to the host only)
//     state   { state, events }                host only -> relayed to all, snapshot stored
//     measuring { label, probs }               host only -> relayed to all
//     signal  { to, data }                     WebRTC offer/answer/ICE for voice, relayed to one peer
//   room -> client
//     welcome { seat, token, host, peers, snapshot? }
//     peers   { peers: [{ seat, name, color, online }], host }
//     act     { from, action }  (host only)     state / measuring / lobby / start (as sent)
//     signal  { from, data }                   error { message }

import { json } from './util.js';

const MOTH = 'https://api.mothquantum.com/api/v1';
const MOTH_ALLOW = [
  /^POST \/engines\/(tomography-api-v2|comet-qrng-v1|graph-v1|coin-toss-v1|qrc-train-v2|qrc-gen-v2|qdrive-api-v1)\/process$/,
  /^GET \/jobs\/[0-9a-f-]{36}\/(status|result)$/,
  /^GET \/me$/,
];

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'expected websocket' }, 426);
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]); // hibernatable
      pair[1].serializeAttachment({ seat: -1 });
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    if (url.pathname.startsWith('/moth/')) return this.moth(req, url.pathname.slice(5));
    if (url.pathname === '/jaas' && req.method === 'POST') return this.jaas(req, url.searchParams.get('code'));
    if (url.pathname === '/solo' && req.method === 'POST') {
      // a single-device game that only wants the Moth proxy: issue a token without a socket
      const token = crypto.randomUUID();
      await this.ctx.storage.put('solo', token);
      return json({ token });
    }
    return json({ error: 'not found' }, 404);
  }

  // --- WebSocket handlers (hibernation API) --------------------------------------------------------
  async webSocketMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return send(ws, { t: 'error', message: 'bad json' }); }
    const me = ws.deserializeAttachment() ?? { seat: -1 };
    const seats = (await this.ctx.storage.get('seats')) ?? []; // [{ seat, name, color, token }]
    const host = await this.hostSeat();

    if (msg.t === 'hello') {
      let seat = seats.find((s) => msg.token && s.token === msg.token);
      if (!seat) {
        if (seats.length >= 6) return send(ws, { t: 'error', message: 'room full' });
        seat = { seat: seats.length, name: String(msg.name ?? 'Player').slice(0, 14), color: String(msg.color ?? '#ffffff').slice(0, 9), token: crypto.randomUUID() };
        seats.push(seat);
        await this.ctx.storage.put('seats', seats);
      }
      ws.serializeAttachment({ seat: seat.seat });
      const hostNow = await this.hostSeat();
      send(ws, { t: 'welcome', seat: seat.seat, token: seat.token, host: hostNow, snapshot: await this.ctx.storage.get('snapshot'), start: await this.ctx.storage.get('start'), lobby: await this.ctx.storage.get('lobby') });
      return this.broadcastPeers(seats, hostNow);
    }
    if (me.seat < 0) return send(ws, { t: 'error', message: 'say hello first' });
    const isHost = me.seat === host;

    switch (msg.t) {
      case 'lobby':
      case 'start':
      case 'measuring':
        if (!isHost) return send(ws, { t: 'error', message: 'host only' });
        if (msg.t !== 'measuring') await this.ctx.storage.put(msg.t, msg);
        if (msg.t === 'start') await this.ctx.storage.put('host', me.seat); // the starter runs the engine: pin it
        return this.broadcast(msg, ws);
      case 'state':
        if (!isHost) return send(ws, { t: 'error', message: 'host only' });
        await this.ctx.storage.put('snapshot', { state: msg.state });
        return this.broadcast(msg, ws);
      case 'act':
        return this.toSeat(host, { t: 'act', from: me.seat, action: msg.action });
      case 'signal':
        return this.toSeat(msg.to, { t: 'signal', from: me.seat, data: msg.data });
      case 'ping':
        return send(ws, { t: 'pong' });
      default:
        return send(ws, { t: 'error', message: `unknown ${msg.t}` });
    }
  }

  async webSocketClose(ws) {
    const seats = (await this.ctx.storage.get('seats')) ?? [];
    this.broadcastPeers(seats, await this.hostSeat(ws), ws);
  }

  // Before a game starts the host is the lowest online seat (everyone agrees, reconnects included).
  // Once a game starts it is pinned to the starter, whose browser runs the engine.
  async hostSeat(closing = null) {
    const pinned = await this.ctx.storage.get('host');
    if (pinned !== undefined) return pinned;
    const online = this.sockets().filter((s) => s !== closing).map((s) => s.deserializeAttachment()?.seat).filter((x) => x >= 0);
    return online.length ? Math.min(...online) : 0;
  }

  sockets() { return this.ctx.getWebSockets(); }

  broadcast(msg, except) {
    const data = JSON.stringify(msg);
    for (const s of this.sockets()) if (s !== except) try { s.send(data); } catch { /* closed */ }
  }

  toSeat(seat, msg) {
    const data = JSON.stringify(msg);
    for (const s of this.sockets()) if (s.deserializeAttachment()?.seat === seat) try { s.send(data); } catch { /* closed */ }
  }

  broadcastPeers(seats, host, closing = null) {
    const online = new Set(this.sockets().filter((s) => s !== closing).map((s) => s.deserializeAttachment()?.seat));
    this.broadcast({ t: 'peers', host, peers: seats.map(({ seat, name, color }) => ({ seat, name, color, online: online.has(seat) })) }, closing);
  }

  // --- Moth proxy ----------------------------------------------------------------------------------
  async moth(req, path) {
    const token = req.headers.get('x-brisque-token');
    const seats = (await this.ctx.storage.get('seats')) ?? [];
    const solo = await this.ctx.storage.get('solo');
    if (!token || !(token === solo || seats.some((s) => s.token === token))) return json({ error: 'unknown seat token' }, 401);
    if (!MOTH_ALLOW.some((re) => re.test(`${req.method} ${path}`))) return json({ error: 'endpoint not allowed' }, 403);
    if (!this.env.MOTH_API_KEY) return json({ error: 'MOTH_API_KEY not set' }, 503);

    // budget: only job submissions count (status polls and results are free to us)
    if (req.method === 'POST') {
      const now = Date.now();
      const day = new Date(now).toISOString().slice(0, 10);
      const b = (await this.ctx.storage.get('budget')) ?? { day, count: 0, minute: 0, minuteCount: 0 };
      if (b.day !== day) Object.assign(b, { day, count: 0 });
      const minute = Math.floor(now / 60000);
      if (b.minute !== minute) Object.assign(b, { minute, minuteCount: 0 });
      if (b.count >= Number(this.env.MOTH_DAILY_BUDGET ?? 300) || b.minuteCount >= Number(this.env.MOTH_MINUTE_BUDGET ?? 20)) {
        return json({ error: 'room quantum budget exhausted' }, 429);
      }
      const global = await this.env.LOBBY.get(this.env.LOBBY.idFromName('budget')).fetch('https://lobby/budget', { method: 'POST' }).then((r) => r.json());
      if (!global.ok) return json({ error: 'daily quantum budget exhausted' }, 429);
      b.count++;
      b.minuteCount++;
      await this.ctx.storage.put('budget', b);
    }
    const body = req.method === 'POST' ? await req.text() : undefined;
    if (body && body.length > 20000) return json({ error: 'body too large' }, 413);
    const res = await fetch(MOTH + path, {
      method: req.method,
      headers: { Authorization: `Bearer ${this.env.MOTH_API_KEY}`, 'Content-Type': 'application/json' },
      body,
    });
    return new Response(res.body, { status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' } });
  }

  // --- JaaS token (voice): RS256 JWT signed with WebCrypto -----------------------------------------
  async jaas(req, code) {
    const { JAAS_APP_ID: app, JAAS_KID: kid, JAAS_PRIVATE_KEY: pem } = this.env;
    if (!app || !kid || !pem) return json({ error: 'voice not configured' }, 501);
    const { token, name } = await req.json().catch(() => ({}));
    const seats = (await this.ctx.storage.get('seats')) ?? [];
    const seat = seats.find((s) => s.token === token);
    if (!seat) return json({ error: 'unknown seat token' }, 401);
    const now = Math.floor(Date.now() / 1000);
    const room = `brisque-${code.toLowerCase()}`;
    const header = { alg: 'RS256', typ: 'JWT', kid };
    const payload = {
      aud: 'jitsi', iss: 'chat', sub: app, room, iat: now, nbf: now - 10, exp: now + 4 * 3600,
      context: { user: { id: seat.token, name: name ?? seat.name, moderator: 'false' }, features: { recording: 'false', livestreaming: 'false' } },
    };
    const b64 = (obj) => base64url(new TextEncoder().encode(JSON.stringify(obj)));
    const input = `${b64(header)}.${b64(payload)}`;
    const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, '')), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input)));
    return json({ jwt: `${input}.${base64url(sig)}`, room: `${app}/${room}` });
  }
}

function send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch { /* closed */ } }
function base64url(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
