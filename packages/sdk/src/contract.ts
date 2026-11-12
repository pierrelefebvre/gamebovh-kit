/**
 * CONTRAT JEU / CONSOLE GAMEBOVH
 *
 * Tout ce qu'une cartouche (un jeu) reçoit de la console est décrit ici.
 * Un jeu est un composant React qui reçoit une seule prop : `ctx`.
 * Lire packages/sdk/README.md pour le guide pas à pas.
 */
import type { ComponentType } from 'react';

/* ================================================================
 * Écran
 * ================================================================ */

/** Résolution logique de l'écran, en pixels. La console met à l'échelle. */
export const SCREEN_WIDTH = 240;
export const SCREEN_HEIGHT = 216;

/** Palette conseillée (neige et nuit d'hiver), libre à vous d'en sortir. */
export const PALETTE = {
  night: '#0b1e3f',
  deep: '#24497a',
  ice: '#7fb4de',
  snow: '#eef6ff',
  red: '#d7263d',
  gold: '#f2b134',
  pine: '#2e8b57',
  wood: '#8a5a3b',
} as const;

/** Couleur de chaque place de salle (slot 0 à 3), la même que dans le lobby. */
export const PLAYER_COLORS = [PALETTE.red, PALETTE.pine, PALETTE.gold, PALETTE.ice] as const;

/** Fonction à appeler pour se désabonner. */
export type Unsubscribe = () => void;

/* ================================================================
 * Entrées
 * ================================================================ */

export type Button = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start' | 'select';

export const BUTTONS: readonly Button[] = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'];

export type ButtonState = Readonly<Record<Button, boolean>>;

export interface InputApi {
  /** Le bouton est-il enfoncé en ce moment ? À lire dans la boucle de jeu. */
  isDown(button: Button): boolean;
  /** Instantané de tous les boutons. */
  snapshot(): ButtonState;
  /** Appelé une fois à l'appui. '*' = n'importe quel bouton. */
  onPress(button: Button | '*', cb: (button: Button) => void): Unsubscribe;
  /** Appelé une fois au relâchement. */
  onRelease(button: Button | '*', cb: (button: Button) => void): Unsubscribe;
}

/* ================================================================
 * Cycle de vie
 * ================================================================ */

export interface GameResult {
  /** Valeur classée : des points, ou des millisecondes pour un chrono. */
  score: number;
  /** Texte affiché à la place du nombre, par exemple "01:23.45". */
  display?: string;
  /** En multijoueur : victoire, défaite ou égalité (affiché sur l'écran de résultats). */
  outcome?: 'win' | 'lose' | 'draw';
}

export interface LifecycleApi {
  /** true quand la console est en pause (onglet masqué, menu pause, écran de résultats). */
  readonly paused: boolean;
  onPause(cb: () => void): Unsubscribe;
  onResume(cb: () => void): Unsubscribe;
  /**
   * Fin de partie : la console enregistre le score dans le classement local
   * puis affiche l'écran de résultats. La promesse renvoie l'entrée enregistrée.
   * Appeler une seule fois par partie.
   */
  gameOver(result: GameResult): Promise<ScoreEntry>;
  /** Quitter immédiatement vers le menu des cartouches. */
  exitToMenu(): void;
}

/* ================================================================
 * Audio et vibration
 * ================================================================ */

export type SoundName =
  | 'blip'
  | 'select'
  | 'confirm'
  | 'back'
  | 'jump'
  | 'hit'
  | 'coin'
  | 'whoosh'
  | 'throw'
  | 'splat'
  | 'countdown'
  | 'go'
  | 'win'
  | 'lose';

export interface ToneOptions {
  /** Fréquence en Hz (440 = la). */
  frequency: number;
  durationMs: number;
  wave?: 'square' | 'triangle' | 'sawtooth' | 'sine';
  /** 0 à 1. */
  volume?: number;
  /** Glissement de fréquence jusqu'à cette valeur (effet "piou"). */
  slideTo?: number;
}

export interface AudioApi {
  /** Joue un son partagé de la console. Silencieux si le son est coupé (réglage par défaut). */
  play(sound: SoundName): void;
  /** Bip libre pour composer vos propres effets. */
  tone(options: ToneOptions): void;
  readonly muted: boolean;
  /** Vibration du téléphone, en ms (ignorée si non supportée ou désactivée). */
  vibrate(pattern: number | number[]): void;
}

