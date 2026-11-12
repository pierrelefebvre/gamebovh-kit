import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { GameStorage, IndexedDbStore, MemoryStore } from './storage.ts';

describe('GameStorage', () => {
  it('namespaces free keys per game', async () => {
    const store = new MemoryStore();
    const a = new GameStorage(store, 'slalom', 'asc', 'me');
    const b = new GameStorage(store, 'snowball', 'desc', 'me');
    await a.set('level', 3);
    expect(await a.get('level')).toBe(3);
    expect(await b.get('level')).toBeUndefined();
  });

  it('sorts by score order and computes rank', async () => {
    const chrono = new GameStorage(new MemoryStore(), 'slalom', 'asc', 'me');
    await chrono.addScore({ nickname: 'A', score: 5000 });
    const { rank } = await chrono.addScore({ nickname: 'A', score: 3000 });
    expect(rank).toBe(1);
    expect((await chrono.getLeaderboard()).map((e) => e.score)).toEqual([3000, 5000]);

    const points = new GameStorage(new MemoryStore(), 'snowball', 'desc', 'me');
    await points.addScore({ nickname: 'A', score: 10 });
    await points.addScore({ nickname: 'A', score: 30 });
    expect((await points.getPersonalBest())!.score).toBe(30);
  });

  it('merges remote scores without duplicates and rejects junk', async () => {
    const mine = new GameStorage(new MemoryStore(), 'slalom', 'asc', 'me');
    const theirs = new GameStorage(new MemoryStore(), 'slalom', 'asc', 'them');
    await theirs.addScore({ nickname: 'Bob', score: 1000 });
    const remote = await theirs.getLeaderboard();

    expect(await mine.mergeScores(remote)).toBe(1);
    expect(await mine.mergeScores(remote)).toBe(0);
    expect(
      await mine.mergeScores([
        { ...remote[0], id: 'x', gameId: 'other' },
        { ...remote[0], id: 'y', score: Number.NaN },
        null as never,
      ]),
    ).toBe(0);
    expect((await mine.getLeaderboard())[0].nickname).toBe('Bob');
    expect(await mine.getPersonalBest()).toBeUndefined();
  });

  it('works on IndexedDB', async () => {
    const s = new GameStorage(new IndexedDbStore(), 'slalom', 'asc', 'me');
    await Promise.all([s.addScore({ nickname: 'A', score: 2 }), s.addScore({ nickname: 'A', score: 1 })]);
    expect((await s.getLeaderboard()).map((e) => e.score)).toEqual([1, 2]);
  });
});
