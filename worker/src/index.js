// Brisque Worker: serves the game (static assets from ../dist) and the online backend.
//
//   GET  /api/health
//   GET  /api/matchmake (Upgrade)            -> WebSocket to the matchmaking queue (Lobby DO)
//   POST /api/rooms                           -> { code }            create a room
//   GET  /api/rooms/:code/ws  (Upgrade)       -> WebSocket           seats, relay, voice signalling, snapshots
//   POST /api/rooms/:code/solo                -> { token }           seat token for a single-device game
//   ANY  /api/rooms/:code/moth/<path>         -> Moth API            header x-brisque-token; budgeted
//   POST /api/rooms/:code/jaas                -> { jwt, room }       if JAAS_* secrets are set
// Everything else is the static game (index.html + assets), served by the assets binding.

export { Room } from './room.js';
export { Lobby } from './lobby.js';
import { json } from './util.js';
import { newCode } from './lobby.js';

const CODE = /^[A-HJ-NP-Z2-9]{5}$/;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);

    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: cors ? 204 : 403, headers: cors ?? {} });
    if (cors === null) return json({ error: 'origin not allowed' }, 403); // a browser on a foreign site
    const reply = (res) => {
      if (!cors || res.status === 101) return res;
      const out = new Response(res.body, res);
      for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
      return out;
    };

    if (url.pathname === '/api/health') return reply(json({ ok: true }));
    if (url.pathname === '/api/matchmake') {
      const lobby = env.LOBBY.get(env.LOBBY.idFromName('global'));
      return lobby.fetch(req);
    }
    if (url.pathname === '/api/rooms' && req.method === 'POST') return reply(json({ code: newCode() }));

    const m = url.pathname.match(/^\/api\/rooms\/([^/]+)(\/.*)$/);
    if (m && CODE.test(m[1])) {
      const stub = env.ROOMS.get(env.ROOMS.idFromName(m[1]));
      const inner = new URL(req.url);
      inner.pathname = m[2];
      inner.searchParams.set('code', m[1]);
      return reply(await stub.fetch(new Request(inner, req)));
    }
    return reply(json({ error: 'not found' }, 404));
  },
};

// Same-origin requests (the game served by this Worker) carry no CORS; other origins must be listed.
function corsHeaders(req, env) {
  const origin = req.headers.get('Origin');
  if (!origin || origin === new URL(req.url).origin) return {};
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim());
  if (!allowed.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type,x-brisque-token',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}
