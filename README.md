# GameBOVH : kit des équipes

Console de mini-jeux façon console portable rétro, créée pour l'**Annual Party OVHcloud** du 10 décembre 2026. Les jeux sont développés par les étudiants de Lille Ynov Campus et leur équipe pédagogique.

Ce dépôt est le **kit de départ** du challenge : la console, le framework, le serveur de jeu, une cartouche modèle et deux jeux de démonstration. Chaque équipe en fait sa propre copie et y ajoute **son** jeu.

La console s'affiche **en français et en anglais** (selon le navigateur, modifiable dans les réglages) et se joue sur **téléphone, tablette et ordinateur**, au doigt ou au clavier AZERTY comme QWERTY. Votre jeu doit faire de même : voir [ETUDIANTS.md](ETUDIANTS.md), section 5.

## Par où commencer

1. **[CONSIGNES.md](CONSIGNES.md)** : le sujet, les contraintes, le calendrier, la soutenance et l'évaluation.
2. **[ETUDIANTS.md](ETUDIANTS.md)** : le guide technique. Installation, fonctionnement de GameBOVH, création du jeu pas à pas, **ce que vous pouvez et ne pouvez pas modifier**, rendu.
3. **[packages/sdk/README.md](packages/sdk/README.md)** : la référence de tout ce que votre jeu peut utiliser.

## Démarrage rapide

**Un seul membre de l'équipe**, connecté à GitHub, ouvre **https://github.com/pierrelefebvre/gamebovh-kit/generate** (ou clique sur le bouton vert **Use this template** de cette page, visible seulement une fois connecté), puis :

1. choisit son compte, nomme le dépôt de l'équipe et coche **Private** ;
2. clique sur **Create repository** ;
3. dans le nouveau dépôt, **Settings > Collaborators > Add people**, invite les autres membres de l'équipe et l'équipe pédagogique (`pierrelefebvre`).

Ensuite, **chaque membre** (après avoir accepté l'invitation reçue par email) :

```bash
git clone <adresse-du-dépôt-de-l-équipe>
cd <nom-du-dépôt>
corepack enable
pnpm install
pnpm dev:game _template
```

Ouvrir http://localhost:5173 : la console démarre avec la cartouche modèle.

## Commandes

| Commande | Rôle |
| --- | --- |
| `pnpm dev` | Console et serveur de jeu en local, toutes les cartouches |
| `pnpm dev:game <id>` | Console avec une seule cartouche, par exemple `pnpm dev:game _template` |
| `pnpm check` | Vérifie que les fichiers fournis sont intacts, le catalogue et les types. **À lancer avant chaque commit** |
| `pnpm test` | Tests automatiques du serveur et du stockage |
| `pnpm build` | Construit la console dans `apps/console/dist` |

## Contenu du kit

```
games.json              catalogue des cartouches : ajoutez-y votre ligne
games/
  _template/            cartouche modèle commentée, à copier
  slalom/               démo : Slalom Express (1 à 4 joueurs, course en direct)
  snowball/             démo : Bataille de neige (équipes, robot en solo)
packages/
  sdk/                  le framework : contrat jeu / console, hooks, outils
  protocol/             messages entre la console et le serveur
apps/console/           la console (React + Vite)
server/                 serveur de jeu (salles multijoueur)
docs/PROTOCOL.md        protocole WebSocket, pour les curieux
scripts/                lancement local et vérifications
```

Votre jeu vit **uniquement** dans `games/<votre-jeu>/` et dans votre ligne de `games.json`. Tout le reste est fourni et ne doit pas être modifié : voir [ETUDIANTS.md](ETUDIANTS.md), section 8.

## Licence et marques

Le code de ce kit est fourni pour le challenge GameBOVH. Le logo OVHcloud est une marque d'OVHcloud, utilisée pour son événement : ne le réutilisez pas en dehors de ce projet.
