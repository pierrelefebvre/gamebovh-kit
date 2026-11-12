#!/usr/bin/env node
// Vérifie que les fichiers fournis par l'équipe pédagogique n'ont pas été modifiés.
//
//   node scripts/kit-check.mjs           vérification (lancée par `pnpm check`)
//   node scripts/kit-check.mjs --write   enregistre l'état de référence (équipe pédagogique uniquement)
//
// L'état de référence est stocké dans .kit-lock.json : l'empreinte (SHA-256) de chaque
// fichier protégé, la liste des fichiers de chaque dossier protégé, et les lignes de
// games.json fournies au départ. Sans .kit-lock.json, la vérification ne fait rien.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK = process.env.KIT_LOCK ?? join(root, '.kit-lock.json');

/** Dossiers fournis : aucun fichier ne doit y être ajouté, modifié ou supprimé. */
const PROTECTED_DIRS = ['apps', 'packages', 'server', 'scripts', 'docs', 'deploy'];
/** Fichiers fournis à la racine. */
const PROTECTED_FILES = [
  'package.json',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  'vitest.config.ts',
  'Dockerfile',
  'docker-compose.yml',
  '.dockerignore',
  '.env.example',
  '.gitignore',
  'README.md',
  'CONSIGNES.md',
  'ETUDIANTS.md',
];
const IGNORED = new Set(['node_modules', 'dist', '.DS_Store']);

const toPosix = (p) => p.split(sep).join('/');

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (IGNORED.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(toPosix(relative(root, full)));
  }
  return out;
}

function hash(file) {
  // Fins de ligne normalisées : un poste Windows ne doit pas déclencher de faux positif
  const text = readFileSync(join(root, file)).toString('utf8').replace(/\r\n/g, '\n');
  return createHash('sha256').update(text).digest('hex');
}

/** Dossiers de jeux fournis (modèle et démos) : protégés eux aussi. */
function providedGameDirs() {
  return readdirSync(join(root, 'games'))
    .filter((d) => statSync(join(root, 'games', d)).isDirectory())
    .map((d) => `games/${d}`);
}

function readCatalog() {
  return JSON.parse(readFileSync(join(root, 'games.json'), 'utf8')).games ?? [];
}

if (process.argv.includes('--write')) {
  const dirs = [...PROTECTED_DIRS, ...providedGameDirs()];
  const files = {};
  for (const d of dirs) for (const f of walk(join(root, d))) files[f] = hash(f);
  for (const f of PROTECTED_FILES) if (existsSync(join(root, f))) files[f] = hash(f);
  const lock = { dirs, files, games: readCatalog() };
  writeFileSync(LOCK, JSON.stringify(lock, null, 2) + '\n');
  console.log(`État de référence enregistré : ${Object.keys(files).length} fichiers protégés, ${dirs.length} dossiers.`);
  process.exit(0);
}

if (!existsSync(LOCK)) process.exit(0);

const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
const problems = [];

for (const [file, expected] of Object.entries(lock.files)) {
  if (!existsSync(join(root, file))) problems.push(`supprimé  ${file}`);
  else if (hash(file) !== expected) problems.push(`modifié   ${file}`);
}
for (const d of lock.dirs) {
  for (const f of walk(join(root, d))) if (!(f in lock.files)) problems.push(`ajouté    ${f}`);
}

const current = readCatalog();
for (const original of lock.games) {
  const now = current.find((g) => g.id === original.id);
  if (!now) problems.push(`games.json : la ligne "${original.id}" a été supprimée`);
  else if (JSON.stringify(now) !== JSON.stringify(original)) problems.push(`games.json : la ligne "${original.id}" a été modifiée`);
}

if (problems.length) {
  console.error('\nFichiers fournis modifiés : interdit (voir ETUDIANTS.md, section « Ce que vous ne devez pas modifier »).\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nPour annuler une modification : git checkout -- <fichier>');
  console.error("Pour un fichier ajouté par erreur : supprimez-le ou déplacez-le dans le dossier de votre jeu.\n");
  process.exit(1);
}
console.log('Fichiers fournis intacts.');
