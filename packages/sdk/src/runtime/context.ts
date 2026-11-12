import {
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  type Button,
  type GameContext,
  type GameManifest,
  type GameResult,
  type MultiplayerApi,
  type Player,
  type Room,
  type ScoreEntry,
} from '../contract.ts';
import { isSystemMessage, SYSTEM, type SystemChannel, type SystemMessage } from '../system.ts';
import type { AudioEngine } from './audio.ts';
import { Emitter, Subscriptions } from './emitter.ts';
import type { InputBus } from './inputBus.ts';
import type { NetClient } from './net.ts';
import type { GameStorage } from './storage.ts';

export interface ContextServices {
  input: InputBus;
  audio: AudioEngine;
  net: NetClient;
  storage: GameStorage;
  player: { id: string; nickname: string };
}

export interface ContextHooks {
  onGameOver(result: GameResult): Promise<ScoreEntry>;
  onExit(): void;
}

export interface GameSession {
  ctx: GameContext;
  setPaused(paused: boolean): void;
  readonly ended: boolean;
  dispose(): void;
}

/**
 * Construit le `ctx` donné à un jeu. Tout abonnement pris par le jeu
 * est nettoyé à la fin de la session (le jeu ne peut pas fuir).
 */
export function createGameSession(
  manifest: GameManifest,
  services: ContextServices,
  hooks: ContextHooks,
  inRoom: boolean,
  seed: number,
): GameSession {
  const subs = new Subscriptions();
  const life = new Emitter<{ pause: []; resume: [] }>();
  let paused = false;
  let ended = false;
  let disposed = false;

  const forward = (filter: Button | '*', cb: (b: Button) => void) => (b: Button) => {
    if (paused || disposed) return;
    if (filter === '*' || filter === b) cb(b);
  };

  const input: GameContext['input'] = {
    isDown: (b) => !paused && services.input.isDown(b),
    snapshot: () => {
      const s = services.input.snapshot();
      if (!paused) return s;
      return Object.fromEntries(Object.keys(s).map((k) => [k, false])) as typeof s;
    },
    onPress: (b, cb) => subs.add(services.input.onPress(forward(b, cb))),
    onRelease: (b, cb) => subs.add(services.input.onRelease(forward(b, cb))),
  };

  const lifecycle: GameContext['lifecycle'] = {
    get paused() {
      return paused;
    },
    onPause: (cb) => subs.add(life.on('pause', cb)),
    onResume: (cb) => subs.add(life.on('resume', cb)),
    gameOver: (result) => {
      if (ended) return Promise.reject(new Error('gameOver() was already called for this game.'));
      if (typeof result?.score !== 'number' || !Number.isFinite(result.score)) {
        return Promise.reject(new Error('gameOver(): "score" must be a finite number.'));
      }
      ended = true;
      return hooks.onGameOver(result);
    },
    exitToMenu: () => hooks.onExit(),
  };

  const audio: GameContext['audio'] = {
    play: (s) => services.audio.play(s),
    tone: (o) => services.audio.tone(o),
    get muted() {
      return services.audio.muted;
    },
    vibrate: (p) => services.audio.vibrate(p),
  };

  const net = services.net;
  const roomFor = (): Room | null => (inRoom && net.room?.gameId === manifest.id ? net.room : null);

  const system: SystemChannel = {
    send: (message: SystemMessage, options) => {
      if (roomFor()) net.send(message, options?.to);
    },
    onMessage: (cb) =>
      subs.add(
        net.on('relay', (data, from) => {
          if (isSystemMessage(data)) cb(data, from);
        }),
      ),
  };

  let warned = false;
  const multiplayer: MultiplayerApi & { [SYSTEM]: SystemChannel } = {
    get status() {
      return net.status;
    },
    get room() {
      return roomFor();
    },
    get me() {
      return roomFor()?.players.find((p) => p.isMe) ?? null;
    },
    send: (message, options) => {
      if (!message || typeof message.type !== 'string') {
        throw new Error('multiplayer.send(): message must be an object with a "type" string.');
      }
      if (message.type.startsWith('__')) {
        throw new Error('multiplayer.send(): types starting with "__" are reserved.');
      }
      if (!roomFor()) {
        if (!warned) console.warn('[gamebovh] multiplayer.send() ignored: not in a room (solo game).');
        warned = true;
        return;
      }
      net.send(message, options?.to);
    },
    onMessage: (cb) =>
      subs.add(
        net.on('relay', (data, from: Player) => {
          if (disposed || isSystemMessage(data)) return;
          if (!data || typeof (data as { type?: unknown }).type !== 'string') return;
          cb(data as { type: string }, from);
        }),
      ),
    onPlayerJoin: (cb) => subs.add(net.on('join', cb)),
    onPlayerLeave: (cb) => subs.add(net.on('leave', cb)),
    createRoom: () => net.createRoom(manifest.id),
    joinRoom: (code) => net.joinRoom(code, manifest.id),
    leaveRoom: () => net.leaveRoom(),
    [SYSTEM]: system,
  };

  const ctx: GameContext = {
    manifest,
    screen: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
    player: { ...services.player },
    seed,
    input,
    lifecycle,
    audio,
    storage: services.storage,
    multiplayer,
  };

  return {
    ctx,
    get ended() {
      return ended;
    },
    setPaused(next: boolean) {
      if (next === paused || disposed) return;
      paused = next;
      life.emit(next ? 'pause' : 'resume');
    },
    dispose() {
      disposed = true;
      subs.disposeAll();
      life.clear();
    },
  };
}
