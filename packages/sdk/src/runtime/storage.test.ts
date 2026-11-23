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
    const store = new MemoryStore();
    const chrono = new GameStorage(store, 'slalom', 'asc', 'me');
    const other = new GameStorage(store, 'slalom', 'asc', 'other');
    await other.addScore({ nickname: 'B', score: 4000 });
    await chrono.addScore({ nickname: 'A', score: 5000 });
    const { rank } = await chrono.addScore({ nickname: 'A', score: 3000 });
    expect(rank).toBe(1);
    expect((await chrono.getLeaderboard()).map((e) => e.score)).toEqual([3000, 4000]);

    const points = new GameStorage(new MemoryStore(), 'snowball', 'desc', 'me');
    await points.addScore({ nickname: 'A', score: 10 });
    await points.addScore({ nickname: 'A', score: 30 });
    expect((await points.getPersonalBest())!.score).toBe(30);
  });

  it('keeps only the best score of each player', async () => {
    const store = new MemoryStore();
    const me = new GameStorage(store, 'snowoff', 'asc', 'me');
    const bob = new GameStorage(store, 'snowoff', 'asc', 'bob');
    await me.addScore({ nickname: 'A', score: 320 });
    await me.addScore({ nickname: 'A', score: 9999, display: '---' }); // partie sans temps : ne remplace rien
    await me.addScore({ nickname: 'A', score: 410 });
    const { rank } = await me.addScore({ nickname: 'A', score: 500 });
    await bob.addScore({ nickname: 'Bob', score: 300 });
    const board = await me.getLeaderboard();
    expect(board.map((e) => [e.nickname, e.score])).toEqual([
      ['Bob', 300],
      ['A', 320],
    ]);
    expect(rank).toBe(1); // avant l'arrivée de Bob, A était premier
    expect((await me.getPersonalBest())!.score).toBe(320);

    const points = new GameStorage(new MemoryStore(), 'snowball', 'desc', 'me');
    await points.addScore({ nickname: 'A', score: 10 });
    await points.addScore({ nickname: 'A', score: 30 });
    await points.addScore({ nickname: 'A', score: 20 });
    expect((await points.getLeaderboard()).map((e) => e.score)).toEqual([30]);
  });

  it('cleans up an old leaderboard with several lines per player', async () => {
    const store = new MemoryStore();
    const e = (id: string, playerId: string, score: number) => ({ id, gameId: 'slalom', playerId, nickname: playerId, score, date: 1 });
    await store.set('scores:slalom', [e('1', 'me', 5000), e('2', 'me', 3000), e('3', 'bob', 4000), e('4', 'me', 3500)]);
    const s = new GameStorage(store, 'slalom', 'asc', 'me');
    expect((await s.getLeaderboard()).map((x) => x.id)).toEqual(['2', '3']);
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
    expect((await s.getLeaderboard()).map((e) => e.score)).toEqual([1]);
  });
});
