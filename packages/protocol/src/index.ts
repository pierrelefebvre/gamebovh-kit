/**
 * Protocole WebSocket Gamebovh, partagé entre la console (SDK) et le serveur.
 *
 * Le serveur ne connaît aucun jeu : il gère des salles et relaie des messages
 * opaques (`relay.data`). Toute la logique de jeu vit dans les clients.
 * Référence complète : docs/PROTOCOL.md
 */

export const PROTOCOL_VERSION = 1;

/** Nombre maximum de joueurs par salle. */
export const MAX_PLAYERS = 4;

/** Codes de salle : 4 lettres, sans I ni O (confusion avec 1 et 0). */
export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Taille maximum d'un message WebSocket, en octets. */
export const MAX_MESSAGE_BYTES = 4096;

/** Pseudo : 1 à 12 caractères. */
export const NICKNAME_MAX_LENGTH = 12;

export type Slot = 0 | 1 | 2 | 3;

export interface PlayerInfo {
  /** Identifiant de connexion attribué par le serveur. */
  id: string;
  nickname: string;
  /** Place stable dans la salle (0 à 3). */
  slot: Slot;
  /** Le plus ancien joueur de la salle. */
  isHost: boolean;
}

/* ---------- Client vers serveur ---------- */

export type ClientMessage =
  | { t: 'hello'; v: number; nickname: string }
  | { t: 'create'; gameId: string }
  | { t: 'join'; code: string; gameId: string }
  | { t: 'leave' }
  | { t: 'relay'; data: unknown; to?: string };

/* ---------- Serveur vers client ---------- */

export type ErrorCode =
  | 'bad_request'
  | 'not_ready'
  | 'room_not_found'
  | 'room_full'
  | 'wrong_game'
  | 'too_many_rooms'
  | 'not_in_room'
  | 'rate_limited';

export type ServerMessage =
  | { t: 'welcome'; id: string; v: number }
  /** État complet de la salle, envoyé à l'arrivée dans une salle. */
  | { t: 'room'; code: string; gameId: string; players: PlayerInfo[] }
  /** Un joueur arrive ou part. `players` est la nouvelle liste complète. */
  | { t: 'presence'; event: 'join' | 'leave'; player: PlayerInfo; players: PlayerInfo[] }
  | { t: 'relay'; from: string; data: unknown }
  /** Confirmation de sortie de salle. */
  | { t: 'left' }
  | { t: 'error'; code: ErrorCode; message: string };

/** Normalise un code saisi par un joueur ("kqzt " devient "KQZT"). */
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of code) if (!ROOM_CODE_ALPHABET.includes(ch)) return false;
  return true;
}

/** Nettoie un pseudo : caractères imprimables, espaces réduits, 12 caractères max. */
export function sanitizeNickname(input: string): string {
  return input
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NICKNAME_MAX_LENGTH);
}

/** gameId : identifiant de cartouche, opaque pour le serveur. */
export function isValidGameId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9_-]{1,40}$/.test(id);
}
