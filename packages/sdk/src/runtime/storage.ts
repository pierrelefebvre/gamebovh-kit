import type { ScoreEntry, StorageApi } from '../contract.ts';

/** Stockage clé / valeur asynchrone. IndexedDB, sinon localStorage, sinon mémoire. */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

const DB_NAME = 'gamebovh';
const STORE = 'kv';

export class IndexedDbStore implements KeyValueStore {
  private dbPromise: Promise<IDBDatabase>;

  constructor(factory: IDBFactory = indexedDB) {
    this.dbPromise = new Promise((resolve, reject) => {
      const request = factory.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await this.dbPromise;
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = fn(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  }

  get<T>(key: string) {
    return this.run<T | undefined>('readonly', (s) => s.get(key));
  }
  async set<T>(key: string, value: T) {
    await this.run('readwrite', (s) => s.put(value, key));
  }
  async remove(key: string) {
    await this.run('readwrite', (s) => s.delete(key));
  }

  /** Vérifie qu'IndexedDB fonctionne vraiment (navigation privée, iframes...). */
  async probe(): Promise<boolean> {
    try {
      await this.set('__probe', 1);
      return true;
    } catch {
      return false;
    }
  }
}

export class LocalStorageStore implements KeyValueStore {
  constructor(private readonly prefix = 'gamebovh:') {}
  async get<T>(key: string) {
    const raw = localStorage.getItem(this.prefix + key);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  }
  async set<T>(key: string, value: T) {
    localStorage.setItem(this.prefix + key, JSON.stringify(value));
  }
  async remove(key: string) {
    localStorage.removeItem(this.prefix + key);
  }
}

export class MemoryStore implements KeyValueStore {
  private data = new Map<string, unknown>();
  async get<T>(key: string) {
    return structuredClone(this.data.get(key)) as T | undefined;
  }
  async set<T>(key: string, value: T) {
    this.data.set(key, structuredClone(value));
  }
  async remove(key: string) {
    this.data.delete(key);
  }
}

/** Choisit le meilleur stockage disponible. */
export async function openBestStore(): Promise<KeyValueStore> {
  try {
    if (typeof indexedDB !== 'undefined') {
      const idb = new IndexedDbStore();
      if (await idb.probe()) return idb;
    }
  } catch {
    /* on tente la suite */
  }
  try {
    localStorage.setItem('gamebovh:__probe', '1');
    return new LocalStorageStore();
  } catch {
    return new MemoryStore();
  }
}

/** Taille maximum d'un classement local par jeu. */
export const LEADERBOARD_SIZE = 100;

export function compareScores(order: 'asc' | 'desc') {
  return (a: ScoreEntry, b: ScoreEntry) =>
    (order === 'asc' ? a.score - b.score : b.score - a.score) || a.date - b.date;
}

function isScoreEntry(e: unknown, gameId: string): e is ScoreEntry {
  if (!e || typeof e !== 'object') return false;
  const s = e as ScoreEntry;
  return (
    typeof s.id === 'string' &&
    s.id.length <= 80 &&
    s.gameId === gameId &&
    typeof s.playerId === 'string' &&
    typeof s.nickname === 'string' &&
    s.nickname.length <= 24 &&
    typeof s.score === 'number' &&
    Number.isFinite(s.score) &&
    typeof s.date === 'number' &&
    (s.display === undefined || (typeof s.display === 'string' && s.display.length <= 24))
  );
}

export function randomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Stockage d'un jeu : clés libres préfixées par l'id du jeu + classement local.
 * Les écritures sur le classement sont sérialisées pour éviter les pertes.
 */
export class GameStorage implements StorageApi {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: KeyValueStore,
    private readonly gameId: string,
    private readonly scoreOrder: 'asc' | 'desc',
    private readonly playerId: string,
  ) {}

  private key(key: string) {
    return `game:${this.gameId}:${key}`;
  }
  private get scoresKey() {
    return `scores:${this.gameId}`;
  }

  get<T>(key: string) {
    return this.store.get<T>(this.key(key));
  }
  set<T>(key: string, value: T) {
    return this.store.set(this.key(key), value);
  }
  remove(key: string) {
    return this.store.remove(this.key(key));
  }

  private async readScores(): Promise<ScoreEntry[]> {
    const list = await this.store.get<ScoreEntry[]>(this.scoresKey);
    return Array.isArray(list) ? list : [];
  }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  async getLeaderboard(limit = 10): Promise<ScoreEntry[]> {
    await this.queue;
    return (await this.readScores()).sort(compareScores(this.scoreOrder)).slice(0, limit);
  }

  async getPersonalBest(): Promise<ScoreEntry | undefined> {
    await this.queue;
    return (await this.readScores())
      .filter((e) => e.playerId === this.playerId)
      .sort(compareScores(this.scoreOrder))[0];
  }

  /** Enregistre un score de ce joueur. Renvoie l'entrée et son rang (1 = premier). */
  addScore(input: { nickname: string; score: number; display?: string }): Promise<{ entry: ScoreEntry; rank: number }> {
    return this.serial(async () => {
      const entry: ScoreEntry = {
        id: randomId(),
        gameId: this.gameId,
        playerId: this.playerId,
        nickname: input.nickname,
        score: input.score,
        display: input.display,
        date: Date.now(),
      };
      const list = [...(await this.readScores()), entry].sort(compareScores(this.scoreOrder));
      const kept = list.slice(0, LEADERBOARD_SIZE);
      const rank = list.indexOf(entry) + 1;
      await this.store.set(this.scoresKey, kept);
      return { entry, rank };
    });
  }

  mergeScores(entries: ScoreEntry[]): Promise<number> {
    return this.serial(async () => {
      if (!Array.isArray(entries)) return 0;
      const current = await this.readScores();
      const ids = new Set(current.map((e) => e.id));
      let added = 0;
      for (const raw of entries.slice(0, LEADERBOARD_SIZE)) {
        if (!isScoreEntry(raw, this.gameId) || ids.has(raw.id)) continue;
        ids.add(raw.id);
        current.push({
          id: raw.id,
          gameId: raw.gameId,
          playerId: raw.playerId,
          nickname: raw.nickname,
          score: raw.score,
          display: raw.display,
          date: raw.date,
        });
        added++;
      }
      if (added === 0) return 0;
      const kept = current.sort(compareScores(this.scoreOrder)).slice(0, LEADERBOARD_SIZE);
      await this.store.set(this.scoresKey, kept);
      return added;
    });
  }
}
