import type { GameDefinition, GameMessage } from './contract.ts';

/**
 * Déclare une cartouche. À utiliser en export par défaut de `src/index.tsx` :
 *
 *   export default defineGame({ component: MyGame, scoreOrder: 'desc' });
 */
export function defineGame<TMsg extends GameMessage = GameMessage>(
  definition: GameDefinition<TMsg>,
): GameDefinition<TMsg> {
  if (typeof definition.component !== 'function' && typeof definition.component !== 'object') {
    throw new Error('defineGame: "component" must be a React component.');
  }
  if (definition.scoreOrder !== 'asc' && definition.scoreOrder !== 'desc') {
    throw new Error('defineGame: "scoreOrder" must be "asc" or "desc".');
  }
  const how = definition.howToPlay as unknown;
  if (how !== undefined && (Array.isArray(how) || !Array.isArray((how as { fr?: unknown }).fr) || !Array.isArray((how as { en?: unknown }).en))) {
    throw new Error('defineGame: "howToPlay" must be { fr: [...], en: [...] }.');
  }
  return definition;
}
