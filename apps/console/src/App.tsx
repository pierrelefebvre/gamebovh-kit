import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { GameDefinition } from '@gamebovh/sdk';
import { Emitter, isSystemMessage } from '@gamebovh/sdk/runtime';
import { attachGamepads, attachKeyboard, watchMenuCombo, watchResetCombo } from './input/hardware.ts';
import { loadCatalog, loadGame, type CatalogEntry } from './runtime/catalog.ts';
import { GameHost } from './runtime/GameHost.tsx';
import { useServices } from './runtime/services.tsx';
import { BootScreen } from './screens/Boot.tsx';
import { CartridgeScreen, ScoresScreen } from './screens/Cartridge.tsx';
import { JoinScreen, LobbyScreen } from './screens/Lobby.tsx';
import { MenuScreen } from './screens/Menu.tsx';
import { NicknameScreen } from './screens/Nickname.tsx';
import { SettingsScreen } from './screens/Settings.tsx';
import { Backdrop } from './shell/Backdrop.tsx';
import { ConsoleShell } from './shell/Console.tsx';

type View =
  | { name: 'off' }
  | { name: 'boot' }
  | { name: 'nickname'; then: View }
  | { name: 'menu' }
  | { name: 'settings' }
  | { name: 'cartridge'; entry: CatalogEntry }
  | { name: 'scores'; entry: CatalogEntry; def: GameDefinition; from: 'menu' | 'cartridge' }
  | { name: 'join'; entry: CatalogEntry; def: GameDefinition }
  | { name: 'lobby'; entry: CatalogEntry; def: GameDefinition; create: boolean }
  | { name: 'play'; entry: CatalogEntry; def: GameDefinition; inRoom: boolean; seed: number; round: number };

