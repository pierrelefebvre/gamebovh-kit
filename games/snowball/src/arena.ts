/**
 * L'arène : deux camps séparés par une ligne, des murs de neige pour s'abriter.
 * Les murs sont tirés de ctx.seed et placés en miroir : même arène pour tous, et équitable.
 */
import { createRandom, type Slot } from '@gamebovh/sdk';

export const W = 240;
export const H = 216;
export const TOP = 16; // sous la barre de score
export const MID = W / 2;

/** Équipe d'un joueur selon sa place : 0 et 2 = rouges (à gauche), 1 et 3 = bleus (à droite). */
export type Team = 0 | 1;
export const teamOf = (slot: Slot): Team => (slot % 2) as Team;
export const TEAM_NAMES = ['ROUGES', 'BLEUS'] as const;
export const TEAM_COLORS = ['#ff4053', '#2a7cf0'] as const;

export interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function generateWalls(seed: number): Wall[] {
  const rand = createRandom(seed);
  const walls: Wall[] = [];
  // Deux murs par camp, à des hauteurs différentes
  const rows = [TOP + 24 + rand() * 40, TOP + 110 + rand() * 50];
  for (const y of rows) {
    const x = 56 + rand() * 30;
    const wall = { x: Math.round(x), y: Math.round(y), w: 12, h: 26 };
    walls.push(wall);
    walls.push({ ...wall, x: W - wall.x - wall.w }); // miroir pour l'autre camp
  }
  return walls;
}

/** Position de départ selon la place dans la salle. */
export function spawnOf(slot: Slot): { x: number; y: number } {
  const team = teamOf(slot);
  const second = slot >= 2;
  const x = team === 0 ? 24 : W - 24;
  const y = second ? H - 40 : TOP + 50;
  return { x, y };
}

export function hitsWall(x: number, y: number, walls: Wall[], pad = 0): boolean {
  return walls.some((w) => x > w.x - pad && x < w.x + w.w + pad && y > w.y - pad && y < w.y + w.h + pad);
}
