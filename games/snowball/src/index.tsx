import { defineGame } from '@gamebovh/sdk';
import { Snowball, type SnowMsg } from './Snowball.tsx';

export default defineGame<SnowMsg>({
  component: Snowball,
  // Score personnel : nombre d'adversaires touchés, le plus grand gagne.
  scoreOrder: 'desc',
  howToPlay: {
    fr: ["A : lancer une boule. B (maintenu) : s'abriter.", 'Accroupi, tu refais tes boules plus vite.', 'Première équipe à 5 touches !'],
    en: ['A: throw a snowball. B (hold): take cover.', 'Crouching reloads your snowballs faster.', 'First team to 5 hits wins!'],
  },
});
