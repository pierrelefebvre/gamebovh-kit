import { useEffect, useRef, useState } from 'react';
import { NICKNAME_MAX_LENGTH, sanitizeNickname } from '@gamebovh/protocol';
import { useConsoleButtons, useServices } from '../runtime/services.tsx';
import { Frame, Hint } from './ui.tsx';

const ROWS = ['ABCDEFGHIJ', 'KLMNOPQRST', 'UVWXYZ0123', '456789-_.!'];
const DEL = 'EFF';
const OK = 'OK';
const GRID: string[][] = [...ROWS.map((r) => r.split('')), [DEL, ' ', OK]];

function randomName() {
  const names = ['SKIEUR', 'YETI', 'POUDREUSE', 'FLOCON', 'PISTE', 'CHALET'];
  return `${names[Math.floor(Math.random() * names.length)]}${Math.floor(Math.random() * 90 + 10)}`;
}

/** Choix du pseudo : clavier pixel à la croix, ou clavier physique. */
export function NicknameScreen({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const services = useServices();
  const [name, setName] = useState(services.settings.nickname || randomName());
  const [row, setRow] = useState(GRID.length - 1);
  const [col, setCol] = useState(2);

  const save = () => {
    const clean = sanitizeNickname(name);
    if (!clean) {
      services.audio.play('back');
      return;
    }
    services.update({ nickname: clean });
    services.audio.play('confirm');
    onDone();
  };

  const type = (key: string) => {
    if (key === DEL) setName((n) => n.slice(0, -1));
    else if (key === OK) save();
    else setName((n) => (n.length < NICKNAME_MAX_LENGTH ? n + key : n));
    services.audio.play('blip');
  };

  useConsoleButtons((b) => {
    const r = GRID[row];
    if (b === 'up') setRow((v) => (v + GRID.length - 1) % GRID.length);
    if (b === 'down') setRow((v) => (v + 1) % GRID.length);
    if (b === 'left') setCol((v) => (v + r.length - 1) % r.length);
    if (b === 'right') setCol((v) => (v + 1) % r.length);
    if (b === 'a') type(GRID[row][Math.min(col, GRID[row].length - 1)]);
    if (b === 'b') {
      if (name) setName((n) => n.slice(0, -1));
      else onCancel?.();
    }
    if (b === 'start') save();
  });

  // Clavier physique : taper directement le pseudo. Écoute en phase de capture
  // pour que ces touches ne soient pas aussi comprises comme des boutons A / B.
  const latestSave = useRef(save);
  latestSave.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1 && /[a-z0-9\-_.!]/i.test(e.key)) {
        setName((n) => (n.length < NICKNAME_MAX_LENGTH ? n + e.key.toUpperCase() : n));
      } else if (e.key === 'Backspace') {
        setName((n) => n.slice(0, -1));
      } else if (e.key === 'Enter') {
        latestSave.current();
      } else {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, []);

  const c = Math.min(col, GRID[row].length - 1);
  return (
    <Frame
      title="TON PSEUDO"
      footer={
        <>
          <Hint>A écrire</Hint>
          <Hint>B effacer</Hint>
          <Hint>START valider</Hint>
        </>
      }
    >
      <div className="nick-value">
        {name}
        <span className="caret">_</span>
      </div>
      <div className="nick-grid">
        {GRID.map((keys, r) => (
          <div key={r} className="nick-row">
            {keys.map((k, i) => (
              <button
                key={i}
                type="button"
                className={`nick-key${k.length > 1 ? ' wide' : ''}${r === row && i === c ? ' is-selected' : ''}`}
                onClick={() => {
                  setRow(r);
                  setCol(i);
                  type(k);
                }}
              >
                {k === ' ' ? 'ESP' : k}
              </button>
            ))}
          </div>
        ))}
      </div>
    </Frame>
  );
}
