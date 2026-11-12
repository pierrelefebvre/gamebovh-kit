import type { Button, Lang } from '@gamebovh/sdk';

/**
 * Disposition du clavier de l'ordinateur.
 * Les touches sont lues par position physique (`KeyboardEvent.code`) : ZQSD sur AZERTY et WASD
 * sur QWERTY tombent au même endroit et marchent sans réglage. La disposition ne sert qu'à
 * AFFICHER les bonnes lettres sur la coque et dans l'aide.
 */
export type KeyboardLayout = 'azerty' | 'qwerty';

/** Lettre affichée pour chaque bouton de la console, selon la disposition. */
const LETTERS: Record<KeyboardLayout, Record<'up' | 'left' | 'down' | 'right' | 'a' | 'b', string>> = {
  azerty: { up: 'Z', left: 'Q', down: 'S', right: 'D', a: 'X', b: 'W' },
  qwerty: { up: 'W', left: 'A', down: 'S', right: 'D', a: 'X', b: 'Z' },
};

const SPECIAL: Record<Lang, { enter: string; shift: string; esc: string; space: string; arrows: string }> = {
  fr: { enter: 'ENTRÉE', shift: 'MAJ', esc: 'ÉCHAP', space: 'ESPACE', arrows: 'FLÈCHES' },
  en: { enter: 'ENTER', shift: 'SHIFT', esc: 'ESC', space: 'SPACE', arrows: 'ARROWS' },
};

/** Touches à afficher pour la disposition et la langue données. */
export function keyLabels(layout: KeyboardLayout, lang: Lang) {
  const l = LETTERS[layout];
  const s = SPECIAL[lang];
  const dpad = `${l.up}${l.left}${l.down}${l.right}`;
  return {
    dpad,
    arrows: s.arrows,
    a: l.a,
    b: l.b,
    space: s.space,
    start: s.enter,
    select: s.shift,
    pause: s.esc,
    /** Touche principale d'un bouton, pour la coque. */
    of(button: Button): string {
      if (button === 'start') return s.enter;
      if (button === 'select') return s.shift;
      if (button === 'a' || button === 'b') return l[button];
      return dpad;
    },
  };
}

/**
 * Devine la disposition : API Keyboard (Chrome, Edge), sinon à la première touche tapée
 * (touche physique Q qui écrit « a » = AZERTY). Rappelle `onDetect` à chaque découverte.
 */
export function watchKeyboardLayout(onDetect: (layout: KeyboardLayout) => void): () => void {
  const nav = navigator as Navigator & {
    keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> };
  };
  nav.keyboard
    ?.getLayoutMap?.()
    .then((map) => {
      const q = map.get('KeyQ');
      if (q === 'a') onDetect('azerty');
      else if (q === 'q') onDetect('qwerty');
    })
    .catch(() => undefined);

  const onKey = (e: KeyboardEvent) => {
    const key = e.key?.toLowerCase();
    if (!key || key.length !== 1) return;
    const physical: Record<string, [string, string]> = {
      KeyQ: ['a', 'q'],
      KeyW: ['z', 'w'],
      KeyA: ['q', 'a'],
      KeyZ: ['w', 'z'],
    };
    const pair = physical[e.code];
    if (!pair) return;
    if (key === pair[0]) onDetect('azerty');
    else if (key === pair[1]) onDetect('qwerty');
  };
  window.addEventListener('keydown', onKey, { capture: true });
  return () => window.removeEventListener('keydown', onKey, { capture: true });
}
