import type { GameDefinition, GameManifest } from '@gamebovh/sdk';
import catalogJson from '../../../../games.json';
import { ONLY_GAME } from './config.ts';

export interface CatalogEntry extends GameManifest {
  module: string;
}

export interface Catalog {
  games: CatalogEntry[];
  errors: string[];
}

/*
 * Toutes les cartouches présentes dans games/ sont découvertes ici.
 * Chacune devient un fichier JS séparé, chargé seulement quand on la lance.
 */
const modules = import.meta.glob<{ default: GameDefinition }>('../../../../games/*/src/index.tsx');

function moduleKey(path: string): string {
  return path.replace(/^(\.\.\/)+/, '');
}

const loaders = new Map(Object.entries(modules).map(([path, load]) => [moduleKey(path), load]));

const REQUIRED: (keyof CatalogEntry)[] = [
  'id',
  'name',
  'team',
  'version',
  'description',
  'minPlayers',
  'maxPlayers',
  'module',
];

/** Lit et vérifie games.json. Les entrées invalides sont écartées avec un message clair. */
export function loadCatalog(): Catalog {
  const raw = (catalogJson as { games?: unknown }).games;
  const errors: string[] = [];
  const games: CatalogEntry[] = [];
  const seen = new Set<string>();

  if (!Array.isArray(raw)) {
    return { games, errors: ['games.json: "games" must be an array.'] };
  }

  raw.forEach((item, index) => {
    const e = item as CatalogEntry;
    const where = `games.json #${index + 1}${e?.id ? ` (${e.id})` : ''}`;
    const missing = REQUIRED.filter((k) => e?.[k] === undefined || e?.[k] === '');
    if (missing.length) return errors.push(`${where}: missing ${missing.join(', ')}.`);
    if (!/^[a-z0-9_-]+$/.test(e.id)) return errors.push(`${where}: id must be lowercase letters, digits, - or _.`);
    if (seen.has(e.id)) return errors.push(`${where}: duplicate id.`);
    if (!(e.minPlayers >= 1 && e.maxPlayers <= 4 && e.minPlayers <= e.maxPlayers)) {
      return errors.push(`${where}: players must satisfy 1 <= minPlayers <= maxPlayers <= 4.`);
    }
    if (!loaders.has(e.module)) {
      return errors.push(`${where}: module "${e.module}" not found (expected games/<id>/src/index.tsx).`);
    }
    seen.add(e.id);
    games.push({ ...e });
  });

  for (const error of errors) console.error(`[gamebovh] ${error}`);

  if (ONLY_GAME) {
    const only = games.filter((g) => g.id === ONLY_GAME);
    if (!only.length) errors.push(`VITE_ONLY_GAME="${ONLY_GAME}" is not in games.json.`);
    return { games: only, errors };
  }
  return { games: games.filter((g) => !g.id.startsWith('_')), errors };
}

const cache = new Map<string, Promise<GameDefinition>>();

const RELOAD_KEY = 'gamebovh:reloaded-at';

/**
 * Après une mise en ligne, une page restée ouverte réclame d'anciens fichiers de cartouche
 * qui n'existent plus. Dans ce cas, on recharge la page une fois pour prendre la nouvelle version.
 */
export function reloadIfOutdated(error: unknown): void {
  const message = String((error as Error)?.message ?? error);
  const outdated = /dynamically imported module|MIME type|Importing a module script failed|Failed to fetch/i.test(message);
  if (!outdated) return;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 30_000) return; // déjà rechargé il y a peu : on n'insiste pas
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return;
  }
  window.location.reload();
}

/** Charge le code d'une cartouche (une seule fois). */
export function loadGame(entry: CatalogEntry): Promise<GameDefinition> {
  let promise = cache.get(entry.id);
  if (!promise) {
    const load = loaders.get(entry.module);
    promise = load
      ? load().then((m) => {
          const def = m.default;
          if (!def || !def.component) {
            throw new Error(`${entry.module} must "export default defineGame({...})".`);
          }
          return def;
        })
      : Promise.reject(new Error(`Module not found: ${entry.module}`));
    promise.catch((error) => {
      cache.delete(entry.id);
      reloadIfOutdated(error);
    });
    cache.set(entry.id, promise);
  }
  return promise;
}

export function manifestOf(entry: CatalogEntry): GameManifest {
  const { module: _module, ...manifest } = entry;
  return manifest;
}
