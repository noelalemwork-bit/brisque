// Drives a real browser game through a layered scenario and screenshots the picker, worldlines, braid.
//   node tools/browser-branching.mjs <outDir>
import puppeteer from 'puppeteer-core';
const out = process.argv[2] ?? '.';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'], defaultViewport: { width: 1400, height: 900 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) console.log(`[console.error] ${m.text()}`); });
await page.goto('http://localhost:5180/?quick&instant&q=moth-qpu-pool', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__brisque?.match?.state, { timeout: 30000 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// give the human a big stack and plenty of budget, then split / re-split / advance
const plan = await page.evaluate(async () => {
  const { match } = window.__brisque;
  const s = match.state;
  const map = window.__brisque.stage.map;
  const mine = s.worlds[0].board.findIndex((c) => c[0]);
  for (const w of s.worlds) w.board[mine][0] = 14;
  Object.assign(match.engine.rules, { splitsPerTurn: 5, movesPerTurn: 10 });
  const nb = map.territories[mine].neighbors;
  const b = nb[0];
  const c = nb.find((x) => x !== b && !map.territories[b].neighbors.includes(x)) ?? nb[1];
  const d = map.territories[b].neighbors.find((x) => x !== mine && x !== c);
  return { mine, b, c, d };
});
await page.evaluate(({ mine, b }) => window.__brisque.match.act({ type: 'split', from: mine, to: [mine, b], n: 9, bias: 0.5 }), plan);
await wait(4000);
await page.evaluate(({ b, d }) => window.__brisque.match.act({ type: 'split', from: b, to: [b, d], take: [{ atLeast: 9, n: 8 }], bias: 0.25 }), plan);
await wait(4000);
// select the stay-branch source so the troop picker shows its layers (certain + 50%)
await page.evaluate(({ mine }) => window.__brisque.session.controller.click(mine, {}), plan);
await wait(1200);
const pickUi = await page.evaluate(() => window.__brisque.session.controller.ui().pick);
console.log('picker layers:', JSON.stringify(pickUi));
await page.screenshot({ path: `${out}/branch-picker.png` });
await page.evaluate(({ mine, c }) => {
  const ctl = window.__brisque.session.controller;
  ctl.toggleLayer(0); // send only the uncertain layer
  ctl.click(c, {});
}, plan);
await wait(4000);
const st = await page.evaluate(() => ({ history: window.__brisque.match.state.history.map((h) => h.kind), threads: window.__brisque.match.state.qubits.map((q) => [q.id, q.status, q.parent]) }));
console.log('history:', st.history.join(' '), '| threads:', JSON.stringify(st.threads));
// zoom onto the action so the worldline tubes are readable
await page.evaluate(({ mine }) => {
  const { stage } = window.__brisque;
  const c = stage.anchor(mine);
  stage.controls.target.copy(c);
  stage.camera.position.set(c.x + 6, c.y + 26, c.z + 24);
}, plan);
await wait(2500);
await page.screenshot({ path: `${out}/branch-worldlines.png` });
const braid = await page.$('.threads');
if (braid) await braid.screenshot({ path: `${out}/branch-braid.png` });
await browser.close();
