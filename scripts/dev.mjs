#!/usr/bin/env node
// Lance la console (Vite) et le serveur WebSocket ensemble.
//   pnpm dev                 : toutes les cartouches
//   pnpm dev:game <id>       : uniquement la cartouche <id> (ex. _template)
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const env = { ...process.env };

if (args[0] === '--only') {
  const id = args[1];
  const games = JSON.parse(readFileSync(join(root, 'games.json'), 'utf8')).games ?? [];
  if (!id) {
    console.error('Usage: pnpm dev:game <id>\nAvailable: ' + games.map((g) => g.id).join(', '));
    process.exit(1);
  }
  if (!games.some((g) => g.id === id)) {
    console.error(`"${id}" is not in games.json. Available: ${games.map((g) => g.id).join(', ')}`);
    process.exit(1);
  }
  env.VITE_ONLY_GAME = id;
  console.log(`[gamebovh] Console with only "${id}"`);
}

// Le serveur WebSocket écoute sur WS_PORT (8787 par défaut), jamais sur le PORT
// éventuellement imposé par un outil de preview au processus parent.
const serverEnv = { ...env, PORT: env.WS_PORT || '8787' };

const children = [
  spawn('pnpm', ['--filter', '@gamebovh/server', 'dev'], { cwd: root, env: serverEnv, stdio: 'inherit' }),
  spawn('pnpm', ['--filter', '@gamebovh/console', 'dev'], { cwd: root, env, stdio: 'inherit' }),
];

const stop = () => {
  for (const c of children) c.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const c of children) c.on('exit', (code) => code && code !== 0 && stop());
