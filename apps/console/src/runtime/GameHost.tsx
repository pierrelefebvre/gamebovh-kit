import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import type { GameDefinition, GameResult, ScoreEntry } from '@gamebovh/sdk';
import { createGameSession } from '@gamebovh/sdk/runtime';
import { Frame, Hint, MenuList, type MenuItem } from '../screens/ui.tsx';
import { manifestOf, type CatalogEntry } from './catalog.ts';
import { useConsoleButtons, useServices } from './services.tsx';

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
        player: { id: services.playerId, nickname: services.settings.nickname || 'Joueur' },
      },
      {
        onGameOver: async (result) => {
          const { entry: saved, rank } = await storage.addScore({
            nickname: services.settings.nickname || 'Joueur',
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
            <h2>PAUSE</h2>
            <MenuList
              onBack={() => setOverlay(null)}
              items={[
                { label: 'Reprendre', onSelect: () => setOverlay(null) },
                ...(!inRoom ? [{ label: 'Recommencer', onSelect: onReplay }] : []),
                inRoom
                  ? { label: 'Quitter la salle', onSelect: onQuit }
                  : { label: 'Retour au menu', onSelect: onQuit },
              ]}
            />
            {inRoom && <p className="small dim">La partie continue pour les autres.</p>}
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
  const { result, rank, record, top } = overlay;
  const items: MenuItem[] = inRoom
    ? [
        { label: 'Retour à la salle', onSelect: onLobby },
        { label: 'Quitter la salle', onSelect: onQuit },
      ]
    : [
        { label: 'Rejouer', onSelect: onReplay },
        { label: 'Menu', onSelect: onQuit },
      ];
  const outcome = result.outcome === 'win' ? 'GAGNÉ !' : result.outcome === 'lose' ? 'PERDU' : result.outcome === 'draw' ? 'ÉGALITÉ' : 'FIN DE PARTIE';

  return (
    <div className="overlay">
      <div className="overlay-box results">
        <h2>{outcome}</h2>
        <div className="result-score">{result.display ?? result.score}</div>
        <div className="small">{record ? 'NOUVEAU RECORD PERSO !' : `Rang local : ${rank}`}</div>
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
  useConsoleButtons((b) => (b === 'b' || b === 'a') && onQuit());
  return (
    <Frame title="ERREUR DE CARTOUCHE" footer={<Hint>B menu</Hint>} snow={false}>
      <p className="small">{name} a planté.</p>
      <pre className="crash">{message}</pre>
      <p className="small dim">Détails dans la console du navigateur.</p>
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
