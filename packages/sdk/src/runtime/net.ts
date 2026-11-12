import {
  PROTOCOL_VERSION,
  normalizeRoomCode,
  type ClientMessage,
  type ErrorCode,
  type PlayerInfo,
  type ServerMessage,
} from '@gamebovh/protocol';
import type { ConnectionStatus, Player, Room } from '../contract.ts';
import { Emitter } from './emitter.ts';

type NetEvents = {
  status: [ConnectionStatus];
  room: [Room | null];
  join: [Player];
  leave: [Player];
  relay: [unknown, Player];
  error: [ErrorCode, string];
};

export class NetError extends Error {
  constructor(
    public readonly code: ErrorCode | 'timeout' | 'offline',
    message: string,
  ) {
    super(message);
  }
}

const REQUEST_TIMEOUT_MS = 8000;

/**
 * Client WebSocket unique de la console.
 * Se connecte à la demande, garde une salle à la fois et
 * tente de la rejoindre à nouveau si la connexion saute.
 */
export class NetClient {
  status: ConnectionStatus = 'offline';
  room: Room | null = null;
  myId: string | null = null;

  private socket: WebSocket | null = null;
  private connecting: Promise<void> | null = null;
  private events = new Emitter<NetEvents>();
  private pending: { resolve: (r: Room) => void; reject: (e: Error) => void; timer: number } | null = null;
  /** Salle à retrouver après une coupure. */
  private wanted: { code: string; gameId: string } | null = null;
  private retry = 0;
  private retryTimer: number | null = null;

  constructor(
    private readonly url: string,
    private readonly getNickname: () => string,
  ) {}

  on<K extends keyof NetEvents>(event: K, cb: (...args: NetEvents[K]) => void) {
    return this.events.on(event, cb);
  }

  private setStatus(status: ConnectionStatus) {
    if (this.status === status) return;
    this.status = status;
    this.events.emit('status', status);
  }

  /** Ouvre la connexion si besoin et attend l'accueil du serveur. */
  connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN && this.myId) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.setStatus('connecting');
    this.connecting = new Promise<void>((resolve, reject) => {
      let socket: WebSocket;
      try {
        socket = new WebSocket(this.url);
      } catch (error) {
        this.connecting = null;
        this.setStatus('error');
        reject(new NetError('offline', `Cannot reach server (${String(error)})`));
        return;
      }
      this.socket = socket;
      const timer = window.setTimeout(() => {
        socket.close();
        fail(new NetError('timeout', 'Server did not answer.'));
      }, REQUEST_TIMEOUT_MS);
      let settled = false;
      const fail = (e: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        this.connecting = null;
        reject(e);
      };
      socket.onopen = () => this.raw({ t: 'hello', v: PROTOCOL_VERSION, nickname: this.getNickname() });
      socket.onmessage = (event) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (message.t === 'welcome' && !settled) {
          settled = true;
          window.clearTimeout(timer);
          this.connecting = null;
          this.myId = message.id;
          this.retry = 0;
          this.setStatus('online');
          resolve();
          if (this.wanted && !this.room) this.raw({ t: 'join', ...this.wanted });
          return;
        }
        this.handle(message);
      };
      socket.onclose = () => {
        fail(new NetError('offline', 'Connection closed.'));
        if (this.socket === socket) this.onDisconnect();
      };
      socket.onerror = () => fail(new NetError('offline', 'Cannot reach server.'));
    });
    return this.connecting;
  }

  private onDisconnect() {
    this.socket = null;
    this.myId = null;
    this.rejectPending(new NetError('offline', 'Connection lost.'));
    if (this.room) {
      this.wanted = { code: this.room.code, gameId: this.room.gameId };
      this.room = null;
      this.events.emit('room', null);
    }
    if (this.wanted) {
      this.setStatus('connecting');
      const delay = Math.min(8000, 1000 * 2 ** this.retry++);
      this.retryTimer = window.setTimeout(() => {
        this.retryTimer = null;
        this.connect().catch(() => undefined);
      }, delay);
    } else {
      this.setStatus('offline');
    }
  }

  private raw(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private toPlayer(info: PlayerInfo): Player {
    return { ...info, isMe: info.id === this.myId };
  }

  private findPlayer(id: string): Player {
    return (
      this.room?.players.find((p) => p.id === id) ?? {
        id,
        nickname: '???',
        isHost: false,
        isMe: false,
        slot: 0,
      }
    );
  }

  private handle(message: ServerMessage) {
    switch (message.t) {
      case 'room': {
        this.room = { code: message.code, gameId: message.gameId, players: message.players.map((p) => this.toPlayer(p)) };
        this.wanted = { code: message.code, gameId: message.gameId };
        this.events.emit('room', this.room);
        if (this.pending) {
          window.clearTimeout(this.pending.timer);
          this.pending.resolve(this.room);
          this.pending = null;
        }
        return;
      }
      case 'presence': {
        if (!this.room) return;
        this.room = { ...this.room, players: message.players.map((p) => this.toPlayer(p)) };
        this.events.emit('room', this.room);
        this.events.emit(message.event, this.toPlayer(message.player));
        return;
      }
      case 'relay':
        this.events.emit('relay', message.data, this.findPlayer(message.from));
        return;
      case 'left':
        return;
      case 'error': {
        this.events.emit('error', message.code, message.message);
        if (this.pending) {
          this.rejectPending(new NetError(message.code, message.message));
        } else if (message.code === 'room_not_found' && this.wanted) {
          // La salle a disparu pendant la coupure.
          this.wanted = null;
        }
        return;
      }
    }
  }

  private rejectPending(error: Error) {
    if (!this.pending) return;
    window.clearTimeout(this.pending.timer);
    this.pending.reject(error);
    this.pending = null;
  }

  private request(message: ClientMessage): Promise<Room> {
    this.rejectPending(new NetError('bad_request', 'Cancelled.'));
    return new Promise<Room>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending = null;
        reject(new NetError('timeout', 'Server did not answer.'));
      }, REQUEST_TIMEOUT_MS);
      this.pending = { resolve, reject, timer };
      this.raw(message);
    });
  }

  async createRoom(gameId: string): Promise<Room> {
    await this.connect();
    return this.request({ t: 'create', gameId });
  }

  async joinRoom(code: string, gameId: string): Promise<Room> {
    await this.connect();
    return this.request({ t: 'join', code: normalizeRoomCode(code), gameId });
  }

  leaveRoom() {
    this.wanted = null;
    if (this.retryTimer) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
      if (!this.socket) this.setStatus('offline');
    }
    if (!this.room) return;
    this.raw({ t: 'leave' });
    this.room = null;
    this.events.emit('room', null);
  }

  /** Renvoie le pseudo au serveur (après un changement dans les réglages). */
  refreshNickname() {
    this.raw({ t: 'hello', v: PROTOCOL_VERSION, nickname: this.getNickname() });
  }

  send(data: unknown, to?: string) {
    if (!this.room) return;
    this.raw(to ? { t: 'relay', data, to } : { t: 'relay', data });
  }
}
