import { useEffect, useRef, useState } from 'react';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  normalizeRoomCode,
} from '@gamebovh/protocol';
import { PLAYER_COLORS, type GameTheme, type Room } from '@gamebovh/sdk';
import type { CatalogEntry } from '../runtime/catalog.ts';
import { useConsoleButtons, useServices } from '../runtime/services.tsx';
import { Frame, Hint } from './ui.tsx';
import { RoomQr, roomLink } from './RoomQr.tsx';
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
  theme,
  initialCode,
  onBack,
  onJoined,
}: {
  entry: CatalogEntry;
  theme?: GameTheme;
  /** Code déjà connu (lien d'un QR code) : la salle est rejointe tout de suite. */
  initialCode?: string;
  onBack: () => void;
  onJoined: () => void;
}) {
  const { net, audio } = useServices();
  const t = useT();
  const [letters, setLetters] = useState<number[]>(() => {
    const start = normalizeRoomCode(initialCode ?? '');
    return Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => Math.max(0, ROOM_CODE_ALPHABET.indexOf(start[i] ?? 'A')));
  });
  const [pos, setPos] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const code = letters.map((i) => ROOM_CODE_ALPHABET[i]).join('');
  const input = useRef<HTMLInputElement>(null);

  // Valeurs à jour pour les écouteurs du clavier.
  const latest = useRef({ letters, pos, busy });
  latest.current = { letters, pos, busy };
  const latestBack = useRef(onBack);
  latestBack.current = onBack;

  const submit = async (value = code) => {
    if (latest.current.busy) return;
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

  /** Lettres tapées au clavier (ordinateur ou téléphone), une ou plusieurs d'un coup : à la dernière case, on rejoint. */
  const typeLetters = (indexes: number[]) => {
    if (!indexes.length) return;
    let { letters: next, pos: p } = latest.current;
    next = [...next];
    let complete = false;
    for (const idx of indexes) {
      next[p] = idx;
      if (p >= ROOM_CODE_LENGTH - 1) {
        complete = true;
        break;
      }
      p++;
    }
    latest.current = { ...latest.current, letters: next, pos: p };
    setLetters(next);
    setPos(p);
    audio.play('blip');
    if (complete) void submit(next.map((i) => ROOM_CODE_ALPHABET[i]).join(''));
  };
  const eraseLetter = () => setPos((p) => Math.max(0, p - 1));

  // Lien d'un QR code : on rejoint sans attendre.
  useEffect(() => {
    if (initialCode && normalizeRoomCode(initialCode).length === ROOM_CODE_LENGTH) void submit(normalizeRoomCode(initialCode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Clavier d'ordinateur (et clavier d'iPhone, qui envoie aussi les touches) : taper le code.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || latest.current.busy) return;
      if (e.key === 'Backspace' || e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        // Échap, ou retour arrière sur la première case : on quitte l'écran (Z / W tapent des lettres ici).
        if (e.key === 'Escape' || latest.current.pos === 0) latestBack.current();
        else eraseLetter();
        return;
      }
      if (e.key.length !== 1) return;
      const idx = ROOM_CODE_ALPHABET.indexOf(normalizeRoomCode(e.key));
      if (idx < 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      typeLetters([idx]);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Clavier du téléphone (Android n'envoie pas les touches) : on lit ce qui arrive dans le champ caché. */
  const onSoftInput = () => {
    const el = input.current;
    if (!el) return;
    const typed = normalizeRoomCode(el.value);
    el.value = '';
    typeLetters([...typed].map((ch) => ROOM_CODE_ALPHABET.indexOf(ch)).filter((idx) => idx >= 0));
  };

  /** Toucher le code ouvre le clavier du téléphone. */
  const openKeyboard = (slot: number) => {
    setPos(slot);
    input.current?.focus({ preventScroll: true });
  };

  return (
    <Frame
      theme={theme}
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
          <button type="button" key={i} className={`code-slot${i === pos ? ' is-selected' : ''}`} onClick={() => openKeyboard(i)}>
            <span className="arrow">▲</span>
            {ROOM_CODE_ALPHABET[v]}
            <span className="arrow">▼</span>
          </button>
        ))}
        <input
          ref={input}
          className="code-keyboard"
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-label={t.enterCode}
          onInput={onSoftInput}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
      </div>
      <p className="center tiny dim">{t.tapToType}</p>
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
  theme,
  create,
  onLeave,
  onStart,
}: {
  entry: CatalogEntry;
  theme?: GameTheme;
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
      theme={theme}
      title={t.roomTitle(entry.name)}
      footer={
        <>
          {canStart && <Hint>{t.hintStart}</Hint>}
          <Hint>{t.hintLeave}</Hint>
        </>
      }
    >
      <div className="lobby-row">
        <div className="lobby-main">
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
        </div>
        {room && players.length < entry.maxPlayers && <RoomQr text={roomLink(room.code, entry.id)} label={t.scanToJoin} />}
      </div>
      <p className={`center small${error ? ' error-text' : ' blink'}`}>{info}</p>
    </Frame>
  );
}
