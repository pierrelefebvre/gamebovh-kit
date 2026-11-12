#!/usr/bin/env node
// Vérifie games.json : champs obligatoires, ids uniques, dossiers et modules présents.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRED = ['id', 'name', 'team', 'version', 'description', 'minPlayers', 'maxPlayers', 'module'];

let catalog;
try {
  catalog = JSON.parse(readFileSync(join(root, 'games.json'), 'utf8'));
} catch (error) {
  console.error(`games.json is not valid JSON: ${error.message}`);
  process.exit(1);
}

const errors = [];
const seen = new Set();
if (!Array.isArray(catalog.games)) errors.push('"games" must be an array.');

for (const [i, g] of (catalog.games ?? []).entries()) {
  const where = `#${i + 1}${g?.id ? ` (${g.id})` : ''}`;
  const missing = REQUIRED.filter((k) => g?.[k] === undefined || g?.[k] === '');
  if (missing.length) {
    errors.push(`${where}: missing ${missing.join(', ')}`);
    continue;
  }
  if (typeof g.en?.name !== 'string' || !g.en.name || typeof g.en?.description !== 'string' || !g.en.description) {
    errors.push(`${where}: missing English text: "en": { "name": "...", "description": "..." }`);
  }
  if (!/^[a-z0-9_-]+$/.test(g.id)) errors.push(`${where}: id must be lowercase letters, digits, - or _`);
  if (seen.has(g.id)) errors.push(`${where}: duplicate id`);
  seen.add(g.id);
  if (!(Number.isInteger(g.minPlayers) && Number.isInteger(g.maxPlayers) && g.minPlayers >= 1 && g.maxPlayers <= 4 && g.minPlayers <= g.maxPlayers)) {
    errors.push(`${where}: players must satisfy 1 <= minPlayers <= maxPlayers <= 4`);
  }
  if (!/^\d+\.\d+\.\d+/.test(g.version)) errors.push(`${where}: version should look like 1.0.0`);
  if (g.module !== `games/${g.id}/src/index.tsx`) {
    errors.push(`${where}: module should be "games/${g.id}/src/index.tsx" (folder name = id)`);
  }
  if (!existsSync(join(root, g.module))) errors.push(`${where}: file ${g.module} not found`);
}

if (errors.length) {
  console.error('games.json has problems:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`games.json OK (${catalog.games.length} cartridge(s))`);
