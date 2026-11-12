# Créer un jeu pour GameBOVH

Ce guide explique tout ce qu'il faut savoir pour fabriquer une cartouche (un jeu) pour la console GameBOVH. Pas besoin de connaître le serveur ni le reste de la console : ton jeu reçoit tout ce dont il a besoin dans un seul objet, `ctx`.

> Le contrat complet, avec un commentaire sur chaque ligne, est dans [`src/contract.ts`](src/contract.ts). Ce guide en est la version expliquée.

## Sommaire

1. [Démarrer en 5 minutes](#1-démarrer-en-5-minutes)
2. [Ce qu'est une cartouche](#2-ce-quest-une-cartouche)
3. [L'écran](#3-lécran)
4. [La boucle de jeu](#4-la-boucle-de-jeu)
5. [Les boutons](#5-les-boutons)
6. [Fin de partie et pause](#6-fin-de-partie-et-pause)
7. [Son et vibration](#7-son-et-vibration)
8. [Sauvegarder des données](#8-sauvegarder-des-données)
9. [Le multijoueur](#9-le-multijoueur)
10. [Le classement de proche en proche](#10-le-classement-de-proche-en-proche)
11. [Boîte à outils](#11-boîte-à-outils)
12. [Erreurs fréquentes](#12-erreurs-fréquentes)
13. [Avant de rendre ton jeu](#13-avant-de-rendre-ton-jeu)

---

## 1. Démarrer en 5 minutes

Depuis la racine du projet :

```bash
cp -r games/_template games/mon-jeu
```

Puis :

1. Dans `games/mon-jeu/package.json`, remplace `"@games/template"` par `"@games/mon-jeu"`.
2. Dans `games.json`, ajoute une ligne pour ton jeu :

   ```json
   {
     "id": "mon-jeu",
     "name": "Mon super jeu",
     "team": "Équipe Yéti",
     "version": "1.0.0",
     "description": "Une phrase qui donne envie de jouer.",
     "en": {
       "name": "My great game",
       "description": "One sentence that makes people want to play."
     },
     "minPlayers": 1,
     "maxPlayers": 1,
     "module": "games/mon-jeu/src/index.tsx"
   }
   ```

3. Installe et lance la console avec seulement ton jeu :

   ```bash
   pnpm install
   pnpm dev:game mon-jeu
   ```

4. Ouvre http://localhost:5173, modifie `games/mon-jeu/src/index.tsx` : la page se recharge toute seule.

Règles du catalogue :
- `id` : minuscules, chiffres, `-` ou `_`, et **identique au nom du dossier** ;
- `minPlayers` et `maxPlayers` entre 1 et 4 ;
- `module` vaut toujours `games/<id>/src/index.tsx`.

`pnpm check` vérifie tout ça pour toi.

## 2. Ce qu'est une cartouche

Une cartouche, c'est un **composant React** qui reçoit une seule prop, `ctx`, et qu'on déclare avec `defineGame` :

```tsx
import { defineGame, type GameProps } from '@gamebovh/sdk';

function MonJeu({ ctx }: GameProps) {
  return <div>Bonjour {ctx.player.nickname} !</div>;
}

export default defineGame({
  component: MonJeu,
  scoreOrder: 'desc', // 'desc' : plus grand = meilleur (points). 'asc' : plus petit = meilleur (chrono).
  howToPlay: {
    fr: ['Ligne de règle 1.', 'Ligne de règle 2.', 'Ligne de règle 3.'],
    en: ['Rule line 1.', 'Rule line 2.', 'Rule line 3.'],
  },
});
```

- L'**export par défaut** est obligatoire : c'est ce que la console charge.
- `howToPlay` s'affiche sur la fiche du jeu : 3 lignes courtes, en français et en anglais, compréhensibles en moins de 30 secondes.
- Tout le texte affiché aux joueurs existe **en français et en anglais** (voir plus bas).

Ce que contient `ctx` :

| Champ | À quoi ça sert |
| --- | --- |
| `ctx.screen` | Taille de l'écran : `{ width: 240, height: 216 }` |
| `ctx.player` | Le joueur sur cet appareil : `{ id, nickname }` |
| `ctx.lang` | Langue de la console : `'fr'` ou `'en'` |
| `ctx.input` | Les boutons (section 5) |
| `ctx.lifecycle` | Fin de partie, pause, retour au menu (section 6) |
| `ctx.audio` | Sons et vibration (section 7) |
| `ctx.storage` | Sauvegardes et classement local (section 8) |
| `ctx.multiplayer` | Salle, joueurs, messages (section 9) |
| `ctx.seed` | Nombre aléatoire de la partie, le même pour tous les joueurs d'une salle |
| `ctx.manifest` | Ta ligne de `games.json`, déjà traduite |

Quand on clique sur « Rejouer », la console recrée ton composant : chaque partie repart de zéro, tu n'as rien à réinitialiser.

### Deux langues : français et anglais

La console s'affiche en **français ou en anglais** : elle suit la langue du navigateur, et le joueur peut la changer dans les réglages. Ton jeu reçoit la langue dans `ctx.lang` (`'fr'` ou `'en'`) et doit afficher **chaque texte dans les deux langues**.

Déclare tous tes textes au même endroit avec `defineTexts` :

```tsx
import { defineTexts } from '@gamebovh/sdk';

const TEXTS = defineTexts({
  fr: { go: 'PARTEZ !', lives: (n: number) => `${n} VIES` },
  en: { go: 'GO!', lives: (n: number) => `${n} LIVES` },
});

function MonJeu({ ctx }: GameProps) {
  const t = TEXTS[ctx.lang]; // les textes dans la bonne langue
  // ...
  drawText(g, t.lives(3), 4, 4);
}
```

- Si une clé existe en français mais pas en anglais (ou l'inverse), `pnpm check` échoue : impossible d'oublier une traduction.
- Un texte qui contient un nombre devient une petite fonction, comme `lives` ci-dessus.
- La langue ne change jamais pendant une partie : lire `ctx.lang` au début suffit.
- Le nom et la description de ta ligne de `games.json` ont aussi leur version anglaise, dans `"en"`.


## 3. L'écran

L'écran fait **240 × 216 pixels**, quelle que soit la taille réelle du téléphone ou de l'ordinateur : la console agrandit l'image toute seule. Tu dessines toujours dans ces 240 × 216 pixels.

Deux façons de dessiner :
- **Un canvas** (conseillé pour un jeu d'action), avec `useCanvas`.
- **Du HTML** (des `<div>`), pratique pour un quiz ou un jeu de cartes.

```tsx
const { canvasProps, get2d } = useCanvas(ctx);
// ...
return <canvas {...canvasProps} />;
```

Puis, dans la boucle de jeu :

```ts
const g = get2d();
if (!g) return;
g.fillStyle = PALETTE.night;
g.fillRect(0, 0, ctx.screen.width, ctx.screen.height);
drawText(g, 'SCORE 12', 4, 4, { color: PALETTE.gold });
```

`PALETTE` propose des couleurs d'hiver (`night`, `deep`, `ice`, `snow`, `red`, `gold`, `pine`, `wood`), libre à toi d'en utiliser d'autres. `drawText` écrit avec la police pixel de la console (taille 8 conseillée, 16 pour les gros titres).

## 4. La boucle de jeu

Un jeu d'action se met à jour environ 60 fois par seconde. `useGameLoop` appelle ta fonction à chaque image avec `dt`, le temps écoulé en millisecondes :

```tsx
const etat = useRef({ x: 120, score: 0 });

useGameLoop(ctx, (dt) => {
  const e = etat.current;
  if (ctx.input.isDown('right')) e.x += 0.1 * dt; // 0,1 pixel par milliseconde
  dessiner();
});
```

Trois règles :
- **Multiplie toujours les vitesses par `dt`** : ton jeu ira à la même vitesse sur un vieux téléphone et sur un ordinateur rapide.
- **Range l'état du jeu dans un `useRef`**, pas dans un `useState` : il change 60 fois par seconde, React n'a pas besoin de redessiner la page à chaque fois.
- La boucle **s'arrête toute seule en pause**. En multijoueur temps réel, tu peux la laisser tourner : `useGameLoop(ctx, maj, { runWhilePaused: true })`.

## 5. Les boutons

Huit boutons : `'up'`, `'down'`, `'left'`, `'right'`, `'a'`, `'b'`, `'start'`, `'select'`.

Deux façons de les lire :

```ts
// 1. Bouton maintenu : à lire dans la boucle de jeu (pour se déplacer)
if (ctx.input.isDown('left')) x -= vitesse * dt;

// 2. Appui ponctuel : une seule fois par appui (pour sauter, tirer, valider)
useButton(ctx, 'a', {
  onPress: () => sauter(),
  onRelease: () => {}, // facultatif
});
```

`useButton(ctx, '*', ...)` réagit à n'importe quel bouton.

Les joueurs ont plusieurs façons d'appuyer, ton jeu ne voit pas la différence :

| Bouton | Tactile | Clavier | Manette |
| --- | --- | --- | --- |
| Croix | croix de la console (glisser le doigt marche) | flèches, ou ZQSD en AZERTY / WASD en QWERTY | croix ou stick |
| A | bouton A | X, K ou Espace | bouton du bas |
| B | bouton B | W en AZERTY / Z en QWERTY, J ou C | bouton de droite |
| Start | START | Entrée | Start |
| Select | SELECT | Maj ou Retour arrière | Select |

La console lit les touches **par leur position** sur le clavier : ZQSD sur un clavier AZERTY et WASD sur un clavier QWERTY donnent la même chose, sans réglage. Elle devine la disposition et affiche les bonnes lettres sous les boutons quand on joue à la souris et au clavier (réglable dans RÉGLAGES > Clavier). Dans tes textes d'aide, parle des boutons de la console (« A », « la croix »), pas des touches du clavier.

Start + Select maintenus 1 seconde (ou Échap) ouvrent le menu pause de la console : ne compte pas sur ce raccourci dans ton jeu.

## 6. Fin de partie et pause

### Fin de partie

Quand la partie est finie, appelle **une seule fois** :

```ts
ctx.lifecycle.gameOver({
  score: 1234,              // obligatoire : un nombre
  display: '01:23.45',      // facultatif : texte affiché à la place du nombre
  outcome: 'win',           // facultatif, en multijoueur : 'win', 'lose' ou 'draw'
});
```

La console enregistre le score dans le classement local du jeu, puis affiche l'écran de résultats (Rejouer, Menu). Ton jeu reste affiché derrière, en pause.

Le sens du classement vient de `scoreOrder` : `'desc'` pour des points, `'asc'` pour un chrono (le score est alors un temps en millisecondes, et `formatTime(ms)` l'affiche joliment).

### Pause

La console met ton jeu en pause quand l'onglet passe en arrière-plan, quand le joueur ouvre le menu pause et pendant l'écran de résultats. Pendant la pause, `useGameLoop` s'arrête et les boutons ne sont plus transmis. Tu peux réagir si besoin :

```ts
const enPause = usePaused(ctx);            // true / false, pour l'affichage
ctx.lifecycle.onPause(() => couperMusique());
ctx.lifecycle.onResume(() => relancerMusique());
```

`ctx.lifecycle.exitToMenu()` ramène directement au menu des cartouches.

## 7. Son et vibration

Le son est **coupé par défaut** (le joueur l'active sur la console). Tu appelles les sons normalement, la console s'occupe du reste.

```ts
ctx.audio.play('coin');
```

Sons disponibles : `blip`, `select`, `confirm`, `back`, `jump`, `hit`, `coin`, `whoosh`, `throw`, `splat`, `countdown`, `go`, `win`, `lose`.

Pour un son à toi :

```ts
ctx.audio.tone({ frequency: 440, durationMs: 120, wave: 'square', volume: 0.3, slideTo: 880 });
```

Vibration du téléphone (en millisecondes, ignorée là où ce n'est pas possible, par exemple sur iPhone) :

```ts
ctx.audio.vibrate(80);
ctx.audio.vibrate([60, 40, 60]); // vibre, pause, vibre
```

## 8. Sauvegarder des données

Tout est enregistré **dans le navigateur du joueur**, rangé à part pour chaque jeu. Toutes les fonctions sont asynchrones (`await` ou `.then`).

```ts
await ctx.storage.set('niveau', 3);
const niveau = (await ctx.storage.get<number>('niveau')) ?? 1;
await ctx.storage.remove('niveau');

const top10 = await ctx.storage.getLeaderboard(10); // classement du jeu, trié
const record = await ctx.storage.getPersonalBest(); // meilleur score de ce joueur
```

Tu n'as pas besoin d'enregistrer le score toi-même : `gameOver` s'en charge.

## 9. Le multijoueur

### Comment ça marche

La console gère tout l'écran de salle : créer une salle, afficher le code (4 lettres), attendre les joueurs. Quand l'hôte appuie sur A, ton jeu démarre en même temps chez tout le monde, avec le même `ctx.seed`.

Dans `games.json`, `maxPlayers` supérieur à 1 rend ton jeu jouable en salle. Avec `minPlayers: 1`, on peut aussi y jouer en solo : dans ce cas `ctx.multiplayer.room` vaut `null`.

```ts
ctx.multiplayer.room;     // { code, gameId, players } ou null en solo
ctx.multiplayer.me;       // moi dans la salle
const joueurs = useRoomPlayers(ctx); // liste à jour des joueurs
```

Chaque joueur a :
- `id` : identifiant de connexion ;
- `nickname` : son pseudo ;
- `slot` : sa place de 0 à 3, stable pendant toute la partie. Sers-t'en pour la couleur (`PLAYER_COLORS[slot]`), l'équipe ou la position de départ ;
- `isHost` : le plus ancien de la salle. Utile si un joueur doit décider pour tous ;
- `isMe` : c'est toi.

### Envoyer et recevoir des messages

Le serveur ne connaît pas ton jeu : il transmet tes messages aux autres joueurs de la salle. Décris d'abord tes messages avec un type TypeScript, chacun avec un champ `type` :

```ts
type MonMsg =
  | { type: 'pos'; x: number; y: number }
  | { type: 'tir'; angle: number };

function MonJeu({ ctx }: GameProps<MonMsg>) {
  // Envoyer à tous les autres joueurs
  ctx.multiplayer.send({ type: 'pos', x: 10, y: 20 });

  // Ou à un seul joueur
  ctx.multiplayer.send({ type: 'tir', angle: 45 }, { to: joueur.id });

  // Recevoir
  useMessages(ctx, (msg, de) => {
    if (msg.type === 'pos') bougerFantome(de.id, msg.x, msg.y);
  });
  // ...
}

export default defineGame<MonMsg>({ component: MonJeu, scoreOrder: 'desc' });
```

Tu ne reçois jamais tes propres messages.

Bonnes pratiques :
- **Envoie ta position 10 à 15 fois par seconde**, pas à chaque image, et fais glisser les autres joueurs vers leur dernière position connue (voir le Slalom).
- Envoie aussi les **événements ponctuels** (un tir, une touche, une arrivée) au moment où ils se produisent.
- Utilise `ctx.seed` et `createRandom` pour que **tout le monde ait le même niveau** sans rien envoyer.
- Prévois le **départ d'un joueur** en cours de partie : `ctx.multiplayer.onPlayerLeave(cb)`, ou `useRoomPlayers`.

Limites : 4 Ko par message, environ 60 messages par seconde et par joueur, 4 joueurs par salle. Les types qui commencent par `__` sont réservés à la console.

## 10. Le classement de proche en proche

Il n'y a pas de serveur de scores. Pour qu'un classement circule entre les joueurs, ajoute ceci à ton jeu multijoueur :

```ts
const { share } = useScoreGossip(ctx);

// à la fin de la partie
void ctx.lifecycle.gameOver({ score }).then(() => share());
```

Chaque joueur envoie alors son meilleur classement local aux autres, et fusionne ce qu'il reçoit dans le sien. Chacun ne voit que les scores des joueurs qu'il a croisés (directement ou de proche en proche), et la triche est possible : c'est accepté pour la soirée.

## 11. Boîte à outils

| Outil | Rôle |
| --- | --- |
| `useGameLoop(ctx, maj, options?)` | Boucle de jeu, `maj(dt)` à chaque image |
| `useButton(ctx, bouton, { onPress, onRelease })` | Appui et relâchement d'un bouton |
| `useCanvas(ctx)` | `{ canvasProps, get2d, canvasRef }` pour un canvas 240 × 216 |
| `usePaused(ctx)` | `true` pendant la pause |
| `useRoomPlayers(ctx)` | Joueurs de la salle, toujours à jour |
| `useMessages(ctx, (msg, de) => ...)` | Réception des messages |
| `useScoreGossip(ctx)` | `{ share, received }` pour le classement de proche en proche |
| `drawText(g, texte, x, y, options?)` | Texte en police pixel : `color`, `size`, `align`, `shadow` |
| `formatTime(ms)` | 83456 devient `"01:23.45"` |
| `createRandom(graine)` | Hasard reproductible : même graine, mêmes nombres |
| `PALETTE`, `PLAYER_COLORS`, `FONT` | Couleurs et police de la console |
| `SCREEN_WIDTH`, `SCREEN_HEIGHT` | 240 et 216 |

Tous les hooks se désabonnent tout seuls quand ton composant disparaît.

Exemples complets à lire :
- [`games/_template`](../../games/_template) : le plus petit jeu possible, très commenté ;
- [`games/slalom`](../../games/slalom) : course 1 à 4 joueurs, positions en direct, chrono ;
- [`games/snowball`](../../games/snowball) : équipes, événements réseau, robot pour le solo.

## 12. Erreurs fréquentes

| Symptôme | Cause probable |
| --- | --- |
| Ton jeu n'apparaît pas, « erreur(s) de catalogue » dans le menu | `id`, nom du dossier et `module` de `games.json` ne correspondent pas |
| Le jeu va plus vite sur ordinateur | une vitesse n'est pas multipliée par `dt` |
| Le jeu rame | état du jeu dans `useState` au lieu de `useRef` |
| Un appui compte plusieurs fois | `isDown` utilisé pour une action ponctuelle : prends `useButton` |
| « gameOver() was already called » | `gameOver` appelé à chaque image : garde un drapeau `fini` |
| « ERREUR DE CARTOUCHE » à l'écran | ton composant a planté : le détail est dans la console du navigateur (F12) |
| Les autres ne reçoivent rien | tu joues en solo (`room` vaut `null`), ou le message n'a pas de champ `type` |

## 13. Avant de rendre ton jeu

- [ ] `pnpm check` passe sans erreur.
- [ ] Une partie dure entre 2 et 5 minutes, et les règles se comprennent en moins de 30 secondes.
- [ ] Tout le texte affiché existe en français **et** en anglais (essaie les deux dans RÉGLAGES > Langue).
- [ ] Le jeu se joue au doigt sur téléphone et tablette, **et** au clavier sur ordinateur.
- [ ] `gameOver` est appelé une seule fois, avec le bon `scoreOrder`.
- [ ] En multijoueur : testé à deux appareils au moins, et le départ d'un joueur ne bloque pas la partie.
- [ ] `README.md` du jeu à jour : règles et noms de l'équipe.
