import { defineGame } from '@gamebovh/sdk';
import { Slalom, type SlalomMsg } from './Slalom.tsx';

export default defineGame<SlalomMsg>({
  component: Slalom,
  // C'est un chrono : le plus petit temps gagne.
  scoreOrder: 'asc',
  howToPlay: {
    fr: ['Dirige-toi à la croix, passe entre les fanions.', 'A : schuss pour accélérer. B : freiner.', 'Porte ratée = +3 s. Évite les sapins !'],
    en: ['Steer with the d-pad, go between the flags.', 'A: tuck to speed up. B: brake.', 'Missed gate = +3 s. Avoid the trees!'],
  },
});