/* ================================================================
 * Stockage local (dans le navigateur, propre à chaque jeu)
 * ================================================================ */

export interface ScoreEntry {
  /** Identifiant unique : sert à dédoublonner lors des échanges entre joueurs. */
  id: string;
  gameId: string;
  /** Identifiant stable de l'appareil (pas de compte). */
  playerId: string;
  nickname: string;
  score: number;
  display?: string;
  /** Date en millisecondes (Date.now()). */
  date: number;
}

export interface StorageApi {
  /** Lecture d'une valeur libre, rangée automatiquement dans l'espace du jeu. */
  get<T>(key: string): Promise<T | undefined>;
  /** Écriture d'une valeur libre (objet, tableau, nombre...). */
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  /** Classement du jeu, trié selon `scoreOrder`, sans doublon. */
  getLeaderboard(limit?: number): Promise<ScoreEntry[]>;
  /** Meilleur score de ce joueur sur cet appareil. */
  getPersonalBest(): Promise<ScoreEntry | undefined>;
  /** Fusionne des scores reçus d'autres joueurs. Renvoie le nombre de nouveaux scores. */
  mergeScores(entries: ScoreEntry[]): Promise<number>;
}

/* ================================================================
 * Multijoueur
 * ================================================================ */

export type Slot = 0 | 1 | 2 | 3;

export interface Player {
  /** Identifiant de connexion (change à chaque connexion). */
  id: string;
  nickname: string;
  /** Le plus ancien joueur de la salle : c'est lui qui arbitre si besoin. */
  isHost: boolean;
  /** C'est moi. */
  isMe: boolean;
  /** Place stable de 0 à 3 : couleur, équipe, position de départ. */
  slot: Slot;
}

export interface Room {
  /** Code court à partager, par exemple "KQZT". */
  code: string;
  gameId: string;
  players: Player[];
}

export type ConnectionStatus = 'offline' | 'connecting' | 'online' | 'error';

/** Tout message de jeu doit avoir un champ `type`. Les types qui commencent par "__" sont réservés. */
export interface GameMessage {
  type: string;
}

export interface MultiplayerApi<TMsg extends GameMessage = GameMessage> {
  readonly status: ConnectionStatus;
  /** null quand la partie est en solo. */
  readonly room: Room | null;
  /** Moi dans la salle, null en solo. */
  readonly me: Player | null;
  /** Envoie à tous les autres joueurs de la salle, ou à un seul avec `{ to: player.id }`. */
  send(message: TMsg, options?: { to?: string }): void;
  onMessage(cb: (message: TMsg, from: Player) => void): Unsubscribe;
  onPlayerJoin(cb: (player: Player) => void): Unsubscribe;
  onPlayerLeave(cb: (player: Player) => void): Unsubscribe;
  /** Utilisés par le lobby de la console ; exposés pour les jeux qui veulent leur propre écran. */
  createRoom(): Promise<Room>;
  joinRoom(code: string): Promise<Room>;
  leaveRoom(): void;
}

/* ================================================================
 * Contexte transmis au jeu
 * ================================================================ */

export interface GameManifest {
  id: string;
  name: string;
  team: string;
  version: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
}

export interface GameContext<TMsg extends GameMessage = GameMessage> {
  manifest: GameManifest;
  screen: { width: number; height: number };
  /** Le joueur sur cet appareil. `id` est stable (sert aux scores). */
  player: { id: string; nickname: string };
  /**
   * Graine aléatoire de la partie, identique pour tous les joueurs d'une salle.
   * Avec `createRandom(ctx.seed)`, tout le monde obtient la même piste, les mêmes obstacles...
   */
  seed: number;
  input: InputApi;
  lifecycle: LifecycleApi;
  audio: AudioApi;
  storage: StorageApi;
  multiplayer: MultiplayerApi<TMsg>;
}

export interface GameProps<TMsg extends GameMessage = GameMessage> {
  ctx: GameContext<TMsg>;
}

/* ================================================================
 * Ce qu'une cartouche exporte par défaut
 * ================================================================ */

export interface GameDefinition<TMsg extends GameMessage = GameMessage> {
  component: ComponentType<GameProps<TMsg>>;
  /** 'desc' : plus grand = meilleur (points). 'asc' : plus petit = meilleur (chrono). */
  scoreOrder: 'asc' | 'desc';
  /** Règles affichées avant la partie, en français, 3 lignes courtes maximum. */
  howToPlay?: string[];
}
