import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import type { GameDefinition, GameResult, ScoreEntry } from '@gamebovh/sdk';
import { createGameSession } from '@gamebovh/sdk/runtime';
import { Frame, Hint, MenuList, type MenuItem } from '../screens/ui.tsx';
import { manifestOf, type CatalogEntry } from './catalog.ts';
import { useConsoleButtons, useServices } from './services.tsx';
import { useT } from '../i18n.ts';

type Overlay =
  | { kind: 'pause' }
  | {
      kind: 'results';
      result: GameResult;
      entry: ScoreEntry;
      rank: number;
      record: boolean;
      top: ScoreEntry[];
    }
  | null;

export interface GameHostProps {
  entry: CatalogEntry;
  def: GameDefinition;
  inRoom: boolean;
  seed: number;
  /** Abonnement à la demande de menu (Échap, Start + Select). */
  subscribeMenu: (cb: () => void) => () => void;
  onQuit: () => void;
  onReplay: () => void;
  onLobby: () => void;
}

/**
 * Fait tourner une cartouche : construit son `ctx`, gère la pause
 * (perte de focus, menu), l'écran de résultats et les plantages.
 * Un nouveau GameHost (nouvelle `key`) = une nouvelle partie propre.
 */
export function GameHost(props: GameHostProps) {
  const { entry, def, inRoom, seed, subscribeMenu, onQuit, onReplay, onLobby } = props;
  const services = useServices();
  const t = useT();
  const [overlay, setOverlay] = useState<Overlay>(null);

  const [session] = useState(() => {
    const storage = services.storageFor(entry.id, def.scoreOrder);
    return createGameSession(
      manifestOf(entry),
      {
        input: services.input,
        audio: services.audio,
        net: services.net,
        storage,
        player: { id: services.playerId, nickname: services.settings.nickname || t.defaultPlayer },
        lang: services.lang,
      },
      {
        onGameOver: async (result) => {
          const { entry: saved, rank } = await storage.addScore({
            nickname: services.settings.nickname || t.defaultPlayer,
            score: result.score,
            display: result.display,
          });
          const best = await storage.getPersonalBest();
          const top = await storage.getLeaderboard(3);
          setOverlay({ kind: 'results', result, entry: saved, rank, record: best?.id === saved.id, top });
          return saved;
        },
        onExit: () => onQuit(),
      },
      inRoom,
      seed,
    );
  });

  useEffect(() => () => session.dispose(), [session]);
  useEffect(() => session.setPaused(overlay !== null), [session, overlay]);

  // Pause automatique quand l'onglet perd le focus.
  useEffect(() => {
    const pause = () => setOverlay((o) => o ?? { kind: 'pause' });
    const onVisibility = () => document.hidden && pause();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', pause);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', pause);
    };
  }, []);

  useEffect(
    () =>
      subscribeMenu(() => {
        services.audio.play('select');
        setOverlay((o) => (o === null ? { kind: 'pause' } : o.kind === 'pause' ? null : o));
      }),
    [subscribeMenu, services],
  );

  const Game = def.component;

  return (
    <div className="game-host">
      <CartridgeBoundary onQuit={onQuit} name={entry.name}>
        <Game ctx={session.ctx} />
      </CartridgeBoundary>

      {overlay?.kind === 'pause' && (
        <div className="overlay">
          <div className="overlay-box">
            <h2>{t.pause}</h2>
            <MenuList
              onBack={() => setOverlay(null)}
              items={[
                { label: t.resume, onSelect: () => setOverlay(null) },
                ...(!inRoom ? [{ label: t.restart, onSelect: onReplay }] : []),
                inRoom
                  ? { label: t.leaveRoom, onSelect: onQuit }
                  : { label: t.backToMenu, onSelect: onQuit },
              ]}
            />
            {inRoom && <p className="small dim">{t.gameGoesOn}</p>}
          </div>
        </div>
      )}

      {overlay?.kind === 'results' && (
        <ResultsOverlay overlay={overlay} inRoom={inRoom} onReplay={onReplay} onLobby={onLobby} onQuit={onQuit} />
      )}
    </div>
  );
}

function ResultsOverlay({
  overlay,
  inRoom,
  onReplay,
  onLobby,
  onQuit,
}: {
  overlay: Extract<Overlay, { kind: 'results' }>;
  inRoom: boolean;
  onReplay: () => void;
  onLobby: () => void;
  onQuit: () => void;
}) {
  const { playerId } = useServices();
  const t = useT();
  const { result, rank, record, top } = overlay;
  const items: MenuItem[] = inRoom
    ? [
        { label: t.backToRoom, onSelect: onLobby },
        { label: t.leaveRoom, onSelect: onQuit },
      ]
    : [
        { label: t.replay, onSelect: onReplay },
        { label: t.menu, onSelect: onQuit },
      ];
  const outcome = result.outcome === 'win' ? t.win : result.outcome === 'lose' ? t.lose : result.outcome === 'draw' ? t.draw : t.gameOver;

  return (
    <div className="overlay">
      <div className="overlay-box results">
        <h2>{outcome}</h2>
        <div className="result-score">{result.display ?? result.score}</div>
        <div className="small">{record ? t.newRecord : t.localRank(rank)}</div>
        <ol className="scores mini">
          {top.map((s, i) => (
            <li key={s.id} className={s.playerId === playerId ? 'is-me' : ''}>
              <span className="rank">{i + 1}.</span>
              <span className="who">{s.nickname}</span>
              <span className="pts">{s.display ?? s.score}</span>
            </li>
          ))}
        </ol>
        <MenuList items={items} />
      </div>
    </div>
  );
}

/* ---------- Plantage d'une cartouche ---------- */

function CrashScreen({ name, message, onQuit }: { name: string; message: string; onQuit: () => void }) {
  const t = useT();
  useConsoleButtons((b) => (b === 'b' || b === 'a') && onQuit());
  return (
    <Frame title={t.crashTitle} footer={<Hint>{t.hintMenu}</Hint>} snow={false}>
      <p className="small">{t.crashed(name)}</p>
      <pre className="crash">{message}</pre>
      <p className="small dim">{t.crashDetails}</p>
    </Frame>
  );
}

class CartridgeBoundary extends Component<
  { children: ReactNode; onQuit: () => void; name: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[gamebovh] cartridge "${this.props.name}" crashed`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <CrashScreen name={this.props.name} message={this.state.error.message} onQuit={this.props.onQuit} />;
    }
    return this.props.children;
  }
}
