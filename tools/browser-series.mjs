// Screenshot series of a live page: node tools/browser-series.mjs <url> <outPrefix> <count> <intervalMs> [startMs]
import puppeteer from 'puppeteer-core';
const [url, prefix, count = '4', interval = '4000', start = '4000'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'], defaultViewport: { width: 1400, height: 900 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') console.log(`[console.error] ${m.text()}`); });
await page.goto(url, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, Number(start)));
for (let i = 0; i < Number(count); i++) {
  await page.screenshot({ path: `${prefix}-${i}.png` });
  console.log(`${prefix}-${i}.png`, await page.$eval('.banner', (el) => el.textContent).catch(() => ''));
  await new Promise((r) => setTimeout(r, Number(interval)));
}
await browser.close();
