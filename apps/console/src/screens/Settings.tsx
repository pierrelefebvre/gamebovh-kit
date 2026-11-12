import { useEffect, useState } from 'react';
import { canPromptInstall, isInstalled, isIos, onInstallChange, promptInstall } from '../runtime/install.ts';
import { useServices, useSettings } from '../runtime/services.tsx';
import { Frame, Hint, MenuList } from './ui.tsx';

function toggleFullscreen() {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  if (document.fullscreenElement) void document.exitFullscreen?.();
  else if (el.requestFullscreen) void el.requestFullscreen().catch(() => undefined);
  else el.webkitRequestFullscreen?.();
}

export function SettingsScreen({ onBack, onNickname }: { onBack: () => void; onNickname: () => void }) {
  const services = useServices();
  const settings = useSettings();
  const [installable, setInstallable] = useState(canPromptInstall());
  const [iosHint, setIosHint] = useState(false);
  useEffect(() => onInstallChange(() => setInstallable(canPromptInstall())), []);
  const showIos = isIos() && !isInstalled();

  return (
    <Frame
      title="RÉGLAGES"
      footer={
        <>
          <Hint>A modifier</Hint>
          <Hint>B retour</Hint>
        </>
      }
    >
      <MenuList
        onBack={onBack}
        items={[
          { label: 'Pseudo', detail: settings.nickname, onSelect: onNickname },
          {
            label: 'Son',
            detail: settings.muted ? 'NON' : 'OUI',
            onSelect: () => {
              services.update({ muted: !settings.muted });
              if (settings.muted) services.audio.play('confirm');
            },
          },
          {
            label: 'Vibration',
            detail: settings.vibration ? 'OUI' : 'NON',
            onSelect: () => {
              services.update({ vibration: !settings.vibration });
              services.audio.vibrate(40);
            },
          },
          { label: 'Plein écran', onSelect: toggleFullscreen },
          ...(installable
            ? [{ label: "Installer l'appli", onSelect: () => void promptInstall() }]
            : showIos
              ? [{ label: "Installer l'appli", onSelect: () => setIosHint(true) }]
              : []),
          { label: 'Retour', onSelect: onBack },
        ]}
      />
      {iosHint && (
        <p className="small gold-text">Sur iPhone : bouton Partager, puis « Sur l'écran d'accueil ».</p>
      )}
      <div className="keys-help">
        <p>Clavier : flèches, X/Espace = A, Z/W = B</p>
        <p>Entrée = START, Maj = SELECT, Échap = pause</p>
      </div>
    </Frame>
  );
}
