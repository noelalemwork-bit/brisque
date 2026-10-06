// Audio check in a real browser: menu music after the first gesture, SFX decoded, the game track after
// starting, the endgame track near the round limit, volume knob and mute.
//   node tools/browser-audio.mjs [baseUrl]
import puppeteer from 'puppeteer-core';
const base = (process.argv[2] ?? 'https://brisque.noelnegash.workers.dev').replace(/\/$/, '');
let failures = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${extra}`); if (!ok) { failures++; process.exitCode = 1; } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 1280, height: 800 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(`${base}/?e2e&noattract`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__brisque?.audio, { timeout: 90000 });
const status = () => page.evaluate(() => window.__brisque.audio.status());
check('no audio before a user gesture', (await status()).context === 'none');
await page.mouse.click(640, 60); // first gesture unlocks audio
await wait(4000);
let st = await status();
check('menu music playing after the first click', st.context === 'running' && st.playing.includes('menu'), JSON.stringify(st));
check('Aya Emara's sound effects decoded (click, boom)', st.sfxLoaded.includes('click') && st.sfxLoaded.includes('bombHit'), st.sfxLoaded.join(','));
// start a local game: the electronic track takes over
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('Play local')).click());
await wait(500);
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('Start game')).click());
await page.waitForFunction(() => window.__brisque.session, { timeout: 90000 });
await wait(4500);
st = await status();
check('early/midgame: electronic track after the crossfade', st.phase === 'early' && st.playing.includes('early') && !st.playing.includes('menu'), JSON.stringify(st.playing));
// endgame: jump the round counter near the limit and push a state through the session
await page.evaluate(() => {
  const { match } = window.__brisque;
  const limit = match.engine.rules.roundLimit || 30;
  match.state.turn.round = Math.ceil(limit * 0.7);
  match.act({ type: 'endTurn' });
});
await wait(6000);
st = await status();
check('endgame: classical track takes over', st.phase === 'late' && st.playing.includes('late'), JSON.stringify(st.playing));
// volume knob + mute
await page.evaluate(() => { window.__brisque.audio.setVolume(0.3); });
const vol = await page.evaluate(() => window.__brisque.audio.volume);
await page.evaluate(() => document.querySelector('.mutebtn').click());
const muted = await page.evaluate(() => window.__brisque.audio.muted);
await page.evaluate(() => document.querySelector('.mutebtn').click());
check('master volume knob sets level, mute button toggles', Math.abs(vol - 0.3) < 1e-9 && muted && !(await page.evaluate(() => window.__brisque.audio.muted)));
await browser.close();
console.log(failures ? `${failures} failing` : 'audio checks passed');
