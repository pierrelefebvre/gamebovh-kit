import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ConsoleScreen, GameDefinition, LaunchMode } from '@gamebovh/sdk';
import { Emitter, isSystemMessage } from '@gamebovh/sdk/runtime';
import { attachGamepads, attachKeyboard, watchMenuCombo, watchResetCombo } from './input/hardware.ts';
import { loadCatalog, loadGame, localize, type CatalogEntry } from './runtime/catalog.ts';
import { useLang, useT } from './i18n.ts';
import { GameHost } from './runtime/GameHost.tsx';
import { useServices } from './runtime/services.tsx';
import { BootScreen } from './screens/Boot.tsx';
import { CartridgeScreen, RoomsScreen, ScoresScreen } from './screens/Cartridge.tsx';
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
  | { name: 'settings'; back?: View }
  | { name: 'cartridge'; entry: CatalogEntry }
  | { name: 'scores'; entry: CatalogEntry; def: GameDefinition; from: 'menu' | 'cartridge' | 'game' }
  | { name: 'rooms'; entry: CatalogEntry; def: GameDefinition }
  | { name: 'join'; entry: CatalogEntry; def: GameDefinition }
  | { name: 'lobby'; entry: CatalogEntry; def: GameDefinition; create: boolean }
  | {
      name: 'play';
      entry: CatalogEntry;
      def: GameDefinition;
      inRoom: boolean;
      seed: number;
      round: number;
      launch: LaunchMode;
    };

function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export function App() {
  const services = useServices();
  const t = useT();
  const lang = useLang();
  const raw = useMemo(() => loadCatalog(), []);
  // Fiches traduites dans la langue de la console.
  const catalog = useMemo(() => ({ ...raw, games: raw.games.map((g) => localize(g, lang)) }), [raw, lang]);
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
        setView({ name: 'play', entry: v.entry, def: v.def, inRoom: true, seed, round: Date.now(), launch: 'room' });
      }),
    [services],
  );

  /**
   * « Accueil » d'un jeu : sa fiche dans la console, ou son propre menu (menu: 'game'),
   * relancé à neuf pour tenir compte d'un changement de réglages.
   */
  const homeOf = (entry: CatalogEntry, def: GameDefinition): View =>
    def.menu === 'game'
      ? { name: 'play', entry, def, inRoom: false, seed: newSeed(), round: Date.now(), launch: 'menu' }
      : { name: 'cartridge', entry };

  const toMenu = useCallback(() => setView({ name: 'menu' }), []);

  /** Écran de la console demandé par un jeu depuis son menu. */
  const openFromGame = (entry: CatalogEntry, def: GameDefinition, screen: ConsoleScreen) => {
    if (screen === 'rooms') setView({ name: 'rooms', entry, def });
    else if (screen === 'join') setView({ name: 'join', entry, def });
    else if (screen === 'scores') setView({ name: 'scores', entry, def, from: 'game' });
    else setView({ name: 'settings', back: homeOf(entry, def) });
  };
  const afterBoot = useCallback(() => {
    if (!services.settings.nickname) setView({ name: 'nickname', then: { name: 'menu' } });
    else if (catalog.games.length === 1 && import.meta.env.VITE_ONLY_GAME) {
      const entry = catalog.games[0];
      void loadGame(entry).then(
        (def) => setView(homeOf(entry, def)),
        () => setView({ name: 'cartridge', entry }),
      );
    } else setView({ name: 'menu' });
  }, [services, catalog]);

  let screen: ReactNode;
  switch (view.name) {
    case 'off':
      screen = <div className="power-off" aria-label={t.consoleOff} />;
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
            // Un jeu avec son propre menu se lance directement ; sinon, sa fiche.
            void loadGame(entry).then(
              (def) => setView(homeOf(entry, def)),
              () => setView({ name: 'cartridge', entry }),
            );
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
          onBack={() => setView(view.back ? { ...view.back, round: Date.now() } as View : { name: 'menu' })}
          onNickname={() => setView({ name: 'nickname', then: view })}
        />
      );
      break;
    case 'cartridge': {
      const { entry } = view;
      screen = (
        <CartridgeScreen
          entry={entry}
          onBack={toMenu}
          onSolo={(def) => setView({ name: 'play', entry, def, inRoom: false, seed: newSeed(), round: Date.now(), launch: 'solo' })}
          onCreate={(def) => setView({ name: 'lobby', entry, def, create: true })}
          onJoin={(def) => setView({ name: 'join', entry, def })}
          onScores={(def) => setView({ name: 'scores', entry, def, from: 'cartridge' })}
        />
      );
      break;
    }
    case 'scores':
      screen = (
        <ScoresScreen
          entry={view.entry}
          def={view.def}
          onBack={() => setView(view.from === 'menu' ? { name: 'menu' } : homeOf(view.entry, view.def))}
        />
      );
      break;
    case 'rooms':
      screen = (
        <RoomsScreen
          entry={view.entry}
          def={view.def}
          onCreate={() => setView({ name: 'lobby', entry: view.entry, def: view.def, create: true })}
          onJoin={() => setView({ name: 'join', entry: view.entry, def: view.def })}
          onBack={() => setView(homeOf(view.entry, view.def))}
        />
      );
      break;
    case 'join':
      screen = (
        <JoinScreen
          entry={view.entry}
          theme={view.def.theme}
          onBack={() => setView(homeOf(view.entry, view.def))}
          onJoined={() => setView({ name: 'lobby', entry: view.entry, def: view.def, create: false })}
        />
      );
      break;
    case 'lobby': {
      const { entry, def } = view;
      screen = (
        <LobbyScreen
          entry={entry}
          theme={def.theme}
          create={view.create}
          onLeave={() => setView(homeOf(entry, def))}
          onStart={() => {
            const seed = newSeed();
            services.net.send({ type: '__start', seed });
            setView({ name: 'play', entry, def, inRoom: true, seed, round: Date.now(), launch: 'room' });
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
          launch={view.launch}
          subscribeMenu={subscribeMenu}
          onQuit={() => {
            if (inRoom) services.net.leaveRoom();
            // Depuis le menu du jeu lui-même : retour au carrousel ; sinon, retour à l'accueil du jeu.
            setView(def.menu === 'game' && view.launch === 'menu' ? { name: 'menu' } : homeOf(entry, def));
          }}
          onExit={() => {
            if (inRoom) services.net.leaveRoom();
            setView(def.menu === 'game' ? { name: 'menu' } : { name: 'cartridge', entry });
          }}
          onOpen={(screen) => openFromGame(entry, def, screen)}
          onReplay={() => setView({ ...view, seed: newSeed(), round: Date.now(), launch: 'solo' })}
          onResultsMenu={() => setView(homeOf(entry, def))}
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
