import { useEffect, useState } from 'react';
import { canPromptInstall, isInstalled, isIos, onInstallChange, promptInstall } from '../runtime/install.ts';
import { useKeyboardLayout, useServices, useSettings, type Settings } from '../runtime/services.tsx';
import { useKeyLabels, useLang, useT } from '../i18n.ts';
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
  const t = useT();
  const lang = useLang();
  const layout = useKeyboardLayout();
  const keys = useKeyLabels();
  const yesNo = (on: boolean) => (on ? t.yes : t.no);
  const LANG_CYCLE: Settings['language'][] = ['auto', 'fr', 'en'];
  const KEYBOARD_CYCLE: Settings['keyboard'][] = ['auto', 'azerty', 'qwerty'];
  const next = <T,>(list: T[], value: T) => list[(list.indexOf(value) + 1) % list.length];
  const langName = { fr: 'FRANÇAIS', en: 'ENGLISH' } as const;
  const [installable, setInstallable] = useState(canPromptInstall());
  const [iosHint, setIosHint] = useState(false);
  useEffect(() => onInstallChange(() => setInstallable(canPromptInstall())), []);
  const showIos = isIos() && !isInstalled();

  return (
    <Frame
      title={t.settingsTitle}
      footer={
        <>
          <Hint>{t.hintChange}</Hint>
          <Hint>{t.hintBack}</Hint>
        </>
      }
    >
      <MenuList
        onBack={onBack}
        items={[
          { label: t.nickname, detail: settings.nickname, onSelect: onNickname },
          {
            label: t.language,
            detail: settings.language === 'auto' ? t.langAuto(lang.toUpperCase()) : langName[settings.language],
            onSelect: () => services.update({ language: next(LANG_CYCLE, settings.language) }),
          },
          {
            label: t.keyboard,
            detail: settings.keyboard === 'auto' ? t.langAuto(layout.toUpperCase()) : settings.keyboard.toUpperCase(),
            onSelect: () => services.update({ keyboard: next(KEYBOARD_CYCLE, settings.keyboard) }),
          },
          {
            label: t.sound,
            detail: yesNo(!settings.muted),
            onSelect: () => {
              services.update({ muted: !settings.muted });
              if (settings.muted) services.audio.play('confirm');
            },
          },
          {
            label: t.vibration,
            detail: yesNo(settings.vibration),
            onSelect: () => {
              services.update({ vibration: !settings.vibration });
              services.audio.vibrate(40);
            },
          },
          { label: t.fullscreen, onSelect: toggleFullscreen },
          ...(installable
            ? [{ label: t.install, onSelect: () => void promptInstall() }]
            : showIos
              ? [{ label: t.install, onSelect: () => setIosHint(true) }]
              : []),
          { label: t.back, onSelect: onBack },
        ]}
      />
      {iosHint && (
        <p className="small gold-text">{t.iosInstall}</p>
      )}
      <div className="keys-help">
        <p>{t.keysHelp1(keys)}</p>
        <p>{t.keysHelp2(keys)}</p>
      </div>
    </Frame>
  );
}
