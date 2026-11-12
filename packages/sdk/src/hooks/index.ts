/**
 * Hooks React prêts à l'emploi. Chacun se désabonne tout seul
 * quand le composant disparaît : pas de fuite, pas de nettoyage à écrire.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Button, GameContext, GameMessage, Player, ScoreEntry } from '../contract.ts';
import { systemChannelOf } from '../system.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGameContext = GameContext<any>;

/** Garde toujours la dernière version d'une fonction sans relancer les effets. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/**
 * Boucle de jeu à ~60 images par seconde. `update(dtMs)` reçoit le temps écoulé
 * depuis l'image précédente (plafonné à 100 ms). La boucle s'arrête en pause,
 * sauf avec `{ runWhilePaused: true }` (utile en multijoueur temps réel).
 */
export function useGameLoop(
  ctx: AnyGameContext,
  update: (dtMs: number) => void,
  options: { runWhilePaused?: boolean } = {},
): void {
  const latest = useLatest(update);
  const runWhilePaused = options.runWhilePaused ?? false;
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      if (runWhilePaused || !ctx.lifecycle.paused) latest.current(dt);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ctx, runWhilePaused, latest]);
}

/** Réagit à l'appui et au relâchement d'un bouton ('*' pour tous). */
export function useButton(
  ctx: AnyGameContext,
  button: Button | '*',
  handlers: { onPress?: (b: Button) => void; onRelease?: (b: Button) => void },
): void {
  const latest = useLatest(handlers);
  useEffect(() => {
    const offPress = ctx.input.onPress(button, (b) => latest.current.onPress?.(b));
    const offRelease = ctx.input.onRelease(button, (b) => latest.current.onRelease?.(b));
    return () => {
      offPress();
      offRelease();
    };
  }, [ctx, button, latest]);
}

/** true quand la console est en pause. */
export function usePaused(ctx: AnyGameContext): boolean {
  const [paused, setPaused] = useState(ctx.lifecycle.paused);
  useEffect(() => {
    const a = ctx.lifecycle.onPause(() => setPaused(true));
    const b = ctx.lifecycle.onResume(() => setPaused(false));
    return () => {
      a();
      b();
    };
  }, [ctx]);
  return paused;
}

/**
 * Canvas à la taille de l'écran (240 x 216).
 *   const { canvasProps, get2d } = useCanvas(ctx);
 *   <canvas {...canvasProps} />
 *   const g = get2d(); if (g) g.fillRect(0, 0, 10, 10);
 */
export function useCanvas(ctx: AnyGameContext) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const get2d = useCallback(() => {
    const g = canvasRef.current?.getContext('2d') ?? null;
    if (g) g.imageSmoothingEnabled = false;
    return g;
  }, []);
  const canvasProps = {
    ref: canvasRef,
    width: ctx.screen.width,
    height: ctx.screen.height,
    style: { display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' as const },
  };
  return { canvasRef, canvasProps, get2d };
}

/** Liste des joueurs de la salle, mise à jour à chaque arrivée ou départ. */
export function useRoomPlayers(ctx: AnyGameContext): Player[] {
  const read = () => ctx.multiplayer.room?.players ?? [];
  const [players, setPlayers] = useState<Player[]>(read);
  useEffect(() => {
    const refresh = () => setPlayers(ctx.multiplayer.room?.players ?? []);
    const a = ctx.multiplayer.onPlayerJoin(refresh);
    const b = ctx.multiplayer.onPlayerLeave(refresh);
    refresh();
    return () => {
      a();
      b();
    };
  }, [ctx]);
  return players;
}

/** Reçoit les messages des autres joueurs. */
export function useMessages<TMsg extends GameMessage>(
  ctx: GameContext<TMsg>,
  handler: (message: TMsg, from: Player) => void,
): void {
  const latest = useLatest(handler);
  useEffect(() => ctx.multiplayer.onMessage((m, from) => latest.current(m, from)), [ctx, latest]);
}

/** Taille du lot de scores échangé à chaque fois. */
const GOSSIP_SIZE = 20;

/**
 * Classement global "de proche en proche".
 * Pas de serveur de scores : chaque joueur envoie son top local aux autres
 * joueurs de la salle, et fusionne ce qu'il reçoit dans son propre classement.
 * Envoi automatique à l'arrivée dans la salle et quand un joueur arrive.
 * Appeler `share()` après `gameOver()` pour diffuser le nouveau score.
 *
 * Limites assumées : chacun ne voit que les scores des gens croisés
 * (directement ou indirectement), et un joueur malin peut tricher.
 */
export function useScoreGossip(ctx: AnyGameContext) {
  const [received, setReceived] = useState(0);

  const share = useCallback(async () => {
    const channel = systemChannelOf(ctx.multiplayer);
    if (!channel || !ctx.multiplayer.room) return;
    const entries = await ctx.storage.getLeaderboard(GOSSIP_SIZE);
    if (entries.length) channel.send({ type: '__scores', entries });
  }, [ctx]);

  useEffect(() => {
    const channel = systemChannelOf(ctx.multiplayer);
    if (!channel) return;
    const off = channel.onMessage(async (message) => {
      if (message.type !== '__scores' || !Array.isArray(message.entries)) return;
      const added = await ctx.storage.mergeScores(message.entries as ScoreEntry[]);
      if (added) setReceived((n) => n + added);
    });
    const offJoin = ctx.multiplayer.onPlayerJoin(() => void share());
    void share();
    return () => {
      off();
      offJoin();
    };
  }, [ctx, share]);

  /** `received` : nombre de scores appris des autres depuis le début de la partie. */
  return { share, received };
}
