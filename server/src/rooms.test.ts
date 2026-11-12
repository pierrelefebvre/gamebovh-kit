import { describe, expect, it } from 'vitest';
import type { ServerMessage } from '@gamebovh/protocol';
import { RoomManager, type Peer } from './rooms.ts';
import { TokenBucket } from './limits.ts';

function peer(id: string): Peer & { inbox: ServerMessage[] } {
  const inbox: ServerMessage[] = [];
  return { id, nickname: id, roomCode: null, inbox, send: (m) => inbox.push(m) };
}

function last<T extends ServerMessage['t']>(p: { inbox: ServerMessage[] }, t: T) {
  const found = [...p.inbox].reverse().find((m) => m.t === t);
  return found as Extract<ServerMessage, { t: T }> | undefined;
}

describe('RoomManager', () => {
  it('creates a room with a 4 letter code and makes the creator host', () => {
    const rooms = new RoomManager({ maxRooms: 10 });
    const a = peer('a');
    rooms.create(a, 'slalom');
    const room = last(a, 'room')!;
    expect(room.code).toMatch(/^[A-HJ-NP-Z]{4}$/);
    expect(room.players).toEqual([{ id: 'a', nickname: 'a', slot: 0, isHost: true }]);
  });

  it('caps rooms at 4 players and rejects other games', () => {
    const rooms = new RoomManager({ maxRooms: 10 });
    const [a, b, c, d, e, f] = ['a', 'b', 'c', 'd', 'e', 'f'].map(peer);
    rooms.create(a, 'slalom');
    const code = last(a, 'room')!.code;
    for (const p of [b, c, d]) rooms.join(p, code, 'slalom');
    expect(last(d, 'room')!.players.map((p) => p.slot)).toEqual([0, 1, 2, 3]);

    rooms.join(e, code, 'slalom');
    expect(last(e, 'error')!.code).toBe('room_full');

    rooms.join(f, code, 'snowball');
    expect(last(f, 'error')!.code).toBe('wrong_game');
  });

  it('broadcasts presence and hands host over when the host leaves', () => {
    const rooms = new RoomManager({ maxRooms: 10 });
    const [a, b, c] = ['a', 'b', 'c'].map(peer);
    rooms.create(a, 'g');
    const code = last(a, 'room')!.code;
    rooms.join(b, code, 'g');
    rooms.join(c, code, 'g');
    expect(last(a, 'presence')!.event).toBe('join');

    rooms.leave(a);
    expect(last(a, 'left')).toBeDefined();
    const p = last(b, 'presence')!;
    expect(p.event).toBe('leave');
    expect(p.player.id).toBe('a');
    expect(p.players.find((x) => x.isHost)!.id).toBe('b');

    // Le slot libéré est réutilisé par le suivant.
    const d = peer('d');
    rooms.join(d, code, 'g');
    expect(last(d, 'room')!.players.find((x) => x.id === 'd')!.slot).toBe(0);
  });

  it('relays to everyone but the sender, or to a single target', () => {
    const rooms = new RoomManager({ maxRooms: 10 });
    const [a, b, c] = ['a', 'b', 'c'].map(peer);
    rooms.create(a, 'g');
    const code = last(a, 'room')!.code;
    rooms.join(b, code, 'g');
    rooms.join(c, code, 'g');

    rooms.relay(a, { type: 'pos', x: 1 });
    expect(last(b, 'relay')).toEqual({ t: 'relay', from: 'a', data: { type: 'pos', x: 1 } });
    expect(last(c, 'relay')!.from).toBe('a');
    expect(last(a, 'relay')).toBeUndefined();

    rooms.relay(b, { type: 'secret' }, 'c');
    expect(last(c, 'relay')!.data).toEqual({ type: 'secret' });
    expect(last(a, 'relay')).toBeUndefined();
  });

  it('deletes empty rooms and enforces maxRooms', () => {
    const rooms = new RoomManager({ maxRooms: 1 });
    const [a, b] = ['a', 'b'].map(peer);
    rooms.create(a, 'g');
    rooms.create(b, 'g');
    expect(last(b, 'error')!.code).toBe('too_many_rooms');
    rooms.leave(a, true);
    expect(rooms.roomCount).toBe(0);
    rooms.create(b, 'g');
    expect(rooms.roomCount).toBe(1);
  });

  it('refuses relay outside a room', () => {
    const rooms = new RoomManager({ maxRooms: 1 });
    const a = peer('a');
    rooms.relay(a, {});
    expect(last(a, 'error')!.code).toBe('not_in_room');
  });
});

describe('TokenBucket', () => {
  it('allows a burst then refills over time', () => {
    let t = 0;
    const bucket = new TokenBucket(10, 2, () => t);
    expect(bucket.take()).toBe(true);
    expect(bucket.take()).toBe(true);
    expect(bucket.take()).toBe(false);
    t += 100;
    expect(bucket.take()).toBe(true);
  });
});
