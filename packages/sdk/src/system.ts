/**
 * Canal système interne : messages réservés au SDK et à la console
 * (démarrage de partie, échange de scores...). Les types de ces messages
 * commencent par "__" et ne sont jamais transmis à `onMessage` des jeux.
 * Les étudiants n'ont pas besoin de ce fichier.
 */
import type { Player, Unsubscribe } from './contract.ts';

export const SYSTEM_PREFIX = '__';

export interface SystemMessage {
  type: `__${string}`;
  [key: string]: unknown;
}

export interface SystemChannel {
  send(message: SystemMessage, options?: { to?: string }): void;
  onMessage(cb: (message: SystemMessage, from: Player) => void): Unsubscribe;
}

export const SYSTEM = Symbol.for('gamebovh.system');

export function isSystemMessage(data: unknown): data is SystemMessage {
  return (
    !!data &&
    typeof data === 'object' &&
    typeof (data as { type?: unknown }).type === 'string' &&
    (data as { type: string }).type.startsWith(SYSTEM_PREFIX)
  );
}

/** Récupère le canal système attaché à `ctx.multiplayer`. */
export function systemChannelOf(multiplayer: object): SystemChannel | undefined {
  return (multiplayer as { [SYSTEM]?: SystemChannel })[SYSTEM];
}
