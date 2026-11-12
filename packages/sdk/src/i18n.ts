import type { Lang, Localized } from './contract.ts';

/**
 * Déclare les textes d'un jeu dans les deux langues.
 * TypeScript vérifie que la version anglaise a exactement les mêmes clés que la française :
 * un texte oublié fait échouer `pnpm check`.
 *
 *   const TEXTS = defineTexts({
 *     fr: { score: 'SCORE', lives: (n: number) => `${n} VIES` },
 *     en: { score: 'SCORE', lives: (n: number) => `${n} LIVES` },
 *   });
 *
 *   // dans le composant :
 *   const t = TEXTS[ctx.lang];
 *   drawText(g, t.lives(3), 4, 4);
 */
export function defineTexts<T extends Record<string, unknown>>(texts: { fr: T; en: NoInfer<T> }): Localized<T> {
  return texts;
}

/** Choisit la langue d'affichage d'après le navigateur : français si demandé, anglais sinon. */
export function detectLang(languages: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]): Lang {
  for (const tag of languages) {
    const base = tag?.toLowerCase().split('-')[0];
    if (base === 'fr' || base === 'en') return base;
  }
  return 'en';
}
