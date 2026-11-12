import { useEffect, useState } from 'react';
import type { ScoreEntry } from '@gamebovh/sdk';
import { loadGame, type CatalogEntry } from '../runtime/catalog.ts';
import { useConsoleButtons, useServices } from '../runtime/services.tsx';
import { Snow } from './ui.tsx';
import { useT, type Strings } from '../i18n.ts';

/** Couleurs d'étiquette de cartouche, une par position dans le catalogue. */
const LABELS = [
  { sky: '#bfe3ff', far: '#1d4fd8', near: '#0b1d8a', a: '#e8384f', b: '#3aa0ff' },
  { sky: '#ffe2b8', far: '#3a5bd9', near: '#152a9e', a: '#2e9e5b', b: '#ffb52e' },
  { sky: '#d9ccff', far: '#5b3fd6', near: '#2b1a8f', a: '#ff6b3d', b: '#2ec4d6' },
];

export function playersTag(e: CatalogEntry, t: Strings): string {
  if (e.maxPlayers === 1) return t.solo;
  if (e.minPlayers === e.maxPlayers) return t.playersN(e.minPlayers);
  return t.playersRange(e.minPlayers, e.maxPlayers);
}

/** Étiquette illustrée de la cartouche : montagnes, neige et deux petits skieurs. */
function CartridgeArt({ index }: { index: number }) {
  const c = LABELS[index % LABELS.length];
  return (
    <div className="cart-art" style={{ background: c.sky }}>
      <span className="mount m1" style={{ background: c.far }} />
      <span className="mount m2" style={{ background: c.near }} />
      <span className="mount m3" style={{ background: c.far }} />
      <span className="peak" />
      <span className="ground" />
      <span className="figure f1" style={{ background: c.a }} />
      <span className="figure f2" style={{ background: c.b }} />
    </div>
  );
}

/** Menu des cartouches en carrousel : gauche / droite pour choisir. */
export function MenuScreen({
  games,
  errors,
  initial,
  onPick,
  onRoom,
  onScores,
  onSettings,
}: {
  games: CatalogEntry[];
  errors: string[];
  initial: number;
  onPick: (entry: CatalogEntry, index: number) => void;
  onRoom: (entry: CatalogEntry, index: number) => void;
  onScores: (entry: CatalogEntry, index: number) => void;
  onSettings: () => void;
}) {
  const services = useServices();
  const { audio } = services;
  const t = useT();
  const [index, setIndex] = useState(Math.min(initial, Math.max(0, games.length - 1)));
  const [best, setBest] = useState<ScoreEntry | null>(null);
  const entry = games[index];

  // Meilleur score personnel de la cartouche affichée.
  useEffect(() => {
    setBest(null);
    if (!entry) return;
    let alive = true;
    loadGame(entry)
      .then((def) => services.storageFor(entry.id, def.scoreOrder).getPersonalBest())
      .then((b) => alive && setBest(b ?? null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [entry, services]);

  const move = (delta: number) => {
    if (games.length < 2) return;
    setIndex((i) => (i + delta + games.length) % games.length);
    audio.play('select');
  };

  useConsoleButtons((b) => {
    if (b === 'left' || b === 'up') move(-1);
    else if (b === 'right' || b === 'down') move(1);
    else if (b === 'select') {
      audio.play('confirm');
      onSettings();
    } else if (!entry) return;
    else if (b === 'a') {
      audio.play('confirm');
      onPick(entry, index);
    } else if (b === 'b') {
      audio.play('confirm');
      onScores(entry, index);
    } else if (b === 'start') {
      if (entry.maxPlayers > 1) {
        audio.play('confirm');
        onRoom(entry, index);
      } else audio.play('back');
    }
  });

  if (!entry) {
    return (
      <div className="carousel">
        <Snow />
        <div className="carousel-title">{t.chooseCartridge}</div>
        <div className="empty">
          <p>{t.noCartridge}</p>
          <p className="small">{t.noCartridgeHelp}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="carousel">
      <Snow count={18} />
      <div className="carousel-title">{t.chooseCartridge}</div>
      <div className="carousel-count">
        ◆ {index + 1} / {games.length} ◆
      </div>

      <div className="carousel-stage">
        <button type="button" className="side-panel left" aria-label={t.previous} onClick={() => move(-1)}>
          ◀
        </button>
        <button
          type="button"
          key={entry.id}
          className="cartridge"
          onClick={() => {
            audio.play('confirm');
            onPick(entry, index);
          }}
        >
          <span className="cartridge-ridges" />
          <span className="cartridge-label">
            <CartridgeArt index={index} />
            <span className="cartridge-name">{entry.name}</span>
          </span>
          <span className="cartridge-team">{entry.team}</span>
        </button>
        <button type="button" className="side-panel right" aria-label={t.next} onClick={() => move(1)}>
          ▶
        </button>
      </div>

      <div className="tags">
        <span className="tag red">{playersTag(entry, t)}</span>
        <span className="tag blue">{entry.maxPlayers > 1 ? t.online : t.offline}</span>
        <span className="tag gold">{best ? t.record(String(best.display ?? best.score)) : t.noScore}</span>
      </div>

      <p className="carousel-desc">{entry.description}</p>

      <div className="carousel-hints">
        <span>
          <i className="chip">A</i>{t.play}
        </span>
        <span>
          <i className="chip">B</i>{t.scores}
        </span>
        {entry.maxPlayers > 1 && <span className="gold-text">{t.roomShortcut}</span>}
        <span className="dim">{t.settingsShortcut}</span>
      </div>

      {errors.length > 0 && <div className="catalog-errors">{t.catalogErrors(errors.length)}</div>}
    </div>
  );
}
