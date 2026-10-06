// UI smoke test at a real desktop size: picker over a layered source, then bomb mode armed.
//   node tools/browser-ui.mjs <outDir> [width] [height]
import puppeteer from 'puppeteer-core';
const [out = '.', width = '1920', height = '1080'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'], defaultViewport: { width: Number(width), height: Number(height) } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) console.log(`[console.error] ${m.text()}`); });
await page.goto('http://localhost:5180/?quick&instant', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__brisque?.session?.controller, { timeout: 30000 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const t = await page.evaluate(async () => {
  const { match, stage } = window.__brisque;
  const s = match.state;
  const mine = s.worlds[0].board.findIndex((c) => c[0]);
  for (const w of s.worlds) w.board[mine][0] = 12;
  Object.assign(match.engine.rules, { splitsPerTurn: 3 });
  const nb = stage.map.territories[mine].neighbors;
  match.act({ type: 'split', from: mine, to: [mine, nb[0]], n: 8 });
  const c = stage.anchor(mine);
  stage.controls.target.copy(c);
  stage.camera.position.set(c.x + 4, c.y + 30, c.z + 30);
  return mine;
});
await wait(2500);
await page.evaluate((mine) => window.__brisque.session.controller.click(mine, {}), t);
await wait(1500);
await page.screenshot({ path: `${out}/ui-picker.png` });
await page.evaluate(() => window.__brisque.session.controller.setMode('bomb'));
await wait(1200);
await page.screenshot({ path: `${out}/ui-bomb.png` });
console.log('shots done');
await browser.close();
