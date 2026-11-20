#!/usr/bin/env node
// Vérifie games.json : champs obligatoires, ids uniques, dossiers et modules présents.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
const warnings = [];
const seen = new Set();

const HEX = /^#[0-9a-fA-F]{6}$/;
const CARTRIDGE_SIZES = ['84x42', '168x84', '252x126'];
const FONT_EXT = /\.(woff2?|ttf|otf)$/i;
const FONT_MAX = 200 * 1024;
const GAME_MAX = 2 * 1024 * 1024;

/** Largeur x hauteur d'un PNG (lues dans son en-tête), ou null. */
function pngSize(file) {
  const b = readFileSync(file);
  if (b.length < 24 || b.toString('ascii', 1, 4) !== 'PNG') return null;
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

function filesOf(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist') return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? filesOf(full) : [full];
  });
}

/** Image de cartouche, polices et poids du dossier d'un jeu. */
function checkGameFiles(g, where) {
  const dir = join(root, 'games', g.id);
  const cover = join(dir, 'cartridge.png');
  if (existsSync(cover)) {
    const size = pngSize(cover);
    if (!size) errors.push(`${where}: games/${g.id}/cartridge.png is not a valid PNG`);
    else if (!CARTRIDGE_SIZES.includes(size)) {
      errors.push(`${where}: games/${g.id}/cartridge.png is ${size}, expected 84x42 (or 168x84, 252x126)`);
    }
    if (statSync(cover).size > 100 * 1024) errors.push(`${where}: games/${g.id}/cartridge.png is over 100 KB`);
  }
  let total = 0;
  for (const f of filesOf(dir)) {
    const bytes = statSync(f).size;
    total += bytes;
    if (FONT_EXT.test(f) && bytes > FONT_MAX) {
      errors.push(`${where}: font ${f.slice(root.length + 1)} is ${Math.round(bytes / 1024)} KB, max 200 KB`);
    }
  }
  if (total > GAME_MAX) warnings.push(`${where}: games/${g.id}/ weighs ${(total / 1048576).toFixed(1)} MB (aim for under 2 MB)`);
}

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
  if (g.cartridge !== undefined) {
    for (const [k, v] of Object.entries(g.cartridge ?? {})) {
      if (!['color', 'labelColor', 'textColor'].includes(k)) errors.push(`${where}: cartridge.${k} is unknown (color, labelColor, textColor)`);
      else if (typeof v !== 'string' || !HEX.test(v)) errors.push(`${where}: cartridge.${k} must look like "#d7263d"`);
    }
  }
  if (/^[a-z0-9_-]+$/.test(g.id)) checkGameFiles(g, where);
}

for (const w of warnings) console.warn(`games.json warning: ${w}`);
if (errors.length) {
  console.error('games.json has problems:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`games.json OK (${catalog.games.length} cartridge(s))`);
