// Loads the shared Noel/.env (two levels up) without overriding real env vars. Values never logged.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function loadEnv(file = path.resolve(fileURLToPath(import.meta.url), '../../../../.env')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
