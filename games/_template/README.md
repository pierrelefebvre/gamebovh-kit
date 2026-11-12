# Attrape-Flocons (cartouche modèle)

Le plus petit jeu complet possible, à copier pour démarrer le tien. Il est caché du menu normal et s'affiche avec :

```bash
pnpm dev:game _template
```

## Règles

- Déplace le bonnet avec la croix et attrape les flocons.
- 3 flocons ratés et c'est fini. Plus tu en attrapes, plus ils tombent vite.

## Ce qu'il montre

Tout est dans `src/index.tsx`, commenté pas à pas :

- `useCanvas` pour dessiner, `useGameLoop` pour la boucle de jeu ;
- `ctx.input.isDown` pour un bouton maintenu, `useButton` pour un appui ;
- les sons (`ctx.audio.play`) et la vibration ;
- la fin de partie avec `ctx.lifecycle.gameOver({ score })`.

## Partir de ce modèle

1. `cp -r games/_template games/mon-jeu`
2. Dans `games/mon-jeu/package.json`, mets `"name": "@games/mon-jeu"`.
3. Ajoute ton jeu dans `games.json` (id `mon-jeu`, module `games/mon-jeu/src/index.tsx`).
4. `pnpm install`, puis `pnpm dev:game mon-jeu`.
5. Remplace ce README par les règles de ton jeu et les noms de ton équipe.

Le guide complet : [`packages/sdk/README.md`](../../packages/sdk/README.md).
