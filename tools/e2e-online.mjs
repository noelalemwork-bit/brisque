// End-to-end online test with two real browsers (fake microphones):
// matchmaking, rooms, voice (WebRTC) and game-state streaming, then a private room by code.
//   node tools/e2e-online.mjs [baseUrl] [screenshotDir]
import puppeteer from 'puppeteer-core';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:8788').replace(/\/$/, '');
const OUT = process.argv[3];
let failures = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${extra}`); if (!ok) { failures++; process.exitCode = 1; } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const since = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

async function browser(label) {
  const b = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
    defaultViewport: { width: 1280, height: 800 },
  });
  const page = await b.newPage();
  page.on('pageerror', (e) => console.log(`[${label} pageerror] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) console.log(`[${label} console.error] ${m.text()}`); });
  await page.goto(`${BASE}/?e2e`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__brisque, { timeout: 90000 });
  return { b, page, label };
}
const clickText = (page, text) => page.evaluate((t) => {
  const el = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith(t) && !x.disabled);
  if (!el) throw new Error(`no button "${t}"`);
  el.click();
}, text);
const until = (page, fn, arg, timeout = 60000) => page.waitForFunction(fn, { timeout, polling: 200 }, arg);

const A = await browser('A');
const B = await browser('B');
try {
  // 1. matchmaking
  await clickText(A.page, 'Play online');
  await clickText(B.page, 'Play online');
  await clickText(A.page, '1 vs 1');
  await wait(300);
  await clickText(B.page, '1 vs 1');
  await until(A.page, () => window.__brisque.room?.seat >= 0);
  await until(B.page, () => window.__brisque.room?.seat >= 0);
  const codes = [await A.page.evaluate(() => window.__brisque.room.code), await B.page.evaluate(() => window.__brisque.room.code)];
  check(`matchmaking pairs both players into one room (${codes[0]}) · ${since()}`, codes[0] === codes[1]);

  // 2. room: both see each other online, one host
  await until(A.page, () => window.__brisque.room.peers.filter((p) => p.online).length === 2);
  await until(B.page, () => window.__brisque.room.peers.filter((p) => p.online).length === 2);
  const seats = [await A.page.evaluate(() => [window.__brisque.room.seat, window.__brisque.room.isHost]), await B.page.evaluate(() => [window.__brisque.room.seat, window.__brisque.room.isHost])];
  check(`room: two seats, exactly one host · ${since()}`, seats[0][0] !== seats[1][0] && seats[0][1] !== seats[1][1], JSON.stringify(seats));
  const host = seats[0][1] ? A : B;
  const guest = host === A ? B : A;

  // 3. voice (opt-in: nothing is enabled until asked); created once the room's welcome arrives
  await until(A.page, () => !!window.__brisque.voice);
  await until(B.page, () => !!window.__brisque.voice);
  check('voice is opt-in: off after joining the room', !(await A.page.evaluate(() => window.__brisque.voice.enabled)) && !(await B.page.evaluate(() => window.__brisque.voice.enabled)));
  await A.page.evaluate(() => window.__brisque.voice.enable());
  await B.page.evaluate(() => window.__brisque.voice.enable());
  const other = (p) => p.evaluate(() => window.__brisque.room.peers.find((x) => x.seat !== window.__brisque.room.seat).seat);
  const oa = await other(A.page);
  const ob = await other(B.page);
  let voiceOk = true;
  try {
    await until(A.page, (s) => window.__brisque.voice.status().peers[s]?.state === 'connected', oa, 25000);
    await until(B.page, (s) => window.__brisque.voice.status().peers[s]?.state === 'connected', ob, 25000);
  } catch { voiceOk = false; }
  const statusA = await A.page.evaluate(() => window.__brisque.voice.status());
  check(`voice: WebRTC audio connected both ways · ${since()}`, voiceOk, JSON.stringify(statusA.peers));
  if (voiceOk) {
    // the fake microphone beeps about once a second: take the peak over a few seconds
    let lvl = 0;
    for (let k = 0; k < 30; k++) { lvl = Math.max(lvl, await A.page.evaluate((s) => window.__brisque.voice.status().peers[s].level, oa)); await wait(100); }
    check('voice: remote audio is flowing (fake mic level > 0)', lvl > 0, lvl.toFixed(3));
  }

  // 4. game-state streaming
  await clickText(host.page, 'Start game');
  await until(host.page, () => window.__brisque.session && window.__brisque.match?.state);
  await until(guest.page, () => window.__brisque.session && window.__brisque.match?.state);
  check(`game starts for both · ${since()}`, true);
  const snap = (p) => p.evaluate(() => { const s = window.__brisque.match.state; return JSON.stringify({ turn: s.turn, boards: s.worlds.map((w) => w.board) }); });
  check('both start from the same state', (await snap(host.page)) === (await snap(guest.page)));

  // play: whoever is on turn deploys and ends; three turn changes, checking sync every step
  for (let step = 0; step < 3; step++) {
    const turn = await host.page.evaluate(() => window.__brisque.match.state.turn.current);
    const actor = (await host.page.evaluate(() => window.__brisque.match.controls())) >= 0 ? host : guest;
    const target = await actor.page.evaluate(() => {
      const s = window.__brisque.match.state;
      return s.worlds[0].board.findIndex((c) => Object.keys(c).length === 1 && c[s.turn.current]);
    });
    await actor.page.evaluate((t) => window.__brisque.match.act({ type: 'deploy', territory: t, n: 2 }), target);
    await until(host.page, (t) => window.__brisque.match.state.turn.deployed >= 2, null);
    await until(guest.page, () => window.__brisque.match.state.turn.deployed >= 2);
    const synced = (await snap(host.page)) === (await snap(guest.page));
    await actor.page.evaluate(() => window.__brisque.match.act({ type: 'endTurn' }));
    await until(guest.page, (t) => window.__brisque.match.state.turn.current !== t, turn);
    await until(host.page, (t) => window.__brisque.match.state.turn.current !== t, turn);
    check(`turn ${step + 1}: ${actor.label}${actor === host ? ' (host)' : ' (guest)'} deploys + ends; states stay identical · ${since()}`, synced && (await snap(host.page)) === (await snap(guest.page)));
  }
  // 4b. voice controls in game: mute a peer (they keep rippling), self-mute, sidebar leave / rejoin
  if (voiceOk) {
    const hostOther = host === A ? oa : ob;
    const guestOther = host === A ? ob : oa;
    const peak = async (page, seat) => { let l = 0; for (let k = 0; k < 30; k++) { l = Math.max(l, await page.evaluate((s) => window.__brisque.voice.status().peers[s].level, seat)); await wait(100); } return l; };
    // mute the other player with the button on their avatar (the real UI path)
    const clicked = await host.page.evaluate(() => {
      const btn = [...document.querySelectorAll('.avatar .vbtn')].find((b) => b.title.startsWith('Mute ') && !b.title.includes('your'));
      btn?.click();
      return !!btn;
    });
    await wait(300);
    const st = await host.page.evaluate((s) => window.__brisque.voice.status().peers[s], hostOther);
    const lvl = await peak(host.page, hostOther);
    check('mute a player from their avatar: playback muted, level still flows (ripples keep going)', clicked && st.playbackMuted && lvl > 0, `level ${lvl.toFixed(3)}`);
    const greyed = await host.page.evaluate(() => document.querySelectorAll('.avatar.muted').length);
    check('muted player is greyed out on the avatar rail', greyed >= 1, `${greyed} muted avatar(s)`);
    await host.page.evaluate(() => [...document.querySelectorAll('.avatar .vbtn')].find((b) => b.title.startsWith('Unmute ') && !b.title.includes('your'))?.click());
    // self-mute from your own avatar's mic button
    await guest.page.evaluate(() => [...document.querySelectorAll('.avatar .vbtn')].find((b) => b.title === 'Mute your microphone')?.click());
    await wait(1500);
    const silent = await peak(host.page, hostOther);
    check('self-mute (own avatar button): the others hear silence', silent < 0.02 && (await guest.page.evaluate(() => window.__brisque.voice.muted)), `level ${silent.toFixed(3)}`);
    await guest.page.evaluate(() => [...document.querySelectorAll('.avatar .vbtn')].find((b) => b.title === 'Unmute your microphone')?.click());
    // sidebar button: leave, then rejoin
    const bar = await guest.page.evaluate(() => document.querySelector('.voicebar')?.textContent);
    await guest.page.evaluate(() => document.querySelector('.voicebar').click());
    await until(guest.page, () => !window.__brisque.voice.enabled);
    await guest.page.evaluate(() => document.querySelector('.voicebar').click());
    let rejoined = true;
    try { await until(guest.page, (s) => window.__brisque.voice.status().peers[s]?.state === 'connected', guestOther, 30000); } catch { rejoined = false; }
    check(`sidebar voice button ("${bar?.trim()}") leaves and rejoins voice`, rejoined);
  }
  if (OUT) {
    await host.page.screenshot({ path: `${OUT}/e2e-host.png` });
    await guest.page.screenshot({ path: `${OUT}/e2e-guest.png` });
  }

  // 5. private room: create on one browser, join by code on the other
  await host.page.evaluate(() => location.assign(location.pathname + '?e2e'));
  await guest.page.evaluate(() => location.assign(location.pathname + '?e2e'));
  await until(host.page, () => window.__brisque && document.querySelector('.btn'));
  await until(guest.page, () => window.__brisque && document.querySelector('.btn'));
  await clickText(host.page, 'Play online');
  await clickText(host.page, 'Create room');
  await until(host.page, () => window.__brisque.room?.seat >= 0);
  const code = await host.page.evaluate(() => window.__brisque.room.code);
  await clickText(guest.page, 'Play online');
  await guest.page.type('input.code', code);
  await clickText(guest.page, 'Join');
  await until(guest.page, () => window.__brisque.room?.seat >= 0);
  await until(host.page, () => window.__brisque.room.peers.filter((p) => p.online).length === 2);
  check(`private room ${code}: created, joined by code, both online · ${since()}`, true);
} catch (err) {
  check(`e2e aborted: ${err.message}`, false);
} finally {
  await A.b.close();
  await B.b.close();
}
console.log(failures ? `${failures} failing` : `all online checks passed in ${since()}`);
