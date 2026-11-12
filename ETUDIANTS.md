# Guide des équipes : créer un jeu pour GameBOVH

Ce document est **la règle du jeu technique** du challenge. Lisez-le en entier avant d'écrire une ligne de code, et gardez-le ouvert pendant les séances.

- Les consignes du challenge (sujet, calendrier, évaluation) sont dans [`CONSIGNES.md`](CONSIGNES.md).
- La référence détaillée de tout ce que votre jeu peut utiliser est dans [`packages/sdk/README.md`](packages/sdk/README.md).

## Sommaire

1. [Ce que vous allez faire](#1-ce-que-vous-allez-faire)
2. [Installer le projet](#2-installer-le-projet)
3. [Comment fonctionne GameBOVH](#3-comment-fonctionne-gamebovh)
4. [Créer votre jeu, pas à pas](#4-créer-votre-jeu-pas-à-pas)
5. [Le contrat entre votre jeu et la console](#5-le-contrat-entre-votre-jeu-et-la-console)
6. [Le multijoueur](#6-le-multijoueur)
7. [Ce que vous pouvez modifier](#7-ce-que-vous-pouvez-modifier)
8. [Ce que vous ne devez pas modifier](#8-ce-que-vous-ne-devez-pas-modifier)
9. [Règles de code](#9-règles-de-code)
10. [Images, sons et polices](#10-images-sons-et-polices)
11. [Travailler en équipe avec Git](#11-travailler-en-équipe-avec-git)
12. [Rendre votre jeu](#12-rendre-votre-jeu)
13. [Questions fréquentes](#13-questions-fréquentes)

---

## 1. Ce que vous allez faire

GameBOVH est une console de jeux façon console portable rétro, qui tourne dans le navigateur des téléphones et des ordinateurs. Elle sera utilisée par les collaborateurs d'OVHcloud pendant leur Annual Party.

**La console est déjà faite.** Vous fabriquez **une cartouche** : un jeu qui se branche dans la console. Vous ne touchez ni à la console, ni au serveur, ni au framework.

Votre jeu, c'est :
- **un dossier** `games/<votre-jeu>/` qui contient tout votre code, vos images et vos sons ;
- **une ligne** dans le fichier `games.json`, qui annonce votre jeu à la console.

C'est tout. Si vous vous retrouvez à modifier un autre fichier, c'est qu'il y a un problème : demandez à l'équipe pédagogique.

## 2. Installer le projet

### Prérequis

- **Node.js 22 ou plus récent** : vérifiez avec `node -v`.
- **pnpm** : activez-le une fois avec `corepack enable`, puis vérifiez avec `pnpm -v`. Si `corepack enable` refuse (droits administrateur), installez-le avec `npm install -g pnpm`.
- **Git** et un compte **GitHub** pour chaque membre de l'équipe.
- Un éditeur de code, par exemple VS Code.

### Récupérer le projet

Un seul membre de l'équipe crée le dépôt de l'équipe :

1. Connectez-vous à GitHub, puis ouvrez **https://github.com/pierrelefebvre/gamebovh-kit/generate**.
   C'est la page de création d'un dépôt à partir du kit. Depuis la page du kit, on y arrive aussi avec le bouton vert **Use this template** puis **Create a new repository** : ce bouton n'apparaît que si vous êtes connecté.
2. Choisissez votre compte comme propriétaire, nommez le dépôt (par exemple `gamebovh-equipe-yeti`), cochez **Private**, puis cliquez sur **Create repository**.
3. Dans votre nouveau dépôt, **Settings > Collaborators > Add people** : ajoutez les autres membres de l'équipe **et le compte de l'équipe pédagogique, `pierrelefebvre`**. Chaque invité doit accepter l'invitation reçue par email.

Ensuite, chaque membre, sur son ordinateur :

```bash
git clone <adresse-de-votre-dépôt>
cd <nom-du-dépôt>
pnpm install
pnpm dev:game _template
```

Ouvrez http://localhost:5173 : la console démarre avec la cartouche modèle. Si ça marche, votre installation est bonne.

**`git clone` demande un mot de passe et le refuse ?** GitHub n'accepte plus les mots de passe pour Git. Le plus simple : installez l'outil GitHub (`gh`), lancez `gh auth login` et suivez les étapes, puis recommencez le `git clone`. Autre solution : clonez avec GitHub Desktop.

## 3. Comment fonctionne GameBOVH

```
        Navigateur du joueur (téléphone ou ordinateur)
 ┌──────────────────────────────────────────────────────────┐
 │  CONSOLE  (apps/console)                                 │
 │   coque, boutons, menus, salles, pause, résultats        │
 │                                                          │
 │      ┌──────────────────────────────────────────┐        │
 │      │  VOTRE JEU  (games/<votre-jeu>)          │        │
 │      │  un composant React qui reçoit `ctx`     │        │
 │      └──────────────────────────────────────────┘        │
 │                     ▲                                    │
 │      FRAMEWORK (packages/sdk) : ctx, hooks, outils       │
 └─────────────────────┼────────────────────────────────────┘
                       │ WebSocket (seulement en multijoueur)
               ┌───────┴────────────────────────────┐
               │  SERVEUR DE JEU (server)           │
               │  salles de 4, relaie les messages  │
               │  sans rien connaître des jeux      │
               └────────────────────────────────────┘
```

### Qui fait quoi

| La console s'occupe de | Votre jeu s'occupe de |
| --- | --- |
| La coque, les boutons tactiles, le clavier, la manette | Lire les boutons qu'on lui transmet |
| Le menu des cartouches et la fiche de votre jeu | Son propre écran de 240 × 216 pixels |
| La création des salles, les codes, la liste des joueurs | Les règles du jeu et ce qui s'affiche |
| Le lancement de la partie, avec la même graine pour tous | Les messages entre joueurs pendant la partie |
| La pause, l'écran de résultats, l'enregistrement du score | Annoncer la fin de partie avec le score |
| Le son (coupé par défaut) et la vibration | Choisir quand jouer un son |

### La vie d'une cartouche

1. Le joueur choisit votre jeu dans le menu. La console charge votre code (et seulement à ce moment-là).
2. La fiche du jeu affiche votre nom, votre équipe, votre description et vos 3 lignes de règles.
3. Le joueur lance une partie **solo**, ou **crée / rejoint une salle**. Dans une salle, la partie démarre chez tout le monde quand l'hôte appuie sur A.
4. La console **affiche votre composant** et lui donne `ctx`.
5. Pendant la partie, votre jeu lit les boutons, dessine, envoie et reçoit des messages.
6. Votre jeu appelle **`ctx.lifecycle.gameOver({ score })`**. La console enregistre le score et affiche l'écran de résultats.
7. « Rejouer » ou « Menu » : la console **retire votre composant** et en crée un neuf pour la partie suivante. Tous les abonnements pris via `ctx` sont nettoyés automatiquement.

## 4. Créer votre jeu, pas à pas

### Étape 1 : choisir un identifiant

L'identifiant (`id`) de votre jeu sert partout. Il doit être **en minuscules**, sans espace ni accent, avec seulement des lettres, des chiffres, `-` ou `_`. Exemples : `course-de-luges`, `quiz_refuge`.

Il ne doit pas commencer par `_` (réservé au modèle) et ne doit pas déjà exister dans `games/`.

### Étape 2 : copier le modèle

```bash
cp -r games/_template games/course-de-luges
```

Ne travaillez **jamais** directement dans `games/_template` : c'est un fichier fourni (voir la section 8).

### Étape 3 : renommer le paquet

Dans `games/course-de-luges/package.json`, remplacez la ligne `name` :

```json
"name": "@games/course-de-luges",
```

### Étape 4 : déclarer le jeu dans `games.json`

Ajoutez **une seule ligne** à la fin de la liste `games`, sans toucher aux autres :

```json
{
  "id": "course-de-luges",
  "name": "Course de luges",
  "team": "Équipe Yéti",
  "version": "1.0.0",
  "description": "Une phrase qui donne envie de jouer, 100 caractères environ.",
  "minPlayers": 1,
  "maxPlayers": 4,
  "module": "games/course-de-luges/src/index.tsx"
}
```

| Champ | Règle |
| --- | --- |
| `id` | identique au nom du dossier |
| `name` | court : il doit tenir sur la cartouche du menu (environ 18 caractères) |
| `team` | le nom de votre équipe |
| `version` | `1.0.0`, puis augmentez à chaque version rendue |
| `description` | 2 lignes au maximum à l'écran |
| `minPlayers`, `maxPlayers` | entre 1 et 4. `minPlayers: 1` permet de jouer seul ; `maxPlayers` supérieur à 1 ouvre les salles |
| `module` | toujours `games/<id>/src/index.tsx` |

### Étape 5 : installer et lancer

```bash
pnpm install
pnpm dev:game course-de-luges
```

`pnpm dev:game` lance la console avec **seulement votre jeu**, plus le serveur de jeu pour le multijoueur. La page se recharge à chaque fois que vous enregistrez un fichier.

### Étape 6 : vérifier

```bash
pnpm check
```

Cette commande vérifie, dans l'ordre :
1. que vous n'avez modifié **aucun fichier fourni** (section 8) ;
2. que votre ligne de `games.json` est correcte ;
3. qu'il n'y a **aucune erreur TypeScript**, dans votre jeu comme dans le reste.

Lancez-la avant chaque commit. Un jeu rendu avec un `pnpm check` en erreur n'est pas recevable.

### Organisation conseillée de votre dossier

```
games/course-de-luges/
├─ package.json
├─ tsconfig.json
├─ README.md            règles du jeu et membres de l'équipe
└─ src/
   ├─ index.tsx         export default defineGame({...})  (obligatoire)
   ├─ Game.tsx          le composant principal
   ├─ logic.ts          les règles (sans React, plus facile à tester)
   ├─ draw.ts           le dessin
   ├─ assets.d.ts       fourni par le modèle (images et sons)
   └─ assets/           vos images et sons
```

Seul `src/index.tsx` avec son `export default defineGame(...)` est imposé. Le reste est libre.

## 5. Le contrat entre votre jeu et la console

Votre jeu est **un composant React** qui reçoit **une seule prop**, `ctx`, et qu'on déclare avec `defineGame` :

```tsx
import { defineGame, useGameLoop, useCanvas, type GameProps } from '@gamebovh/sdk';

function CourseDeLuges({ ctx }: GameProps) {
  const { canvasProps, get2d } = useCanvas(ctx);

  useGameLoop(ctx, (dt) => {
    // dt = millisecondes depuis l'image précédente
    // 1. lire les boutons  2. mettre à jour le jeu  3. dessiner
  });

  return <canvas {...canvasProps} />;
}

export default defineGame({
  component: CourseDeLuges,
  scoreOrder: 'desc', // 'desc' : plus grand = meilleur. 'asc' : plus petit = meilleur (chrono)
  howToPlay: ['Ligne 1 des règles.', 'Ligne 2.', 'Ligne 3.'],
});
```

Tout ce dont votre jeu a besoin passe par `ctx`. **N'allez rien chercher ailleurs** (ni dans la console, ni dans `window`, ni dans le stockage du navigateur) : voir les règles de code, section 9.

| `ctx.…` | Rôle | Exemple |
| --- | --- | --- |
| `screen` | taille de l'écran : 240 × 216 pixels | `ctx.screen.width` |
| `player` | le joueur sur cet appareil | `ctx.player.nickname` |
| `input` | les 8 boutons | `ctx.input.isDown('left')` |
| `lifecycle` | fin de partie, pause, retour au menu | `ctx.lifecycle.gameOver({ score })` |
| `audio` | sons et vibration | `ctx.audio.play('coin')` |
| `storage` | sauvegardes et classement local | `await ctx.storage.getLeaderboard()` |
| `multiplayer` | salle, joueurs, messages | `ctx.multiplayer.send({ type: 'tir' })` |
| `seed` | graine aléatoire, la même pour toute la salle | `createRandom(ctx.seed)` |
| `manifest` | votre ligne de `games.json` | `ctx.manifest.name` |

Hooks et outils fournis : `useGameLoop`, `useButton`, `useCanvas`, `usePaused`, `useRoomPlayers`, `useMessages`, `useScoreGossip`, `drawText`, `formatTime`, `createRandom`, `PALETTE`, `PLAYER_COLORS`.

**Le détail de chaque fonction, avec des exemples, est dans [`packages/sdk/README.md`](packages/sdk/README.md).** Le contrat exact, commenté ligne à ligne, est dans [`packages/sdk/src/contract.ts`](packages/sdk/src/contract.ts) : lisez-le, mais ne le modifiez pas.

### Les 6 règles du contrat

1. `src/index.tsx` fait un **`export default defineGame({...})`**.
2. L'écran fait **240 × 216 pixels**, et ce n'est pas à vous de l'agrandir : la console s'en charge.
3. Toutes les vitesses sont **multipliées par `dt`** : le jeu va à la même vitesse sur tous les appareils.
4. **`gameOver` est appelé une seule fois** par partie, avec un nombre en `score`.
5. `scoreOrder` correspond à votre score : `'desc'` pour des points, `'asc'` pour un temps.
6. Chaque message multijoueur est un objet avec un champ **`type`**, qui ne commence pas par `__`.

## 6. Le multijoueur

La console fait tout le travail de salle à votre place :

1. Un joueur choisit **Créer une salle** : la console affiche un code de 4 lettres.
2. Jusqu'à 3 autres joueurs choisissent **Rejoindre une salle** et tapent ce code.
3. L'hôte (le premier arrivé) appuie sur A : **votre jeu démarre chez tout le monde en même temps**, avec la **même `ctx.seed`**.

Dans votre jeu :
- `ctx.multiplayer.room` vaut `null` en solo. Testez-le pour adapter votre jeu.
- `useRoomPlayers(ctx)` donne la liste des joueurs. Chacun a un `slot` (0 à 3) stable : servez-vous-en pour la couleur (`PLAYER_COLORS[slot]`), l'équipe, la position de départ.
- `ctx.multiplayer.send(message)` envoie aux autres joueurs, `useMessages(ctx, (msg, de) => ...)` reçoit.
- Le serveur **ne fait que relayer**. C'est donc à vos clients de se mettre d'accord : soit chacun décide pour son joueur (voir le Slalom et la Bataille de neige), soit l'hôte (`isHost`) arbitre pour tous.

**Tester à plusieurs :**
- sur un seul ordinateur : ouvrez deux fenêtres de navigateur **côte à côte** (un onglet en arrière-plan se met en pause) ;
- avec vos téléphones, sur le même Wi-Fi : ouvrez l'adresse « Network » affichée au lancement de `pnpm dev:game` (par exemple `http://192.168.1.20:5173`).

Limites : 4 joueurs par salle, 4 Ko par message, environ 60 messages par seconde et par joueur. Envoyez votre position **10 à 15 fois par seconde**, pas à chaque image.

Pour un exemple complet, lisez `games/slalom` (course, positions en direct) et `games/snowball` (équipes, événements, robot pour le solo).

## 7. Ce que vous pouvez modifier

| Fichier ou dossier | Ce que vous pouvez faire |
| --- | --- |
| `games/<votre-jeu>/` | **Tout** : créer, modifier, supprimer des fichiers, ajouter des dépendances |
| `games.json` | **Ajouter votre ligne**, puis la modifier. Rien d'autre |
| `pnpm-lock.yaml` | Il change tout seul si vous ajoutez une dépendance avec `pnpm add` : c'est normal, commitez-le |

Pour ajouter une bibliothèque à votre jeu, depuis la racine du projet :

```bash
pnpm --filter @games/course-de-luges add <nom-de-la-bibliothèque>
```

Demandez l'accord de l'équipe pédagogique avant d'ajouter une bibliothèque importante (moteur de jeu, physique...). Elle doit fonctionner dans le navigateur, sans serveur, et rester légère.

## 8. Ce que vous ne devez pas modifier

Tous les autres fichiers sont **fournis** et partagés par les 6 équipes. Le jour de l'événement, OVHcloud n'installera **qu'une seule** console et **qu'un seul** serveur, avec les jeux des 6 équipes dedans. Si votre jeu ne fonctionne que grâce à une modification de la console, il ne fonctionnera pas le jour J.

| Interdit de modifier | Ce que c'est |
| --- | --- |
| `apps/` | la console : coque, menus, salles, pause, résultats |
| `packages/sdk/` | le framework : `ctx`, hooks, outils, contrat |
| `packages/protocol/` | les messages entre la console et le serveur |
| `server/` | le serveur de jeu |
| `scripts/`, `docs/`, `deploy/` | outils, documentation, déploiement |
| `games/_template/`, `games/slalom/`, `games/snowball/` | le modèle et les jeux de démonstration |
| Les jeux des autres équipes | évidemment |
| Les fichiers de la racine | `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.config.ts`, `.gitignore`, `README.md`, `CONSIGNES.md`, ce guide... |
| Les autres lignes de `games.json` | seule la vôtre vous appartient |
| `.kit-lock.json` | l'empreinte des fichiers fournis, qui sert à la vérification |

Interdit aussi : **ajouter** des fichiers dans ces dossiers, ou en **supprimer**.

**C'est vérifié automatiquement.** `pnpm check` compare chaque fichier fourni à son empreinte d'origine, et liste tout fichier modifié, ajouté ou supprimé. L'équipe pédagogique relance cette vérification au moment du rendu, avec sa propre copie de l'empreinte.

**Vous avez modifié un fichier fourni par erreur ?**

```bash
git checkout -- chemin/du/fichier
```

**Vous pensez avoir trouvé un bug dans la console ou le framework, ou il vous manque une fonction ?** Ne le corrigez pas vous-mêmes : prévenez l'équipe pédagogique avec une description et, si possible, les étapes pour reproduire. Si la correction est validée, elle sera publiée dans le kit pour les 6 équipes, et vous la récupérerez (section 11).

## 9. Règles de code

| Règle | Pourquoi |
| --- | --- |
| **Passez toujours par `ctx`** pour les boutons, le son, le stockage, le réseau | La console gère la pause, le son coupé, le tactile et la manette. Un `addEventListener('keydown')` dans votre jeu ignorerait les boutons tactiles |
| N'utilisez pas `localStorage`, `sessionStorage` ou IndexedDB directement : utilisez `ctx.storage` | Vos données restent rangées à part, sans écraser celles des autres jeux |
| **Aucun appel réseau** : pas de `fetch`, pas d'API extérieure, pas de WebSocket à vous | Le jour J, seul le serveur de jeu est disponible. Le multijoueur passe par `ctx.multiplayer` |
| Aucune ressource chargée depuis Internet (CDN, polices en ligne, images externes) | Tout doit être dans votre dossier, pour marcher même avec un réseau saturé |
| Pas de `eval`, pas de `new Function`, pas de code chargé à la volée | Sécurité |
| Ne touchez pas au reste de la page (`document.body`, styles globaux, plein écran, titre) | La console est partagée : votre jeu vit dans sa zone de 240 × 216 |
| Si vous utilisez du CSS, préfixez toutes vos classes avec l'id du jeu (`.course-de-luges-score`) | Pour ne pas casser l'affichage de la console ou des autres jeux |
| Tout le texte affiché est **en français** | Public de l'événement |
| Pas d'erreur TypeScript, pas de `// @ts-ignore` pour la masquer | `pnpm check` doit passer |
| Pas d'erreur dans la console du navigateur (F12) pendant une partie | Un jeu qui plante affiche « ERREUR DE CARTOUCHE » au lieu de s'afficher |
| Contenu adapté à une soirée d'entreprise | Pas de violence réaliste, pas de contenu choquant, rien sur des personnes réelles |

## 10. Images, sons et polices

- **Images** : déposez-les dans `games/<votre-jeu>/src/assets/` et importez-les. Le fichier `src/assets.d.ts` du modèle rend cet import possible :

  ```ts
  import luge from './assets/luge.png';

  const image = new Image();
  image.src = luge;
  // dans la boucle : if (image.complete) g.drawImage(image, x, y);
  ```

  Formats : PNG, WebP, JPG ou SVG. Dessinez à la taille de l'écran (240 × 216) : inutile de fournir des images en haute définition.

- **Sons** : utilisez d'abord les sons de la console (`ctx.audio.play('coin')`) ou `ctx.audio.tone(...)`. Si vous importez vos propres fichiers MP3 ou OGG, **ne les jouez que si `ctx.audio.muted` est faux**, et gardez-les courts.

- **Polices** : la police pixel de la console est disponible avec `drawText` ou la constante `FONT`. N'importez pas d'autre police depuis Internet.

- **Droits** : uniquement des créations de l'équipe, ou des ressources dont la licence autorise l'usage (CC0, CC-BY avec le crédit dans le README de votre jeu). Pas de personnage, de logo ou de musique d'un jeu ou d'une marque existante.

- **Poids** : visez moins de 2 Mo pour tout le dossier de votre jeu. Les joueurs le téléchargeront sur leur téléphone, parfois en 4G.

## 11. Travailler en équipe avec Git

- Travaillez sur des **branches** courtes et fusionnez souvent dans `main`.
- Lancez `pnpm check` **avant chaque commit**.
- Un message de commit clair : « Ajoute le compte à rebours », « Corrige la collision avec les murs ».
- Ne commitez jamais `node_modules` ni `dist` (ils sont déjà ignorés).

**Récupérer une mise à jour du kit** (correction de bug publiée par l'équipe pédagogique) : la marche à suivre sera donnée au moment de la mise à jour. Comme vous n'avez touché qu'à votre dossier et à votre ligne de `games.json`, elle se fera sans conflit.

## 12. Rendre votre jeu

À la date indiquée dans [`CONSIGNES.md`](CONSIGNES.md) :

1. `pnpm check` passe sans erreur, sur un clone tout neuf du dépôt (`git clone`, `pnpm install`, `pnpm check`).
2. Le `README.md` de votre jeu donne les règles, les commandes et les membres de l'équipe.
3. Votre ligne de `games.json` est à jour (version, description).
4. Vous créez une étiquette de version et la poussez :

   ```bash
   git tag v1.0
   git push origin v1.0
   ```

5. L'équipe pédagogique a bien accès au dépôt.

L'équipe pédagogique récupère alors **uniquement** votre dossier `games/<votre-jeu>/` et votre ligne de `games.json`, pour les intégrer à la version livrée à OVHcloud. Tout ce qui est en dehors de votre dossier est ignoré.

### Checklist avant le rendu

- [ ] `pnpm check` passe sur un clone tout neuf.
- [ ] Aucun fichier fourni modifié (vérifié par `pnpm check`).
- [ ] Une partie dure 2 à 5 minutes, les règles se comprennent en 30 secondes.
- [ ] Le jeu se joue **au doigt sur téléphone** et **au clavier**.
- [ ] Tout le texte est en français.
- [ ] `gameOver` est appelé une seule fois, avec le bon `scoreOrder`.
- [ ] En multijoueur : testé sur au moins deux appareils ; le départ d'un joueur ne bloque pas la partie.
- [ ] Aucune erreur dans la console du navigateur pendant une partie.
- [ ] Aucun appel réseau, aucune ressource venue d'Internet.
- [ ] Images et sons libres de droits, crédités si besoin.
- [ ] README du jeu à jour.

## 13. Questions fréquentes

**Notre jeu n'apparaît pas dans le menu.** Vérifiez que `id`, le nom du dossier et `module` de `games.json` correspondent, puis lancez `pnpm check`. Avec `pnpm dev` (sans `:game`), les identifiants qui commencent par `_` sont cachés.

**« ERREUR DE CARTOUCHE » s'affiche.** Votre composant a planté : ouvrez la console du navigateur (F12) pour voir l'erreur exacte.

**Le jeu va plus vite sur ordinateur que sur téléphone.** Une vitesse n'est pas multipliée par `dt`.

**On a besoin d'une fonction qui n'existe pas dans `ctx`.** Demandez à l'équipe pédagogique. Ne contournez pas le framework, et ne le modifiez pas.

**On veut un écran plus grand.** Non : 240 × 216 pour tout le monde, c'est l'identité de la console. La console agrandit l'image toute seule.

**Peut-on utiliser un moteur de jeu (Phaser, PixiJS...) ?** Seulement après accord de l'équipe pédagogique, et à condition qu'il dessine dans le canvas fourni par `useCanvas`, qu'il passe par `ctx` pour les boutons et le son, et qu'il reste léger.

**Le multijoueur ne marche pas entre nos téléphones.** Ils doivent être sur le même Wi-Fi que l'ordinateur qui lance `pnpm dev:game`, et ouvrir l'adresse « Network », pas `localhost`. Certains réseaux d'école bloquent les connexions entre appareils : testez alors avec deux fenêtres sur un même ordinateur.
