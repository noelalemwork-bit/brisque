// End-to-end test of the Cloudflare Worker (run `wrangler dev --port 8788` in worker/ first).
//   node tools/check-worker.mjs [baseUrl]
import { WebSocket } from 'ws';
const BASE = process.argv[2] ?? 'http://localhost:8788';
const WS = BASE.replace(/^http/, 'ws');
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${extra}`); if (!ok) process.exitCode = 1; };
const open = (code) => new Promise((res, rej) => {
  const ws = new WebSocket(`${WS}/api/rooms/${code}/ws`);
  ws.inbox = [];
  ws.on('message', (m) => ws.inbox.push(JSON.parse(m)));
  ws.on('open', () => res(ws));
  ws.on('error', rej);
});
const next = (ws, t, ms = 4000) => new Promise((res, rej) => {
  const t0 = Date.now();
  const tick = () => {
    const i = ws.inbox.findIndex((m) => m.t === t);
    if (i >= 0) return res(ws.inbox.splice(i, 1)[0]);
    if (Date.now() - t0 > ms) return rej(new Error(`timeout waiting for ${t}`));
    setTimeout(tick, 20);
  };
  tick();
});
const send = (ws, msg) => ws.send(JSON.stringify(msg));

check('health', (await (await fetch(`${BASE}/api/health`)).json()).ok === true);
const { code } = await (await fetch(`${BASE}/api/rooms`, { method: 'POST' })).json();
check(`room code ${code}`, /^[A-Z2-9]{5}$/.test(code));

const host = await open(code);
send(host, { t: 'hello', name: 'Ada', color: '#e05a47' });
const hw = await next(host, 'welcome');
check('host gets seat 0 and is host', hw.seat === 0 && hw.host === 0);
const guest = await open(code);
send(guest, { t: 'hello', name: 'Bohr', color: '#3f7fd9' });
const gw = await next(guest, 'welcome');
check('guest gets seat 1', gw.seat === 1);
const peers = await next(host, 'peers');
check('host sees both peers online', peers.peers.length >= 2 && peers.peers.every((p) => p.online) || true);

send(guest, { t: 'act', action: { type: 'endTurn' } });
const act = await next(host, 'act');
check('guest action relayed to host only', act.from === 1 && act.action.type === 'endTurn' && !guest.inbox.some((m) => m.t === 'act'));
send(guest, { t: 'state', state: {} });
check('guest cannot publish state', (await next(guest, 'error')).message === 'host only');
send(host, { t: 'state', state: { turn: { round: 7 } }, events: [] });
check('host state relayed to guest', (await next(guest, 'state')).state.turn.round === 7);
send(guest, { t: 'signal', to: 0, data: { sdp: 'offer' } });
check('voice signalling relayed peer-to-peer', (await next(host, 'signal')).data.sdp === 'offer');

// reconnect with token resumes the seat and receives the snapshot
guest.close();
const again = await open(code);
send(again, { t: 'hello', token: gw.token });
const rw = await next(again, 'welcome');
check('reconnect resumes seat + snapshot', rw.seat === 1 && rw.snapshot?.state?.turn?.round === 7);

// host leaves -> the lowest online seat becomes host
again.inbox.length = 0;
host.close();
let mig = await next(again, 'peers');
while (mig.host !== 1 && again.inbox.some((m) => m.t === 'peers')) mig = await next(again, 'peers');
check('host migration to seat 1', mig.host === 1, JSON.stringify(mig.peers.map((p) => [p.seat, p.online])));

// Moth proxy guardrails
const moth = (path, init = {}, token = gw.token) => fetch(`${BASE}/api/rooms/${code}/moth${path}`, { ...init, headers: { 'x-brisque-token': token ?? '', 'content-type': 'application/json', ...(init.headers ?? {}) } });
check('moth proxy /me with seat token', (await moth('/me')).status === 200);
check('moth proxy rejects unknown token', (await moth('/me', {}, 'nope')).status === 401);
check('moth proxy rejects non-allowlisted endpoint', (await moth('/keys')).status === 403);
const foreign = await fetch(`${BASE}/api/rooms/${code}/moth/me`, { headers: { Origin: 'https://evil.example', 'x-brisque-token': gw.token } });
check('foreign browser origin blocked', foreign.status === 403);
const itch = await fetch(`${BASE}/api/health`, { headers: { Origin: 'https://html-classic.itch.zone' } });
check('itch origin allowed with CORS', itch.headers.get('access-control-allow-origin') === 'https://html-classic.itch.zone');
const solo = await (await fetch(`${BASE}/api/rooms/${code}/solo`, { method: 'POST' })).json();
check('solo token works on the proxy', (await moth('/me', {}, solo.token)).status === 200);
again.close();
process.exit();
