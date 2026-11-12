import { useEffect, useRef, useState } from 'react';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  normalizeRoomCode,
} from '@gamebovh/protocol';
import { PLAYER_COLORS, type Room } from '@gamebovh/sdk';
import type { CatalogEntry } from '../runtime/catalog.ts';
import { useConsoleButtons, useServices } from '../runtime/services.tsx';
import { Frame, Hint } from './ui.tsx';


const ERRORS: Record<string, string> = {
  room_not_found: "Cette salle n'existe pas.",
  room_full: 'Cette salle est pleine (4 joueurs max).',
  wrong_game: 'Cette salle est pour un autre jeu.',
  too_many_rooms: 'Serveur complet, réessaie dans un instant.',
  timeout: 'Le serveur ne répond pas.',
  offline: 'Impossible de joindre le serveur.',
  rate_limited: 'Trop de messages, doucement !',
};

/** Message d'erreur réseau en français. */
function errorText(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if (code && ERRORS[code]) return ERRORS[code];
  return 'Erreur de connexion.';
}

/** Salle courante, à jour en temps réel. */
function useRoom(): Room | null {
  const { net } = useServices();
  const [room, setRoom] = useState(net.room);
  useEffect(() => net.on('room', setRoom), [net]);
  return room;
}

/** Saisie d'un code de salle à la croix (ou au clavier). */
export function JoinScreen({
  entry,
  onBack,
  onJoined,
}: {
  entry: CatalogEntry;
  onBack: () => void;
  onJoined: () => void;
}) {
  const { net, audio } = useServices();
  const [letters, setLetters] = useState<number[]>(() => Array(ROOM_CODE_LENGTH).fill(0));
  const [pos, setPos] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const code = letters.map((i) => ROOM_CODE_ALPHABET[i]).join('');

  const submit = async (value = code) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await net.joinRoom(value, entry.id);
      audio.play('confirm');
      onJoined();
    } catch (e) {
      audio.play('back');
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const bump = (delta: number) =>
    setLetters((l) => l.map((v, i) => (i === pos ? (v + delta + ROOM_CODE_ALPHABET.length) % ROOM_CODE_ALPHABET.length : v)));

  useConsoleButtons((b) => {
    if (busy) return;
    if (b === 'up') bump(1);
    if (b === 'down') bump(-1);
    if (b === 'left') setPos((p) => Math.max(0, p - 1));
    if (b === 'right') setPos((p) => Math.min(ROOM_CODE_LENGTH - 1, p + 1));
    if (b === 'a') {
      if (pos < ROOM_CODE_LENGTH - 1) setPos(pos + 1);
      else void submit();
    }
    if (b === 'start') void submit();
    if (b === 'b') {
      if (pos > 0) setPos(pos - 1);
      else onBack();
    }
    if (b !== 'start') audio.play('blip');
  });

  // Clavier physique : taper le code.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.key.length !== 1) return;
      const ch = normalizeRoomCode(e.key);
      const idx = ROOM_CODE_ALPHABET.indexOf(ch);
      if (idx < 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setLetters((l) => l.map((v, i) => (i === pos ? idx : v)));
      setPos((p) => Math.min(ROOM_CODE_LENGTH - 1, p + 1));
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [pos]);

  return (
    <Frame
      title={`REJOINDRE ${entry.name}`}
      footer={
        <>
          <Hint>↑↓ lettre</Hint>
          <Hint>START rejoindre</Hint>
          <Hint>B retour</Hint>
        </>
      }
    >
      <p className="center small">Entre le code de la salle</p>
      <div className="code-input">
        {letters.map((v, i) => (
          <button
            type="button"
            key={i}
            className={`code-slot${i === pos ? ' is-selected' : ''}`}
            onClick={() => setPos(i)}
          >
            <span className="arrow">▲</span>
            {ROOM_CODE_ALPHABET[v]}
            <span className="arrow">▼</span>
          </button>
        ))}
      </div>
      <button type="button" className="code-go" onClick={() => void submit()} disabled={busy}>
        {busy ? 'CONNEXION...' : 'REJOINDRE'}
      </button>
      {error && <p className="error-text center">{error}</p>}
    </Frame>
  );
}

/**
 * Salle d'attente : code à partager, joueurs présents.
 * Si `create` est vrai, la salle est créée à l'arrivée sur l'écran.
 */
export function LobbyScreen({
  entry,
  create,
  onLeave,
  onStart,
}: {
  entry: CatalogEntry;
  create: boolean;
  onLeave: () => void;
  onStart: () => void;
}) {
  const { net, audio } = useServices();
  const room = useRoom();
  const [status, setStatus] = useState(net.status);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => net.on('status', setStatus), [net]);

  const requested = useRef(false);
  useEffect(() => {
    if (!create || net.room || requested.current) return;
    requested.current = true;
    net.createRoom(entry.id).catch((e) => setError(errorText(e)));
  }, [create, entry, net]);

  const players = room?.players ?? [];
  const me = players.find((p) => p.isMe);
  const canStart = !!me?.isHost && players.length >= entry.minPlayers;

  useConsoleButtons((b) => {
    if (b === 'b') {
      audio.play('back');
      net.leaveRoom();
      onLeave();
    }
    if ((b === 'a' || b === 'start') && canStart) {
      audio.play('go');
      onStart();
    } else if (b === 'a' || b === 'start') {
      audio.play('back');
    }
  });

  let info: string;
  if (error) info = error;
  else if (!room) info = status === 'connecting' ? 'Connexion...' : 'Création de la salle...';
  else if (players.length < entry.minPlayers) info = `Encore ${entry.minPlayers - players.length} joueur(s) attendu(s)`;
  else if (me?.isHost) info = 'Appuie sur A pour lancer';
  else info = "En attente de l'hôte";

  return (
    <Frame
      title={`SALLE ${entry.name}`}
      footer={
        <>
          {canStart && <Hint>A lancer</Hint>}
          <Hint>B quitter</Hint>
        </>
      }
    >
      <div className="room-code">
        <span className="small">CODE</span>
        <strong>{room?.code ?? '····'}</strong>
      </div>
      <ul className="players">
        {Array.from({ length: entry.maxPlayers }, (_, slot) => {
          const p = players.find((x) => x.slot === slot);
          return (
            <li key={slot} className={p ? '' : 'is-empty'}>
              <span className="slot-dot" style={{ background: p ? PLAYER_COLORS[slot] : undefined }} />
              <span className="who">{p ? p.nickname : '...'}</span>
              <span className="tags">
                {p?.isHost && 'HÔTE'}
                {p?.isMe && ' TOI'}
              </span>
            </li>
          );
        })}
      </ul>
      <p className={`center small${error ? ' error-text' : ' blink'}`}>{info}</p>
    </Frame>
  );
}
