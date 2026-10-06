// Records a presentation video: the main menu over the live CPU backdrop, then the CPU game full
// screen, with the cinematic attract camera. Frame-perfect via the ?capture virtual clock; frames pipe
// into ffmpeg (H.264, 30 fps). If public/audio/manifest.json names music, the soundtrack is muxed in:
// the menu remix, crossfading into the early-game track when the menu disappears.
//   node tools/record-video.mjs [out.mp4] [seconds] [menuSeconds] [baseUrl] [query]
// With a query (e.g. 'quick=cpu&q=moth-qpu-pool') it records that game with its HUD and quantum panel instead.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [out = 'release/brisque-trailer.mp4', seconds = '45', menuSeconds = '16', base = 'http://localhost:5180', query = ''] = process.argv.slice(2);
const FPS = 30;
const W = 1920;
const H = 1080;
const total = Math.round(Number(seconds) * FPS);
const menuFrames = Math.round(Number(menuSeconds) * FPS);

const manifest = JSON.parse(fs.readFileSync('public/audio/manifest.json', 'utf8'));
const music = (k) => (manifest.music?.[k] ? path.join('public/audio', manifest.music[k]) : null);
const menuTrack = music('menu');
const gameTrack = music('early');

fs.mkdirSync(path.dirname(out), { recursive: true });
const args = ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-'];
let filter = null;
if (menuTrack) {
  args.push('-i', menuTrack);
  if (gameTrack) {
    args.push('-i', gameTrack);
    // menu remix -> early-game track, 2.5 s crossfade when the menu leaves; fade in/out at the ends
    filter = `[1:a]atrim=0:${Number(menuSeconds) + 1.25},asetpts=PTS-STARTPTS[m];[2:a]asetpts=PTS-STARTPTS[g];[m][g]acrossfade=d=2.5[x];[x]afade=t=in:d=1.2,afade=t=out:st=${Number(seconds) - 2.5}:d=2.5,atrim=0:${seconds}[a]`;
  } else {
    filter = `[1:a]afade=t=in:d=1.2,afade=t=out:st=${Number(seconds) - 2.5}:d=2.5,atrim=0:${seconds}[a]`;
  }
  args.push('-filter_complex', filter, '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '192k');
}
args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-t', String(seconds), out);
const ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
// listen for exit up front: ffmpeg can finish before we'd otherwise attach the listener
const ffmpegDone = new Promise((r) => ffmpeg.on('close', r));
let ffErr = '';
ffmpeg.stderr.on('data', (d) => { ffErr = (ffErr + d).slice(-2000); });

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-webgl', `--window-size=${W},${H}`],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(`${base}/?capture&e2e${query ? `&${query}` : ''}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction((q) => window.__capture && (q ? window.__brisque?.session : window.__brisque?.attract), { timeout: 180000, polling: 250 }, query);
const renderer = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log(`renderer: ${renderer}`);
await page.addStyleTag({ content: '#audio-dock { display: none !important; }' });
// warm up: let the attract game deal and start moving before frame 0
for (let i = 0; i < 90; i++) await page.evaluate((ms) => window.__capture.step(ms), 1000 / FPS);

const t0 = Date.now();
for (let f = 0; f < total; f++) {
  if (f === menuFrames && !query) await page.evaluate(() => { window.__brisque.screens.hide(); window.__brisque.stage.setViewShift(0); });
  await page.evaluate((ms) => window.__capture.step(ms), 1000 / FPS);
  const jpg = await page.screenshot({ type: 'jpeg', quality: 92 });
  if (!ffmpeg.stdin.write(jpg)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
  if (f % 60 === 0) console.log(`frame ${f}/${total} · ${((Date.now() - t0) / 1000).toFixed(0)} s elapsed`);
}
ffmpeg.stdin.end();
await browser.close();
const code = await ffmpegDone;
if (code !== 0) { console.log(ffErr); process.exit(1); }
console.log(`${out}: ${(fs.statSync(out).size / 1e6).toFixed(1)} MB, ${seconds}s @ ${FPS} fps${menuTrack ? ', with soundtrack' : ', no soundtrack yet (add music to public/audio/manifest.json)'}`);
