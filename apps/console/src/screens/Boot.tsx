import { useEffect } from 'react';
import { useConsoleButtons, useServices } from '../runtime/services.tsx';
import { OvhLogo } from '../shell/OvhLogo.tsx';
import { Snow } from './ui.tsx';
import { useT } from '../i18n.ts';

const BOOT_MS = 3400;

/** Animation de démarrage : le logo descend, "ding", puis on passe au menu. */
export function BootScreen({ onDone }: { onDone: () => void }) {
  const { audio } = useServices();
  const t = useT();

  useEffect(() => {
    const ding = window.setTimeout(() => {
      audio.tone({ frequency: 1319, durationMs: 90, wave: 'square', volume: 0.3 });
      audio.tone({ frequency: 2637, durationMs: 500, wave: 'square', volume: 0.25 }, 90);
    }, 1900);
    const done = window.setTimeout(onDone, BOOT_MS);
    return () => {
      window.clearTimeout(ding);
      window.clearTimeout(done);
    };
  }, [audio, onDone]);

  useConsoleButtons(() => onDone());

  return (
    <div className="boot" onClick={onDone}>
      <Snow count={34} />
      <div className="boot-logo" aria-label="GameBOVH">
        Game<span>B</span>
        <OvhLogo className="logo-ovh" />
      </div>
      <div className="boot-sub">ANNUAL PARTY 2026</div>
      <div className="boot-mountains" aria-hidden="true" />
      <div className="boot-credits">{t.credits}</div>
    </div>
  );
}
