import { useMemo, useState, type ReactNode } from 'react';
import { useConsoleButtons, useServices } from '../runtime/services.tsx';

/** Neige qui tombe en fond d'écran (purement décoratif). */
export function Snow({ count = 26 }: { count?: number }) {
  const flakes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: (i * 37) % 240,
        delay: -((i * 1.7) % 9),
        duration: 6 + ((i * 13) % 7),
        size: i % 5 === 0 ? 2 : 1,
        drift: (i % 3) - 1,
      })),
    [count],
  );
  return (
    <div className="snow" aria-hidden="true">
      {flakes.map((f, i) => (
        <span
          key={i}
          style={{
            left: f.left,
            width: f.size,
            height: f.size,
            animationDelay: `${f.delay}s`,
            animationDuration: `${f.duration}s`,
            ['--drift' as string]: `${f.drift * 12}px`,
          }}
        />
      ))}
    </div>
  );
}

/** Mise en page standard d'un écran de la console. */
export function Frame({
  title,
  children,
  footer,
  snow = true,
}: {
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  snow?: boolean;
}) {
  return (
    <div className="frame">
      {snow && <Snow />}
      {title && <header className="frame-title">{title}</header>}
      <div className="frame-body">{children}</div>
      {footer && <footer className="frame-footer">{footer}</footer>}
    </div>
  );
}

export interface MenuItem {
  label: ReactNode;
  detail?: ReactNode;
  disabled?: boolean;
  onSelect: () => void;
}

/** Liste navigable à la croix (haut / bas), A pour valider, B pour revenir. Cliquable aussi. */
export function MenuList({
  items,
  active = true,
  onBack,
  initial = 0,
  onMove,
  className = '',
}: {
  items: MenuItem[];
  active?: boolean;
  onBack?: () => void;
  initial?: number;
  onMove?: (index: number) => void;
  className?: string;
}) {
  const { audio } = useServices();
  const [index, setIndex] = useState(Math.min(initial, Math.max(0, items.length - 1)));
  const current = Math.min(index, Math.max(0, items.length - 1));

  const move = (delta: number) => {
    if (!items.length) return;
    const next = (current + delta + items.length) % items.length;
    setIndex(next);
    onMove?.(next);
    audio.play('select');
  };
  const choose = (i: number) => {
    const item = items[i];
    if (!item) return;
    if (item.disabled) {
      audio.play('back');
      return;
    }
    audio.play('confirm');
    item.onSelect();
  };

  useConsoleButtons((b) => {
    if (b === 'up') move(-1);
    else if (b === 'down') move(1);
    else if (b === 'a' || b === 'start') choose(current);
    else if (b === 'b' && onBack) {
      audio.play('back');
      onBack();
    }
  }, active);

  return (
    <ul className={`menu ${className}`} role="menu">
      {items.map((item, i) => (
        <li
          key={i}
          role="menuitem"
          aria-disabled={item.disabled}
          className={`menu-item${i === current ? ' is-selected' : ''}${item.disabled ? ' is-disabled' : ''}`}
          onClick={() => {
            setIndex(i);
            choose(i);
          }}
        >
          <span className="menu-cursor">{i === current ? '▶' : ''}</span>
          <span className="menu-label">{item.label}</span>
          {item.detail !== undefined && <span className="menu-detail">{item.detail}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Petite légende des boutons en bas d'écran. */
export function Hint({ children }: { children: ReactNode }) {
  return <span className="hint">{children}</span>;
}

export function playersLabel(min: number, max: number): string {
  return min === max ? `${min}J` : `${min}-${max}J`;
}
