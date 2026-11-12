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
import { useT, type Strings } from '../i18n.ts';


/** Message d'erreur réseau dans la langue de la console. */
function errorText(e: unknown, t: Strings): string {
  const code = (e as { code?: string })?.code;
  const errors: Record<string, string> = {
    room_not_found: t.errRoomNotFound,
    room_full: t.errRoomFull,
    wrong_game: t.errWrongGame,
    too_many_rooms: t.errTooManyRooms,
    timeout: t.errTimeout,
    offline: t.errOffline,
    rate_limited: t.errRateLimited,
  };
  return (code && errors[code]) || t.errGeneric;
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
  const t = useT();
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
      setError(errorText(e, t));
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
      title={t.joinTitle(entry.name)}
      footer={
        <>
          <Hint>{t.hintLetter}</Hint>
          <Hint>{t.hintJoin}</Hint>
          <Hint>{t.hintBack}</Hint>
        </>
      }
    >
      <p className="center small">{t.enterCode}</p>
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
        {busy ? t.connectingCaps : t.joinCaps}
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
  const t = useT();
  const room = useRoom();
  const [status, setStatus] = useState(net.status);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => net.on('status', setStatus), [net]);

  const requested = useRef(false);
  useEffect(() => {
    if (!create || net.room || requested.current) return;
    requested.current = true;
    net.createRoom(entry.id).catch((e) => setError(errorText(e, t)));
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
  else if (!room) info = status === 'connecting' ? t.connecting : t.creatingRoom;
  else if (players.length < entry.minPlayers) info = t.waitingPlayers(entry.minPlayers - players.length);
  else if (me?.isHost) info = t.pressAToStart;
  else info = t.waitingHost;

  return (
    <Frame
      title={t.roomTitle(entry.name)}
      footer={
        <>
          {canStart && <Hint>{t.hintStart}</Hint>}
          <Hint>{t.hintLeave}</Hint>
        </>
      }
    >
      <div className="room-code">
        <span className="small">{t.code}</span>
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
                {p?.isHost && t.host}
                {p?.isMe && ` ${t.you}`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className={`center small${error ? ' error-text' : ' blink'}`}>{info}</p>
    </Frame>
  );
}
