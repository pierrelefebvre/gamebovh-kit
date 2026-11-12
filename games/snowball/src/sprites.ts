/** Dessins en rectangles : enfant en bonnet, boules de neige, murs, flocons d'impact. */
import { PALETTE } from '@gamebovh/sdk';
import type { Wall } from './arena.ts';

const SKIN = '#f3c9a1';
const DARK = '#1b2250';

/**
 * Un joueur vu de face, pieds en (x, y).
 * `dir` : 1 regarde à droite, -1 à gauche. `crouch` : accroupi derrière son abri.
 */
export function drawKid(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  dir: 1 | -1,
  crouch: boolean,
  alpha = 1,
) {
  const px = Math.round(x);
  const py = Math.round(y);
  g.globalAlpha = alpha;
  // Ombre
  g.fillStyle = 'rgba(27, 34, 80, 0.18)';
  g.fillRect(px - 6, py - 1, 12, 2);

  const h = crouch ? 8 : 14;
  // Jambes
  if (!crouch) {
    g.fillStyle = DARK;
    g.fillRect(px - 4, py - 4, 3, 4);
    g.fillRect(px + 1, py - 4, 3, 4);
  }
  // Manteau
  g.fillStyle = color;
  g.fillRect(px - 5, py - h, 10, crouch ? 7 : 8);
  // Bras qui lance
  g.fillRect(px + (dir === 1 ? 5 : -7), py - h + 2, 2, 4);
  // Tête et bonnet
  g.fillStyle = SKIN;
  g.fillRect(px - 3, py - h - 5, 6, 5);
  g.fillStyle = color;
  g.fillRect(px - 4, py - h - 7, 8, 3);
  g.fillStyle = PALETTE.snow;
  g.fillRect(px - 1, py - h - 9, 2, 2);
  // Yeux du côté où il regarde
  g.fillStyle = DARK;
  g.fillRect(px + (dir === 1 ? 1 : -2), py - h - 3, 1, 1);
  g.globalAlpha = 1;
}

export function drawBall(g: CanvasRenderingContext2D, x: number, y: number) {
  const px = Math.round(x);
  const py = Math.round(y);
  g.fillStyle = 'rgba(27, 34, 80, 0.15)';
  g.fillRect(px - 2, py + 6, 4, 1);
  g.fillStyle = '#ffffff';
  g.fillRect(px - 2, py - 1, 4, 3);
  g.fillRect(px - 1, py - 2, 2, 5);
  g.fillStyle = '#b8cdee';
  g.fillRect(px, py + 1, 2, 1);
}

export function drawWall(g: CanvasRenderingContext2D, w: Wall) {
  g.fillStyle = '#b8cdee';
  g.fillRect(w.x, w.y + 3, w.w, w.h - 3);
  g.fillStyle = '#ffffff';
  g.fillRect(w.x, w.y, w.w, w.h - 5);
  // Blocs de neige
  g.fillStyle = '#d7e3f7';
  for (let row = 0; row < w.h - 6; row += 6) g.fillRect(w.x, w.y + row + 5, w.w, 1);
}

export interface Puff {
  x: number;
  y: number;
  life: number;
}

export function drawPuff(g: CanvasRenderingContext2D, p: Puff) {
  const r = Math.round((1 - p.life / 300) * 5) + 1;
  g.fillStyle = '#ffffff';
  g.globalAlpha = Math.max(0, p.life / 300);
  g.fillRect(Math.round(p.x) - r, Math.round(p.y), 2, 2);
  g.fillRect(Math.round(p.x) + r - 1, Math.round(p.y) - 1, 2, 2);
  g.fillRect(Math.round(p.x), Math.round(p.y) - r, 2, 2);
  g.fillRect(Math.round(p.x) - 1, Math.round(p.y) + r - 1, 2, 2);
  g.globalAlpha = 1;
}
