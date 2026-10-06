// Build the static game and zip it for itch.io ("HTML" project, "This file will be played in the browser").
//   npm run build:itch   ->  release/brisque-web.zip
// The build is fully static: relative URLs, no server, no API key. Quantum modes available there:
// Emulator and the bundled IBM-QPU randomness pool; live Moth circuits need an allowlisted origin.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { zipDirectory } from './zip.mjs';

// itch builds run on itch's domain, so they must call the Worker by its full URL
process.env.VITE_BRISQUE_API ??= 'https://brisque.noelnegash.workers.dev';
console.log(`online backend: ${process.env.VITE_BRISQUE_API}`);
execSync('npx vite build', { stdio: 'inherit', env: process.env });
fs.rmSync("dist/audio/README.md", { force: true }); // notes for developers, not players
const key = process.env.MOTH_API_KEY;
for (const f of walk('dist')) {
  const text = fs.readFileSync(f, 'utf8');
  if (/moth_[A-Za-z0-9]{16,}/.test(text) || (key && text.includes(key))) throw new Error(`API key found in ${f}; refusing to package`);
}
fs.mkdirSync('release', { recursive: true });
fs.rmSync('release/brisque-web.zip', { force: true });
// a real ZIP (GNU tar on PATH would silently write a tar archive with a .zip name)
const count = zipDirectory('dist', 'release/brisque-web.zip');
console.log(`zipped ${count} files`);
const size = fs.statSync('release/brisque-web.zip').size;
console.log(`release/brisque-web.zip ${(size / 1024).toFixed(0)} KB (itch limit: 500 MB, 1000 files)`);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}
