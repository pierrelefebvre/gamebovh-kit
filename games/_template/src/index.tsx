/**
 * CARTOUCHE MODÈLE : "Attrape-Flocons"
 *
 * Le plus petit jeu complet possible, à copier pour démarrer :
 *   1. copier ce dossier : games/_template  ->  games/mon-jeu
 *   2. changer "name" dans package.json  (@games/mon-jeu)
 *   3. ajouter une ligne dans games.json (id "mon-jeu", module "games/mon-jeu/src/index.tsx")
 *   4. pnpm install, puis : pnpm dev:game mon-jeu
 *
 * Règle du jeu : déplace le bonnet avec la croix, attrape les flocons.
 * 3 flocons ratés = fin de partie.
 *
 * Langues : la console est en français OU en anglais (`ctx.lang`).
 * Chaque texte affiché est déclaré dans les deux langues avec `defineTexts`.
 */
import { useRef } from 'react';
import {
  defineGame,
  defineTexts,
  drawText,
  PALETTE,
  useButton,
  useCanvas,
  useGameLoop,
  type GameProps,
} from '@gamebovh/sdk';

/* Toutes les positions sont en pixels de l'écran logique (240 x 216). */
const PLAYER_WIDTH = 24;
const PLAYER_Y = 190;
const PLAYER_SPEED = 0.12; // pixels par milliseconde
const LIVES = 3;

/*
 * Tous les textes du jeu, en français et en anglais.
 * Si une clé manque d'un côté, `pnpm check` le signale.
 * Un texte qui contient un nombre devient une petite fonction.
 */
const TEXTS = defineTexts({
  fr: {
    score: (n: number) => `SCORE ${n}`,
    lives: (n: number) => `VIES ${n}`,
  },
  en: {
    score: (n: number) => `SCORE ${n}`,
    lives: (n: number) => `LIVES ${n}`,
  },
});

interface Flake {
  x: number;
  y: number;
  speed: number;
}

/**
 * Le composant du jeu. Il reçoit `ctx` : tout ce que la console lui offre
 * (entrées, son, stockage, multijoueur, fin de partie...).
 */
function CatchTheFlakes({ ctx }: GameProps) {
  const { width, height } = ctx.screen;
  const { canvasProps, get2d } = useCanvas(ctx);
  // Les textes dans la langue choisie sur la console ('fr' ou 'en').
  const t = TEXTS[ctx.lang];

  // L'état du jeu vit dans un useRef : il change 60 fois par seconde,
  // pas besoin de faire re-rendre React à chaque image.
  const state = useRef({
    x: width / 2,
    flakes: [] as Flake[],
    spawnIn: 0,
    score: 0,
    lives: LIVES,
    over: false,
  });

  // Le bouton A fait un petit son (exemple d'appui ponctuel).
  useButton(ctx, 'a', { onPress: () => ctx.audio.play('blip') });

  // La boucle de jeu : appelée à chaque image, `dt` = millisecondes écoulées.
  // Elle s'arrête toute seule quand la console est en pause.
  useGameLoop(ctx, (dt) => {
    const s = state.current;
    if (s.over) return;

    // 1. Lire les entrées (bouton maintenu = isDown).
    if (ctx.input.isDown('left')) s.x -= PLAYER_SPEED * dt;
    if (ctx.input.isDown('right')) s.x += PLAYER_SPEED * dt;
    s.x = Math.max(PLAYER_WIDTH / 2, Math.min(width - PLAYER_WIDTH / 2, s.x));

    // 2. Mettre à jour le monde.
    s.spawnIn -= dt;
    if (s.spawnIn <= 0) {
      s.flakes.push({ x: 8 + Math.random() * (width - 16), y: -4, speed: 0.04 + s.score * 0.002 });
      s.spawnIn = Math.max(300, 900 - s.score * 20);
    }
    for (const f of s.flakes) f.y += f.speed * dt;

    const caught = s.flakes.filter((f) => f.y > PLAYER_Y - 6 && f.y < PLAYER_Y + 6 && Math.abs(f.x - s.x) < PLAYER_WIDTH / 2 + 2);
    const missed = s.flakes.filter((f) => f.y > height);
    s.flakes = s.flakes.filter((f) => !caught.includes(f) && !missed.includes(f));
    if (caught.length) {
      s.score += caught.length;
      ctx.audio.play('coin');
    }
    if (missed.length) {
      s.lives -= missed.length;
      ctx.audio.play('hit');
      ctx.audio.vibrate(60);
    }

    // 3. Fin de partie : on le signale à la console, qui enregistre le score.
    if (s.lives <= 0) {
      s.over = true;
      ctx.audio.play('lose');
      void ctx.lifecycle.gameOver({ score: s.score });
    }

    // 4. Dessiner.
    const g = get2d();
    if (!g) return;
    g.fillStyle = PALETTE.night;
    g.fillRect(0, 0, width, height);

    g.fillStyle = PALETTE.snow;
    for (const f of s.flakes) g.fillRect(Math.round(f.x) - 2, Math.round(f.y) - 2, 4, 4);

    // Le bonnet (rouge, pompon blanc)
    const px = Math.round(s.x - PLAYER_WIDTH / 2);
    g.fillStyle = PALETTE.red;
    g.fillRect(px, PLAYER_Y - 4, PLAYER_WIDTH, 8);
    g.fillStyle = PALETTE.snow;
    g.fillRect(px, PLAYER_Y + 2, PLAYER_WIDTH, 3);
    g.fillRect(px + PLAYER_WIDTH / 2 - 2, PLAYER_Y - 8, 4, 4);

    // Le sol enneigé
    g.fillStyle = PALETTE.ice;
    g.fillRect(0, height - 12, width, 12);

    drawText(g, t.score(s.score), 6, 6);
    drawText(g, t.lives(Math.max(0, s.lives)), width - 6, 6, { color: PALETTE.red, align: 'right' });
  });

  return <canvas {...canvasProps} />;
}

/* Export par défaut obligatoire : c'est ce que la console charge. */
export default defineGame({
  component: CatchTheFlakes,
  // Plus de flocons = mieux : le plus grand score gagne.
  scoreOrder: 'desc',
  // Règles affichées par la console avant la partie : 3 lignes max, dans les deux langues.
  howToPlay: {
    fr: ['Déplace-toi avec la croix.', 'Attrape les flocons.', "3 flocons ratés et c'est fini !"],
    en: ['Move with the d-pad.', 'Catch the snowflakes.', 'Miss 3 and it is game over!'],
  },
});
