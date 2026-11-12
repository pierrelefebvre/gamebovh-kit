import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@gamebovh/sdk';
import { useServices, useSettings } from '../runtime/services.tsx';
import { useKeyLabels, useT } from '../i18n.ts';
import { SnowCap } from './Backdrop.tsx';
import { DPad, PadButton } from './Controls.tsx';
import { OvhLogo } from './OvhLogo.tsx';

/**
 * Met l'écran logique 240 x 216 à l'échelle de la place disponible.
 * Le texte et les canvas restent nets : le navigateur redessine après la mise à l'échelle.
 */
function ScaledScreen({ children }: { children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = host.current!;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const free = Math.min(width / SCREEN_WIDTH, height / SCREEN_HEIGHT);
      const whole = Math.floor(free);
      setScale(whole >= 1 && whole / free > 0.9 ? whole : Math.max(0.25, free));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={host} className="screen-host">
      <div className="screen" style={{ width: SCREEN_WIDTH * scale, height: SCREEN_HEIGHT * scale }}>
        <div
          className="screen-inner"
          style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function SoundToggle() {
  const services = useServices();
  const { muted } = useSettings();
  const t = useT();
  return (
    <button
      type="button"
      className={`sound-toggle${muted ? '' : ' is-on'}`}
      aria-label={muted ? t.soundOn : t.soundOff}
      onClick={() => {
        services.update({ muted: !muted });
        if (muted) services.audio.play('confirm');
      }}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2 6h3l4-3v10L5 10H2z" fill="currentColor" />
        {muted ? (
          <path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" strokeWidth="1.6" />
        ) : (
          <path d="M11 5.5a3.5 3.5 0 010 5M12.5 3.5a6 6 0 010 9" stroke="currentColor" strokeWidth="1.4" fill="none" />
        )}
      </svg>
    </button>
  );
}

/** La coque de la console : écran, logo, croix, A, B, Start, Select. */
export function ConsoleShell({
  children,
  powered,
  onPower,
}: {
  children: ReactNode;
  powered: boolean;
  onPower: () => void;
}) {
  const t = useT();
  const keys = useKeyLabels();
  return (
    <div className="console">
      <SnowCap />

      <div className="console-top">
        <button
          type="button"
          className={`power-switch${powered ? ' is-on' : ''}`}
          aria-label={powered ? t.powerOff : t.powerOn}
          aria-pressed={powered}
          onClick={onPower}
        >
          <span className="power-led" aria-hidden="true" />
          <span className="power-track" aria-hidden="true">
            <span className="power-knob" />
          </span>
          <span className="console-label">{powered ? t.on : t.off}</span>
        </button>
        <span className="console-spacer" />
        <span className="console-label edition">{t.edition}</span>
        <SoundToggle />
      </div>

      <div className="screen-bezel">
        <ScaledScreen>{children}</ScaledScreen>
      </div>

      <div className="brand">
        <div className="logo" aria-label="GameBOVH">
          Game<span>B</span>
          <OvhLogo className="logo-ovh" />
        </div>
        <div className="tagline">ANNUAL PARTY · 2026</div>
        <div className="credits">{t.credits}</div>
      </div>

      <div className="controls">
        <div className="controls-left">
          <DPad />
          <kbd className="keycap keycap-dpad">{keys.dpad} · ←↑→↓</kbd>
        </div>
        <div className="controls-right">
          <PadButton button="b" label="B" className="action action-b" keycap={keys.b} />
          <PadButton button="a" label="A" className="action action-a" keycap={keys.a} />
        </div>
        <div className="controls-bottom">
          <PadButton button="select" label="SELECT" className="pill" keycap={keys.select} />
          <PadButton button="start" label="START" className="pill" keycap={keys.start} />
        </div>
        <div className="speaker" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
