# Bataille de neige

Cartouche de démonstration en équipes : 2 contre 2 (de 1 à 4 joueurs). En solo, on s'entraîne contre un robot.

## Règles

- Les places 1 et 3 de la salle forment l'équipe **rouge** (à gauche), les places 2 et 4 l'équipe **bleue** (à droite).
- Croix : se déplacer dans son camp. **A** : lancer une boule. **B** maintenu : s'accroupir derrière un mur.
- On porte 3 boules au maximum. Elles se refont toutes seules, plus vite quand on est accroupi.
- Un joueur touché est sonné un instant. Première équipe à 5 touches, ou meilleure équipe au bout de 2 minutes.

## Ce que ce jeu montre

| Notion | Où regarder |
| --- | --- |
| Équipes à partir de la place dans la salle | `teamOf(slot)` dans `src/arena.ts` |
| Arène identique et équitable pour tous | `generateWalls(ctx.seed)`, murs placés en miroir |
| Événements réseau ponctuels | messages `throw` et `hit` du type `SnowMsg` |
| Arbitrage sans serveur | chaque joueur décide s'il est touché et envoie `hit` aux autres |
| Mode solo avec un robot | `updateBot()` dans `src/Snowball.tsx` |

Limite assumée : un joueur malin pourrait ne jamais se déclarer touché. Pour une soirée, c'est acceptable.

Auteur : Équipe GameBOVH.
