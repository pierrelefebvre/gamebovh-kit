/**
 * Génération de la piste à partir de la graine de la partie.
 * Même graine = même piste chez tous les joueurs de la salle,
 * sans avoir besoin de l'envoyer par le réseau.
 */
import { createRandom } from '@gamebovh/sdk';

export const SCREEN_W = 240;

export const GATE_COUNT = 24;
export const GATE_WIDTH = 46; // écart entre les deux piquets
const FIRST_GATE_Y = 260;
const MIN_SPACING = 140;
const MAX_SPACING = 175;

export interface Gate {
  y: number;
  /** Centre de la porte. */
  x: number;
  color: 'red' | 'blue';
}

export interface Tree {
  x: number;
  y: number;
  size: number;
}

export interface Course {
  gates: Gate[];
  trees: Tree[];
  finishY: number;
}

export function generateCourse(seed: number): Course {
  const rand = createRandom(seed);
  const gates: Gate[] = [];
  let y = FIRST_GATE_Y;
  let x = SCREEN_W / 2;

  for (let i = 0; i < GATE_COUNT; i++) {
    // On décale la porte suivante de façon jouable (jamais plus de 75 px).
    const shift = (rand() * 2 - 1) * 75;
    x = Math.max(50, Math.min(SCREEN_W - 50, x + shift));
    gates.push({ y, x: Math.round(x), color: i % 2 === 0 ? 'red' : 'blue' });
    y += MIN_SPACING + rand() * (MAX_SPACING - MIN_SPACING);
  }
  const finishY = y + 60;

  const trees: Tree[] = [];
  // Forêt sur les bords.
  for (let ty = 0; ty < finishY + 300; ty += 18 + rand() * 18) {
    trees.push({ x: 4 + rand() * 12, y: ty, size: 8 + Math.floor(rand() * 5) });
    trees.push({ x: SCREEN_W - 4 - rand() * 12, y: ty + rand() * 10, size: 8 + Math.floor(rand() * 5) });
  }
  // Quelques sapins isolés, loin de la trajectoire entre deux portes.
  for (let i = 0; i < gates.length - 1; i++) {
    const a = gates[i];
    const b = gates[i + 1];
    if (rand() < 0.45) continue;
    const ty = (a.y + b.y) / 2;
    const pathX = (a.x + b.x) / 2;
    const side = pathX > SCREEN_W / 2 ? -1 : 1;
    const tx = pathX + side * (55 + rand() * 30);
    if (tx > 28 && tx < SCREEN_W - 28) trees.push({ x: Math.round(tx), y: Math.round(ty), size: 10 });
  }

  return { gates, trees, finishY };
}
