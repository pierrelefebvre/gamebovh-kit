# Challenge GameBOVH : consignes

Créez un jeu pour la console GameBOVH, qui sera jouée par les collaborateurs d'OVHcloud pendant leur **Annual Party** du 10 décembre 2026 (thème : station de ski rétro, neige, fêtes de fin d'année).

Le guide technique, à lire avant de commencer : [`ETUDIANTS.md`](ETUDIANTS.md).

## Le sujet

Un jeu court, qui se comprend tout de suite et **donne envie de rejouer** :
- envie de **battre son record** ;
- envie de **défier ses collègues**, en direct dans une salle ou en comparant les scores.

On est à une soirée d'entreprise : les joueurs ont un téléphone dans une main et un verre dans l'autre, peu de temps, et du monde autour d'eux. Pensez « une partie de plus ! ».

## Contraintes

| Contrainte | Attendu |
| --- | --- |
| Durée d'une partie | 2 à 5 minutes |
| Règles | comprises en moins de 30 secondes, résumées en 3 lignes dans le jeu |
| Joueurs | 1 à 4. Le multijoueur est un plus, pas une obligation |
| Appareils | jouable au doigt sur téléphone **et** au clavier sur ordinateur |
| Langue | tout le texte affiché est en français |
| Thème | hiver, ski, montagne, neige ou fêtes de fin d'année |
| Technique | une cartouche GameBOVH, en respectant **toutes** les règles de [`ETUDIANTS.md`](ETUDIANTS.md) |
| Originalité | un jeu de votre invention : pas de copie d'un jeu existant (nom, personnages, graphismes, musique) |

## Équipes et calendrier

- **6 équipes de 5 étudiants**.
- **Brief** : jeudi 12 novembre 2026, 13h.
- **Séances de travail** : 5 à 6 séances de 4 heures entre le 12 et le 27 novembre.
- **Rendu** : vendredi 27 novembre 2026, avant la soutenance *(heure limite à confirmer)*.
- **Soutenances** : vendredi 27 novembre 2026, 14h, sur le campus.

## Soutenance

**15 minutes par équipe** :
- démonstration du jeu, en direct, sur la console GameBOVH ;
- présentation du projet : l'idée, les choix de jeu, la répartition du travail, les difficultés rencontrées.

Puis délibération et annonce du **podium des 3 meilleurs jeux**.

*Récompenses pour les équipes finalistes : à confirmer par OVHcloud.*

## Livrables

1. Le dépôt GitHub de l'équipe, accessible à l'équipe pédagogique, avec une étiquette `v1.0` (voir [`ETUDIANTS.md`](ETUDIANTS.md), section « Rendre votre jeu »).
2. Le dossier `games/<votre-jeu>/` et votre ligne de `games.json`.
3. Le `README.md` de votre jeu : règles, commandes, membres de l'équipe et rôle de chacun, crédits des ressources utilisées.
4. Le support de la soutenance.

## Critères d'évaluation

*Pondération à confirmer.*

| Critère | Ce qu'on regarde |
| --- | --- |
| Envie de rejouer | Une partie de plus ? Envie de battre son record, de défier les autres ? |
| Jouabilité | Commandes agréables au doigt et au clavier, difficulté bien dosée, règles claires |
| Respect du cadre | Durée, thème, français, `pnpm check` sans erreur, aucun fichier fourni modifié |
| Finition | Graphismes, sons, retours visuels, aucun plantage |
| Code | Lisible, organisé, commenté là où c'est utile |
| Soutenance | Clarté de la démonstration et de la présentation, travail d'équipe |

## Interdits éliminatoires

- Modifier un fichier fourni (console, framework, serveur, jeux de démonstration, fichiers de la racine) : voir [`ETUDIANTS.md`](ETUDIANTS.md), section 8.
- Faire des appels réseau ou charger des ressources depuis Internet.
- Utiliser des ressources (images, sons, personnages, logos) sans en avoir le droit.
- Un contenu inadapté à une soirée d'entreprise.
