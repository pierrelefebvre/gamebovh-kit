# Slalom Express

Cartouche de démonstration, 1 à 4 joueurs.

## Règles

- Dirige-toi avec la croix et passe entre les deux fanions de chaque porte.
- **A** (ou Haut) : schuss pour aller plus vite. **B** (ou Bas) : freiner.
- Une porte ratée ajoute 3 secondes. Toucher un sapin fait chuter un instant.
- Le meilleur temps gagne. Dans une salle, tout le monde descend la même piste et voit les autres skieurs en direct.

## Ce que ce jeu montre

| Notion | Où regarder |
| --- | --- |
| Boucle de jeu sur canvas | `useGameLoop` et `draw()` dans `src/Slalom.tsx` |
| Même piste pour tout le monde | `generateCourse(ctx.seed)` dans `src/course.ts` |
| Messages typés | type `SlalomMsg`, `ctx.multiplayer.send`, `useMessages` |
| Fin de partie | `ctx.lifecycle.gameOver({ score, display, outcome })` |
| Classement de proche en proche | `useScoreGossip(ctx)` puis `share()` après `gameOver` |

Auteur : Équipe GameBOVH.
