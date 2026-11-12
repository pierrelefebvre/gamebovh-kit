# Protocole WebSocket GameBOVH

Référence du dialogue entre la console et le serveur de jeu. Les étudiants n'ont pas besoin de ce document : le SDK s'en charge (voir `packages/sdk/README.md`). Les types font foi dans [`packages/protocol/src/index.ts`](../packages/protocol/src/index.ts).

## Principes

- Le serveur **ne connaît aucun jeu**. Il gère des salles et relaie des messages opaques.
- Une salle : 4 joueurs maximum, un code de 4 lettres (sans I ni O), rattachée à un `gameId` pour qu'on ne rejoigne pas la salle d'un autre jeu.
- Pas de compte : un pseudo de 1 à 12 caractères suffit.
- L'hôte est le joueur le plus ancien de la salle. S'il part, le suivant devient hôte.
- Chaque joueur garde une place (`slot`, de 0 à 3) pendant toute sa présence. Une place libérée est réattribuée au prochain arrivant.
- Une salle vide est supprimée.

Tous les messages sont du JSON texte avec un champ `t` (le type).

## Client vers serveur

| Message | Rôle |
| --- | --- |
| `{ t: 'hello', v: 1, nickname }` | Présentation, obligatoire en premier. Peut être renvoyé pour changer de pseudo |
| `{ t: 'create', gameId }` | Crée une salle et y entre |
| `{ t: 'join', code, gameId }` | Rejoint une salle existante |
| `{ t: 'leave' }` | Quitte la salle |
| `{ t: 'relay', data, to? }` | Transmet `data` à tous les autres joueurs de la salle, ou au seul joueur `to` |

## Serveur vers client

| Message | Rôle |
| --- | --- |
| `{ t: 'welcome', id, v }` | Réponse à `hello`. `id` est l'identifiant de connexion du joueur |
| `{ t: 'room', code, gameId, players }` | État complet de la salle, envoyé à l'arrivée |
| `{ t: 'presence', event: 'join' \| 'leave', player, players }` | Un joueur arrive ou part, avec la nouvelle liste |
| `{ t: 'relay', from, data }` | Message d'un autre joueur |
| `{ t: 'left' }` | Confirmation de sortie de salle |
| `{ t: 'error', code, message }` | Erreur (voir ci-dessous) |

Un joueur (`PlayerInfo`) : `{ id, nickname, slot, isHost }`.

Codes d'erreur : `bad_request`, `not_ready` (pas de `hello`), `room_not_found`, `room_full`, `wrong_game`, `too_many_rooms`, `not_in_room`, `rate_limited`.

## Messages réservés à la console

Dans `relay.data`, les types qui commencent par `__` sont réservés. Le SDK les filtre : les jeux ne les reçoivent jamais.

| `data` | Rôle |
| --- | --- |
| `{ type: '__start', seed }` | L'hôte lance la partie ; tout le monde démarre avec la même graine |
| `{ type: '__scores', entries }` | Échange des meilleurs scores locaux (classement de proche en proche) |

## Limites

- Message : 4 Ko maximum (connexion fermée au-delà).
- Débit : environ 60 messages par seconde et par joueur, rafales jusqu'au double. Au-delà, les messages sont ignorés et un `rate_limited` est envoyé.
- Battement : ping toutes les 15 secondes ; une connexion qui ne répond plus est fermée.
- Origine : seules les pages listées dans `ALLOWED_ORIGINS` peuvent se connecter.

## Points d'accès HTTP

- `GET /health` : `{ ok, connections, rooms, players }`.
- Le WebSocket est accepté sur n'importe quel chemin ; par convention la console utilise `/ws`.
- En mode tout-en-un (`STATIC_DIR`), les autres chemins servent les fichiers de la console.
