/**
 * @gamebovh/sdk : tout ce dont une cartouche a besoin.
 *
 *   import { defineGame, useGameLoop, type GameProps } from '@gamebovh/sdk';
 */
export * from './contract.ts';
export { defineGame } from './defineGame.ts';
export {
  useButton,
  useCanvas,
  useGameLoop,
  useMessages,
  usePaused,
  useRoomPlayers,
  useScoreGossip,
} from './hooks/index.ts';
export { createRandom, drawText, FONT, formatTime } from './draw.ts';
