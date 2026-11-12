/**
 * Dessins en pixels, à base de rectangles : pas d'image à charger.
 * Toutes les coordonnées sont à l'écran (déjà décalées par la caméra).
 */
import { PALETTE } from '@gamebovh/sdk';

export type Pose = 'straight' | 'left' | 'right' | 'tuck' | 'crash';

const SKI = '#2a2d33';
const SKIN = '#f3c9a1';

/** Un skieur vu de dessus, centré sur (x, y). */
export function drawSkier(g: CanvasRenderingContext2D, x: number, y: number, pose: Pose, color: string, alpha = 1) {
  const px = Math.round(x);
  const py = Math.round(y);
  g.globalAlpha = alpha;

  if (pose === 'crash') {
    // Skis en croix dans la neige
    g.fillStyle = SKI;
    g.fillRect(px - 7, py - 1, 14, 2);
    g.fillRect(px - 1, py - 7, 2, 14);
    g.fillStyle = color;
    g.fillRect(px - 3, py - 3, 6, 6);
    g.fillStyle = SKIN;
    g.fillRect(px + 3, py - 5, 3, 3);
    g.globalAlpha = 1;
    return;
  }

  // Skis : légèrement en biais quand on tourne
  const tilt = pose === 'left' ? -2 : pose === 'right' ? 2 : 0;
  g.fillStyle = SKI;
  g.fillRect(px - 4 + tilt, py - 6, 2, 13);
  g.fillRect(px + 2 + tilt, py - 6, 2, 13);

  // Corps (couleur du joueur), plus ramassé en position de recherche de vitesse
  const h = pose === 'tuck' ? 5 : 7;
  g.fillStyle = color;
  g.fillRect(px - 3, py - h + 2, 6, h);

  // Tête et bonnet
  g.fillStyle = SKIN;
  g.fillRect(px - 2, py - h - 1, 4, 3);
  g.fillStyle = PALETTE.snow;
  g.fillRect(px - 1, py - h - 3, 2, 2);

  // Bâtons
  if (pose !== 'tuck') {
    g.fillStyle = SKI;
    g.fillRect(px - 6, py - 2, 1, 6);
    g.fillRect(px + 5, py - 2, 1, 6);
  }
  g.globalAlpha = 1;
}

/** Un sapin enneigé, la base du tronc en (x, y). */
export function drawTree(g: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const px = Math.round(x);
  const py = Math.round(y);
  g.fillStyle = PALETTE.wood;
  g.fillRect(px - 1, py - 3, 3, 3);
  g.fillStyle = PALETTE.pine;
  for (let i = 0; i < 3; i++) {
    const w = size - i * 3;
    const top = py - 3 - (i + 1) * Math.round(size / 3);
    g.fillRect(px - Math.round(w / 2), top, w, Math.round(size / 3) + 1);
  }
  g.fillStyle = PALETTE.snow;
  g.fillRect(px - 1, py - 3 - size - 1, 3, 2);
}

/** Un piquet avec son fanion. */
export function drawFlag(g: CanvasRenderingContext2D, x: number, y: number, color: string, side: 'left' | 'right') {
  const px = Math.round(x);
  const py = Math.round(y);
  g.fillStyle = SKI;
  g.fillRect(px, py - 10, 1, 11);
  g.fillStyle = color;
  if (side === 'left') g.fillRect(px - 5, py - 10, 5, 4);
  else g.fillRect(px + 1, py - 10, 5, 4);
}

/** Petite flèche en haut ou en bas de l'écran pour un joueur hors champ. */
export function drawOffscreenMarker(g: CanvasRenderingContext2D, x: number, top: boolean, color: string, height: number) {
  const px = Math.round(Math.max(6, Math.min(234, x)));
  g.fillStyle = color;
  if (top) {
    g.fillRect(px - 1, 14, 3, 2);
    g.fillRect(px - 2, 16, 5, 2);
  } else {
    g.fillRect(px - 2, height - 6, 5, 2);
    g.fillRect(px - 1, height - 4, 3, 2);
  }
}
