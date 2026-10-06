// Visual check: territory tooltip (names, armies), greyed-out Deploy, collapse panel position.
//   node tools/browser-tooltip.mjs <outDir> [baseUrl]
import puppeteer from 'puppeteer-core';
const [out = '.', base = 'http://localhost:5180'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'], defaultViewport: { width: 1600, height: 900 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(`${base}/?quick&instant&e2e`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__brisque?.session?.controller, { timeout: 90000 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// spend the whole deploy allowance so Deploy greys out, then split next to an enemy so a battle exists
const target = await page.evaluate(() => {
  const { match, stage } = window.__brisque;
  const s = match.state;
  const mine = s.worlds[0].board.findIndex((c) => c[0]);
  match.act({ type: 'deploy', territory: mine, n: 10 });
  const c = stage.anchor(mine);
  stage.controls.target.copy(c);
  stage.camera.position.set(c.x + 3, c.y + 34, c.z + 30);
  return mine;
});
await wait(2500);
// hover the territory: project its centroid to the screen and move the mouse there
const pt = await page.evaluate((t) => { const { stage } = window.__brisque; const p = stage.project(stage.anchor(t)); return { x: p.x, y: p.y + 30 }; }, target);
await page.mouse.move(pt.x, pt.y);
await wait(1200);
await page.screenshot({ path: `${out}/tooltip.png` });
const deployDisabled = await page.evaluate(() => [...document.querySelectorAll('.act')].find((b) => b.textContent.includes('Deploy'))?.disabled);
console.log('deploy button disabled after spending the allowance:', deployDisabled);
const tipText = await page.evaluate(() => document.querySelector('.tip')?.innerText);
console.log('tooltip text:', JSON.stringify(tipText));
await browser.close();
