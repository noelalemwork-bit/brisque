// VFX smoke test: split (iridescent uncertain ground + worldline), then a bomb with a forced hover
// (?hover=4) so the quantum static, impact sheet and screen glitch can be screenshotted offline.
// node vfx-shots.mjs <outDir> [port]
import puppeteer from 'puppeteer-core';
const [out = '.', port = '5192', prefix = 'v'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'], defaultViewport: { width: 1280, height: 800 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[console.${m.type()}] ${m.text().slice(0, 300)}`); });
await page.goto(`http://localhost:${port}/?quick&hover=4&noattract&e2e`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__brisque?.session?.controller, { timeout: 60000 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const info = await page.evaluate(async () => {
  const { match, stage } = window.__brisque;
  const s = match.state;
  const mine = s.worlds[0].board.findIndex((c) => c[0]);
  for (const w of s.worlds) w.board[mine][0] = 14;
  Object.assign(match.engine.rules, { splitsPerTurn: 3, bombCertainTargets: true });
  const nb = stage.map.territories[mine].neighbors;
  const r1 = match.act({ type: 'split', from: mine, to: [mine, nb[0]], n: 10 });
  const c = stage.anchor(mine);
  stage.controls.target.copy(c);
  stage.camera.position.set(c.x + 6, c.y + 26, c.z + 26);
  return { mine, nb: nb[0], r1: JSON.stringify(r1)?.slice(0, 200) };
});
console.log(info);
await wait(4000);
await page.screenshot({ path: `${out}/${prefix}-iri.png` });
await page.evaluate((t) => { const { stage, match } = window.__brisque; const W = match.state.worlds; const u = stage.map.territories.map((x) => x.id).filter((x) => W.some((w) => JSON.stringify(w.board[x]) !== JSON.stringify(W[0].board[x]))); console.warn('uncertain territories ' + u.join(',')); const c = stage.anchor(u[0] ?? t.nb); stage.controls.target.copy(c); stage.camera.position.set(c.x + 3, c.y + 13, c.z + 12); }, info);
await wait(2500);
await page.screenshot({ path: `${out}/${prefix}-iri-close.png` });
// debug: force the entanglement sheen to full on every visible ground tile to judge the look
await page.evaluate(() => { window.__brisque.stage.scene.traverse((o) => { if (o.material?.uniforms?.uIri) o.material.uniforms.uIri.value = 1; }); });
await wait(1500);
await page.screenshot({ path: `${out}/${prefix}-iri-forced.png` });
const r2 = await page.evaluate(() => {
  const { match, stage } = window.__brisque;
  const s = match.state;
  const seat = s.turn.current;
  const t = stage.map.territories.map((x) => x.id).find((x) => match.engine.canBomb(s, seat, x));
  if (t === undefined) return 'no bombable territory';
  const c = stage.anchor(t);
  stage.controls.target.copy(c);
  stage.camera.position.set(c.x + 6, c.y + 26, c.z + 26);
  return { t, r: JSON.stringify(match.act({ type: 'bomb', territory: t }))?.slice(0, 200) };
});
console.log('bomb', r2);
for (let i = 0; i < 10; i++) { await wait(i < 4 ? 900 : 250); await page.screenshot({ path: `${out}/${prefix}-bomb${i}.png` }); }
await browser.close();
