// Plays a quick match in a quantum mode and logs every quantum trace event (collapses, Moth jobs, coin toss).
//   node tools/browser-quantum.mjs "http://localhost:5180/?quick=cpu&q=moth-stream&noattract" [waitMs] [shot.png]
import puppeteer from 'puppeteer-core';
const [url, wait = '20000', shot] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'], defaultViewport: { width: 1280, height: 720 } });
const page = await browser.newPage();
page.on('console', (m) => { const t = m.text(); if (!/THREE|Download the/.test(t)) console.log(`[${m.type()}] ${t.slice(0, 300)}`); });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => console.log(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
await page.evaluateOnNewDocument(() => {
  const iv = setInterval(() => {
    if (!window.__brisque?.quantumTrace) return; // dev builds, and any build opened with ?e2e
    clearInterval(iv);
    window.__brisque.quantumTrace.on((e) => { const c = { ...e }; delete c.circuit; delete c.probs; console.log('TRACE ' + JSON.stringify(c)); });
  }, 5);
});
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await new Promise((r) => setTimeout(r, Number(wait)));
if (shot) await page.screenshot({ path: shot });
await browser.close();
