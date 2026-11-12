/** Petits utilitaires d'affichage partagés. */

/** Police pixel chargée par la console. Taille conseillée : 8px (ou 16px pour les titres). */
export const FONT = '"Press Start 2P", monospace';

/** 83456 ms devient "01:23.45". */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 10));
  const cs = total % 100;
  const s = Math.floor(total / 100) % 60;
  const m = Math.floor(total / 6000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** Écrit du texte pixel sur un canvas. `align` : 'left' | 'center' | 'right'. */
export function drawText(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: { color?: string; size?: number; align?: CanvasTextAlign; shadow?: string } = {},
): void {
  const size = options.size ?? 8;
  g.font = `${size}px ${FONT}`;
  g.textAlign = options.align ?? 'left';
  g.textBaseline = 'top';
  if (options.shadow) {
    g.fillStyle = options.shadow;
    g.fillText(text, Math.round(x) + 1, Math.round(y) + 1);
  }
  g.fillStyle = options.color ?? '#eef6ff';
  g.fillText(text, Math.round(x), Math.round(y));
}

/**
 * Générateur pseudo-aléatoire à graine (mulberry32).
 * Même graine = même suite de nombres sur tous les appareils.
 *   const rand = createRandom(ctx.seed); rand() // entre 0 et 1
 */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
