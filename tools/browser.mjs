// Drive the installed Chrome (puppeteer-core): console capture, screenshots, input. Headless + SwiftShader.
//   node tools/browser.mjs <url> [screenshot.png] [waitMs]
import puppeteer from 'puppeteer-core';
const [url, shot, wait = '8000'] = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1400,900'],
  defaultViewport: { width: 1400, height: 900 },
});
const page = await browser.newPage();
page.on('console', (m) => console.log(`[console.${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => console.log(`[requestfailed] ${r.method()} ${r.url()} ${r.failure()?.errorText}`));
await page.goto(url, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, Number(wait)));
const banner = await page.$eval('.banner', (el) => el.textContent).catch(() => '(no banner)');
console.log(`[banner] ${banner}`);
if (shot) await page.screenshot({ path: shot });
await browser.close();
