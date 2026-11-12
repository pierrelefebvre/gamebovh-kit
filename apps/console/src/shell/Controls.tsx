import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Button } from '@gamebovh/sdk';
import { useButtonDown, useServices } from '../runtime/services.tsx';

const TAP_VIBRATION_MS = 8;

/** Bouton tactile (A, B, Start, Select). Multi-touch : chaque doigt est une source. */
export function PadButton({
  button,
  label,
  className,
  keycap,
}: {
  button: Button;
  label: string;
  className: string;
  /** Touche du clavier correspondante, affichée sur ordinateur. */
  keycap?: string;
}) {
  const { input, audio } = useServices();
  const down = useButtonDown(button);
  const sources = useRef(new Set<number>());

  const press = (e: ReactPointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    sources.current.add(e.pointerId);
    audio.unlock();
    audio.vibrate(TAP_VIBRATION_MS);
    input.press(button, `touch:${e.pointerId}`);
  };
  const release = (e: ReactPointerEvent) => {
    if (!sources.current.delete(e.pointerId)) return;
    input.release(button, `touch:${e.pointerId}`);
  };

  return (
    <button
      type="button"
      className={`${className}${down ? ' is-down' : ''}`}
      aria-label={label}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span>{label}</span>
      {keycap && <kbd className="keycap">{keycap}</kbd>}
    </button>
  );
}

const DIRS: Button[] = ['up', 'right', 'down', 'left'];

/**
 * Croix directionnelle : la direction suit la position du doigt
 * (on peut glisser d'une direction à l'autre, diagonales comprises).
 */
export function DPad() {
  const { input, audio } = useServices();
  const ref = useRef<HTMLDivElement>(null);
  const active = useRef(new Map<number, Set<Button>>());
  const [, force] = useState(0);
  const up = useButtonDown('up');
  const down = useButtonDown('down');
  const left = useButtonDown('left');
  const right = useButtonDown('right');

  const directionsAt = (clientX: number, clientY: number): Set<Button> => {
    const rect = ref.current!.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const dead = rect.width * 0.12;
    const result = new Set<Button>();
    if (Math.hypot(dx, dy) < dead) return result;
    const angle = Math.atan2(dy, dx); // 0 = droite, PI/2 = bas
    const sector = Math.round(angle / (Math.PI / 4)); // -4..4, 8 secteurs
    const map: Record<number, Button[]> = {
      0: ['right'],
      1: ['right', 'down'],
      2: ['down'],
      3: ['down', 'left'],
      4: ['left'],
      [-4]: ['left'],
      [-3]: ['left', 'up'],
      [-2]: ['up'],
      [-1]: ['up', 'right'],
    };
    for (const b of map[sector] ?? []) result.add(b);
    return result;
  };

  const apply = (pointerId: number, next: Set<Button>) => {
    const prev = active.current.get(pointerId) ?? new Set<Button>();
    const source = `dpad:${pointerId}`;
    for (const b of DIRS) {
      if (prev.has(b) && !next.has(b)) input.release(b, source);
      if (!prev.has(b) && next.has(b)) {
        input.press(b, source);
        audio.vibrate(TAP_VIBRATION_MS);
      }
    }
    if (next.size) active.current.set(pointerId, next);
    else active.current.delete(pointerId);
    force((n) => n + 1);
  };

  const onDown = (e: ReactPointerEvent) => {
    e.preventDefault();
    ref.current!.setPointerCapture?.(e.pointerId);
    audio.unlock();
    apply(e.pointerId, directionsAt(e.clientX, e.clientY));
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!active.current.has(e.pointerId) && e.buttons === 0) return;
    apply(e.pointerId, directionsAt(e.clientX, e.clientY));
  };
  const onUp = (e: ReactPointerEvent) => apply(e.pointerId, new Set());

  const cls = (on: boolean) => (on ? ' is-down' : '');
  return (
    <div
      ref={ref}
      className="dpad"
      role="group"
      aria-label="Croix directionnelle"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onLostPointerCapture={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className={`dpad-arm dpad-up${cls(up)}`} />
      <div className={`dpad-arm dpad-down${cls(down)}`} />
      <div className={`dpad-arm dpad-left${cls(left)}`} />
      <div className={`dpad-arm dpad-right${cls(right)}`} />
      <div className="dpad-center" />
    </div>
  );
}