function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export function App() {
  const services = useServices();
  const catalog = useMemo(() => loadCatalog(), []);
  const [view, setView] = useState<View>({ name: 'boot' });
  const [menuIndex, setMenuIndex] = useState(0);
  const viewRef = useRef(view);
  viewRef.current = view;

  /* Interrupteur et redémarrage : on quitte la salle, l'écran s'éteint, puis la console redémarre. */
  const powerTimer = useRef<number | null>(null);
  const powerOff = useCallback(() => {
    if (powerTimer.current !== null) window.clearTimeout(powerTimer.current);
    powerTimer.current = null;
    services.net.leaveRoom();
    services.input.releaseAll();
    services.audio.tone({ frequency: 520, durationMs: 220, wave: 'triangle', volume: 0.25, slideTo: 90 });
    setView({ name: 'off' });
  }, [services]);
  const powerOn = useCallback(() => {
    if (powerTimer.current !== null) window.clearTimeout(powerTimer.current);
    powerTimer.current = null;
    setView({ name: 'boot' });
  }, []);
  const togglePower = useCallback(() => {
    if (viewRef.current.name === 'off') powerOn();
    else powerOff();
  }, [powerOn, powerOff]);
  const reboot = useCallback(() => {
    if (viewRef.current.name === 'off') return;
    powerOff();
    powerTimer.current = window.setTimeout(powerOn, 900);
  }, [powerOff, powerOn]);

  /* Entrées matérielles + demande de menu (Échap, Start + Select) + redémarrage (A+B+Start+Select). */
  const menuEvents = useMemo(() => new Emitter<{ menu: [] }>(), []);
  const subscribeMenu = useCallback((cb: () => void) => menuEvents.on('menu', cb), [menuEvents]);
  useEffect(() => {
    const requestMenu = () => menuEvents.emit('menu');
    const offs = [
      attachKeyboard(services.input, requestMenu),
      attachGamepads(services.input, requestMenu),
      watchMenuCombo(services.input, requestMenu),
      watchResetCombo(services.input, reboot),
    ];
    const unlock = () => services.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      offs.forEach((off) => off());
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [services, menuEvents, reboot]);

  /* Début de partie décidé par l'hôte de la salle. */
  useEffect(
    () =>
      services.net.on('relay', (data) => {
        if (!isSystemMessage(data) || data.type !== '__start') return;
        const v = viewRef.current;
        if (v.name !== 'lobby' && !(v.name === 'play' && v.inRoom)) return;
        if (services.net.room?.gameId !== v.entry.id) return;
        const seed = typeof data.seed === 'number' ? data.seed : newSeed();
        setView({ name: 'play', entry: v.entry, def: v.def, inRoom: true, seed, round: Date.now() });
      }),
    [services],
  );

  const toMenu = useCallback(() => setView({ name: 'menu' }), []);
  const afterBoot = useCallback(() => {
    if (!services.settings.nickname) setView({ name: 'nickname', then: { name: 'menu' } });
    else if (catalog.games.length === 1 && import.meta.env.VITE_ONLY_GAME) {
      setView({ name: 'cartridge', entry: catalog.games[0] });
    } else setView({ name: 'menu' });
  }, [services, catalog]);

  let screen: ReactNode;
  switch (view.name) {
    case 'off':
      screen = <div className="power-off" aria-label="Console éteinte" />;
      break;
    case 'boot':
      screen = <BootScreen onDone={afterBoot} />;
      break;
    case 'nickname':
      screen = <NicknameScreen onDone={() => setView(view.then)} onCancel={services.settings.nickname ? () => setView(view.then) : undefined} />;
      break;
    case 'menu':
      screen = (
        <MenuScreen
          games={catalog.games}
          errors={catalog.errors}
          initial={menuIndex}
          onPick={(entry, index) => {
            setMenuIndex(index);
            setView({ name: 'cartridge', entry });
          }}
          onRoom={(entry, index) => {
            setMenuIndex(index);
            void loadGame(entry).then((def) => setView({ name: 'lobby', entry, def, create: true }));
          }}
          onScores={(entry, index) => {
            setMenuIndex(index);
            void loadGame(entry).then((def) => setView({ name: 'scores', entry, def, from: 'menu' }));
          }}
          onSettings={() => setView({ name: 'settings' })}
        />
      );
      break;
    case 'settings':
      screen = (
        <SettingsScreen
          onBack={toMenu}
          onNickname={() => setView({ name: 'nickname', then: { name: 'settings' } })}
        />
      );
      break;
    case 'cartridge': {
      const { entry } = view;
      screen = (
        <CartridgeScreen
          entry={entry}
          onBack={toMenu}
          onSolo={(def) => setView({ name: 'play', entry, def, inRoom: false, seed: newSeed(), round: Date.now() })}
          onCreate={(def) => setView({ name: 'lobby', entry, def, create: true })}
          onJoin={(def) => setView({ name: 'join', entry, def })}
          onScores={(def) => setView({ name: 'scores', entry, def, from: 'cartridge' })}
        />
      );
      break;
    }
    case 'scores':
      screen = <ScoresScreen entry={view.entry} def={view.def} onBack={() => setView(view.from === 'menu' ? { name: 'menu' } : { name: 'cartridge', entry: view.entry })} />;
      break;
    case 'join':
      screen = (
        <JoinScreen
          entry={view.entry}
          onBack={() => setView({ name: 'cartridge', entry: view.entry })}
          onJoined={() => setView({ name: 'lobby', entry: view.entry, def: view.def, create: false })}
        />
      );
      break;
    case 'lobby': {
      const { entry, def } = view;
      screen = (
        <LobbyScreen
          entry={entry}
          create={view.create}
          onLeave={() => setView({ name: 'cartridge', entry })}
          onStart={() => {
            const seed = newSeed();
            services.net.send({ type: '__start', seed });
            setView({ name: 'play', entry, def, inRoom: true, seed, round: Date.now() });
          }}
        />
      );
      break;
    }
    case 'play': {
      const { entry, def, inRoom } = view;
      screen = (
        <GameHost
          key={view.round}
          entry={entry}
          def={def}
          inRoom={inRoom}
          seed={view.seed}
          subscribeMenu={subscribeMenu}
          onQuit={() => {
            if (inRoom) services.net.leaveRoom();
            setView({ name: 'cartridge', entry });
          }}
          onReplay={() => setView({ ...view, seed: newSeed(), round: Date.now() })}
          onLobby={() => setView({ name: 'lobby', entry, def, create: false })}
        />
      );
      break;
    }
  }

  // Précharge la cartouche unique en mode dev:game.
  useEffect(() => {
    if (catalog.games.length === 1) void loadGame(catalog.games[0]).catch(() => undefined);
  }, [catalog]);

  return (
    <>
      <Backdrop />
      <ConsoleShell powered={view.name !== 'off'} onPower={togglePower}>
        {screen}
      </ConsoleShell>
    </>
  );
}
