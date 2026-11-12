import { useEffect, useState } from 'react';
import type { GameDefinition, ScoreEntry } from '@gamebovh/sdk';
import { loadGame, type CatalogEntry } from '../runtime/catalog.ts';
import { useConsoleButtons, useServices } from '../runtime/services.tsx';
import { Frame, Hint, MenuList, playersLabel, type MenuItem } from './ui.tsx';

/** Fiche d'une cartouche : règles, choix solo / salle, scores. */
export function CartridgeScreen({
  entry,
  onBack,
  onSolo,
  onCreate,
  onJoin,
  onScores,
}: {
  entry: CatalogEntry;
  onBack: () => void;
  onSolo: (def: GameDefinition) => void;
  onCreate: (def: GameDefinition) => void;
  onJoin: (def: GameDefinition) => void;
  onScores: (def: GameDefinition) => void;
}) {
  const [def, setDef] = useState<GameDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadGame(entry).then(
      (d) => alive && setDef(d),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [entry]);

  useConsoleButtons((b) => b === 'b' && (error || !def) && onBack());

  const items: MenuItem[] = [];
  if (def) {
    if (entry.minPlayers === 1) items.push({ label: 'Solo', onSelect: () => onSolo(def) });
    if (entry.maxPlayers > 1) {
      items.push({ label: 'Créer une salle', onSelect: () => onCreate(def) });
      items.push({ label: 'Rejoindre une salle', onSelect: () => onJoin(def) });
    }
    items.push({ label: 'Scores', onSelect: () => onScores(def) });
  }

  return (
    <Frame
      title={
        <>
          <span>{entry.name}</span>
          <span className="title-right">{playersLabel(entry.minPlayers, entry.maxPlayers)}</span>
        </>
      }
      footer={
        <>
          <Hint>A valider</Hint>
          <Hint>B retour</Hint>
        </>
      }
    >
      <div className="cart-meta">
        par {entry.team} · v{entry.version}
      </div>
      <p className="cart-desc">{entry.description}</p>
      {def?.howToPlay && (
        <ul className="how">
          {def.howToPlay.slice(0, 3).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      {error && <p className="error-text">Cartouche illisible : {error}</p>}
      {!def && !error && <p className="loading">Chargement...</p>}
      {def && <MenuList items={items} onBack={onBack} className="compact" />}
    </Frame>
  );
}

/** Classement local d'un jeu (inclut les scores reçus des autres joueurs). */
export function ScoresScreen({
  entry,
  def,
  onBack,
}: {
  entry: CatalogEntry;
  def: GameDefinition;
  onBack: () => void;
}) {
  const services = useServices();
  const [scores, setScores] = useState<ScoreEntry[] | null>(null);

  useEffect(() => {
    services.storageFor(entry.id, def.scoreOrder).getLeaderboard(10).then(setScores);
  }, [services, entry, def]);

  useConsoleButtons((b) => {
    if (b === 'b' || b === 'a') {
      services.audio.play('back');
      onBack();
    }
  });

  return (
    <Frame title={`${entry.name} TOP 10`} footer={<Hint>B retour</Hint>}>
      {scores === null ? (
        <p className="loading">Chargement...</p>
      ) : scores.length === 0 ? (
        <p className="empty">Aucun score. Sois le premier !</p>
      ) : (
        <ol className="scores">
          {scores.map((s, i) => (
            <li key={s.id} className={s.playerId === services.playerId ? 'is-me' : ''}>
              <span className="rank">{i + 1}.</span>
              <span className="who">{s.nickname}</span>
              <span className="pts">{s.display ?? s.score}</span>
            </li>
          ))}
        </ol>
      )}
    </Frame>
  );
}
