import { defineGame } from '@gamebovh/sdk';
import { Snowball, type SnowMsg } from './Snowball.tsx';

export default defineGame<SnowMsg>({
  component: Snowball,
  // Score personnel : nombre d'adversaires touchés, le plus grand gagne.
  scoreOrder: 'desc',
  howToPlay: ['A : lancer une boule. B (maintenu) : s\'abriter.', 'Accroupi, tu refais tes boules plus vite.', 'Première équipe à 5 touches !'],
});
