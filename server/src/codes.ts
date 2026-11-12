import { randomInt } from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@gamebovh/protocol';

/** Tire un code de salle libre (4 lettres). 24^4 = 331 776 combinaisons. */
export function generateRoomCode(isTaken: (code: string) => boolean, random = randomInt): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ROOM_CODE_ALPHABET[random(ROOM_CODE_ALPHABET.length)];
    }
    if (!isTaken(code)) return code;
  }
  throw new Error('No free room code');
}

/** Identifiant de connexion court et unique pour la durée de vie du serveur. */
let counter = 0;
export function generateConnectionId(): string {
  counter = (counter + 1) % 1_000_000;
  return `p${Date.now().toString(36)}${counter.toString(36)}${randomInt(1296).toString(36)}`;
}
