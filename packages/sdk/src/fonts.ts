/**
 * Polices propres à un jeu, déposées dans son dossier (jamais chargées depuis Internet).
 *
 *   import maPoliceUrl from './assets/ma-police.woff2';
 *   const TITRE = defineFont('MaPolice', maPoliceUrl);
 *   drawText(g, 'SCORE', 4, 4, { font: TITRE });   // chargée toute seule au premier usage
 *
 * Tant que la police n'est pas chargée, le texte s'affiche avec la police de la console.
 */
/** Police pixel chargée par la console. Taille conseillée : 8px (ou 16px pour les titres). */
export const FONT = '"Press Start 2P", monospace';

export interface GameFont {
  /** Nom choisi par le jeu (pour les messages). */
  readonly family: string;
  /** Adresse du fichier, obtenue par `import url from './assets/police.woff2'`. */
  readonly url: string;
  /** Nom réellement enregistré dans le navigateur : unique par fichier, deux jeux ne peuvent pas se gêner. */
  readonly cssFamily: string;
}

function shortHash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** Déclare une police du jeu. `url` vient d'un import du fichier (.woff2, .woff, .ttf ou .otf). */
export function defineFont(family: string, url: string): GameFont {
  if (!family || typeof url !== 'string' || !url) throw new Error('defineFont(family, url): both are required.');
  if (/^https?:\/\//.test(url) && typeof location !== 'undefined' && !url.startsWith(location.origin)) {
    throw new Error('defineFont: the font file must be inside your game folder, not on the Internet.');
  }
  return { family, url, cssFamily: `gb-${family.replace(/[^a-zA-Z0-9_-]/g, '')}-${shortHash(url)}` };
}

const loads = new Map<string, Promise<void>>();

/** Charge une police (une seule fois). Inutile de l'appeler avant `drawText` : utile pour attendre le chargement. */
export function loadFont(font: GameFont): Promise<void> {
  let p = loads.get(font.cssFamily);
  if (!p) {
    if (typeof FontFace === 'undefined' || typeof document === 'undefined') return Promise.resolve();
    const face = new FontFace(font.cssFamily, `url("${font.url}")`);
    p = face.load().then(
      (loaded) => {
        document.fonts.add(loaded);
      },
      (error) => {
        console.warn(`[gamebovh] font "${font.family}" could not be loaded:`, error);
      },
    );
    loads.set(font.cssFamily, p);
  }
  return p;
}

/** Valeur CSS / canvas `font-family` : la police du jeu, puis celle de la console en secours. */
export function fontFamily(font?: GameFont | null): string {
  if (!font) return FONT;
  void loadFont(font);
  return `"${font.cssFamily}", ${FONT}`;
}
