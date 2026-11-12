import {
  MAX_PLAYERS,
  type PlayerInfo,
  type ServerMessage,
  type Slot,
} from '@gamebovh/protocol';
import { generateRoomCode } from './codes.ts';

/** Une connexion vue par le gestionnaire de salles (indépendant de `ws`, donc testable). */
export interface Peer {
  id: string;
  nickname: string | null;
  roomCode: string | null;
  send(message: ServerMessage): void;
}

interface Member {
  peer: Peer;
  slot: Slot;
}

interface Room {
  code: string;
  gameId: string;
  /** Ordre d'arrivée : le premier est l'hôte. */
  members: Member[];
}

export interface RoomManagerOptions {
  maxRooms: number;
  random?: (max: number) => number;
}

/**
 * Gère les salles en mémoire. Ne connaît rien des jeux :
 * un `gameId` est une simple étiquette pour éviter de rejoindre
 * une salle de slalom depuis le jeu de boules de neige.
 */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  constructor(private readonly options: RoomManagerOptions) {}

  get roomCount(): number {
    return this.rooms.size;
  }

  get playerCount(): number {
    let n = 0;
    for (const room of this.rooms.values()) n += room.members.length;
    return n;
  }

  create(peer: Peer, gameId: string): void {
    if (peer.roomCode) this.leave(peer);
    if (this.rooms.size >= this.options.maxRooms) {
      peer.send({ t: 'error', code: 'too_many_rooms', message: 'Server is full, try again later.' });
      return;
    }
    const code = generateRoomCode((c) => this.rooms.has(c), this.options.random);
    const room: Room = { code, gameId, members: [] };
    this.rooms.set(code, room);
    this.addMember(room, peer);
  }

  join(peer: Peer, code: string, gameId: string): void {
    const room = this.rooms.get(code);
    if (!room) {
      peer.send({ t: 'error', code: 'room_not_found', message: `Room ${code} does not exist.` });
      return;
    }
    if (room.gameId !== gameId) {
      peer.send({ t: 'error', code: 'wrong_game', message: `Room ${code} is for another game.` });
      return;
    }
    if (room.members.some((m) => m.peer === peer)) {
      peer.send(this.roomMessage(room));
      return;
    }
    if (room.members.length >= MAX_PLAYERS) {
      peer.send({ t: 'error', code: 'room_full', message: `Room ${code} is full.` });
      return;
    }
    if (peer.roomCode) this.leave(peer);
    this.addMember(room, peer);
  }

  /** Retire le joueur de sa salle. `silent` : pas de confirmation (déconnexion). */
  leave(peer: Peer, silent = false): void {
    const code = peer.roomCode;
    if (!code) return;
    peer.roomCode = null;
    const room = this.rooms.get(code);
    if (!room) return;
    const index = room.members.findIndex((m) => m.peer === peer);
    if (index === -1) return;
    const [member] = room.members.splice(index, 1);
    if (!silent) peer.send({ t: 'left' });

    if (room.members.length === 0) {
      this.rooms.delete(code);
      return;
    }
    const players = this.players(room);
    const player = this.toInfo(room, member, false);
    for (const m of room.members) {
      m.peer.send({ t: 'presence', event: 'leave', player, players });
    }
  }

  /** Relaie un message opaque à toute la salle (sauf l'émetteur) ou à un seul joueur. */
  relay(peer: Peer, data: unknown, to?: string): void {
    const room = peer.roomCode ? this.rooms.get(peer.roomCode) : undefined;
    if (!room) {
      peer.send({ t: 'error', code: 'not_in_room', message: 'Join a room first.' });
      return;
    }
    const message: ServerMessage = { t: 'relay', from: peer.id, data };
    for (const m of room.members) {
      if (m.peer === peer) continue;
      if (to && m.peer.id !== to) continue;
      m.peer.send(message);
    }
  }

  private addMember(room: Room, peer: Peer): void {
    const used = new Set(room.members.map((m) => m.slot));
    let slot = 0 as Slot;
    while (used.has(slot)) slot = (slot + 1) as Slot;
    const member: Member = { peer, slot };
    room.members.push(member);
    peer.roomCode = room.code;

    peer.send(this.roomMessage(room));
    const players = this.players(room);
    const player = this.toInfo(room, member);
    for (const m of room.members) {
      if (m.peer === peer) continue;
      m.peer.send({ t: 'presence', event: 'join', player, players });
    }
  }

  private roomMessage(room: Room): ServerMessage {
    return { t: 'room', code: room.code, gameId: room.gameId, players: this.players(room) };
  }

  private players(room: Room): PlayerInfo[] {
    return room.members.map((m) => this.toInfo(room, m));
  }

  private toInfo(room: Room, member: Member, inRoom = true): PlayerInfo {
    return {
      id: member.peer.id,
      nickname: member.peer.nickname ?? 'Player',
      slot: member.slot,
      isHost: inRoom && room.members[0] === member,
    };
  }
}
