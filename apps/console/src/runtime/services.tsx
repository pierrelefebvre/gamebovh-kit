import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Button } from '@gamebovh/sdk';
import {
  AudioEngine,
  GameStorage,
  InputBus,
  MemoryStore,
  NetClient,
  openBestStore,
  randomId,
  type KeyValueStore,
} from '@gamebovh/sdk/runtime';
import { resolveSocketUrl } from './config.ts';

export interface Settings {
  nickname: string;
  muted: boolean;
  vibration: boolean;
}

const SETTINGS_KEY = 'gamebovh:settings';
const PLAYER_ID_KEY = 'gamebovh:playerId';

function readSettings(): Settings {
  const defaults: Settings = { nickname: '', muted: true, vibration: true };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return defaults;
  }
}

function readPlayerId(): string {
  try {
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

/** Services uniques de la console, partagés par tous les écrans. */
export class Services {
  readonly input = new InputBus();
  readonly audio = new AudioEngine();
  readonly playerId = readPlayerId();
  readonly net: NetClient;
  settings = readSettings();
  store: KeyValueStore = new MemoryStore();
  private listeners = new Set<() => void>();

  constructor() {
    this.audio.muted = this.settings.muted;
    this.audio.vibrationEnabled = this.settings.vibration;
    this.net = new NetClient(resolveSocketUrl(), () => this.settings.nickname || 'Joueur');
  }

  async init(): Promise<void> {
    this.store = await openBestStore();
  }

  update(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    this.audio.setMuted(this.settings.muted);
    this.audio.vibrationEnabled = this.settings.vibration;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      /* stockage indisponible : réglages perdus au rechargement */
    }
    if (patch.nickname !== undefined) this.net.refreshNickname();
    for (const l of this.listeners) l();
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  storageFor(gameId: string, scoreOrder: 'asc' | 'desc'): GameStorage {
    return new GameStorage(this.store, gameId, scoreOrder, this.playerId);
  }
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const s = useContext(ServicesContext);
  if (!s) throw new Error('ServicesProvider missing');
  return s;
}

/** Réglages à jour (re-rendu à chaque changement). */
export function useSettings(): Settings {
  const services = useServices();
  const [settings, setSettings] = useState(services.settings);
  useEffect(() => services.subscribe(() => setSettings(services.settings)), [services]);
  return settings;
}

/**
 * Écoute les boutons pour un écran de la console (menus).
 * `active` à false : l'écran ignore les entrées (un autre écran a la main).
 */
export function useConsoleButtons(handler: (button: Button) => void, active = true): void {
  const { input } = useServices();
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!active) return;
    return input.onPress((b) => latest.current(b));
  }, [input, active]);
}

/** Bouton enfoncé ? (pour l'affichage des touches de la coque). */
export function useButtonDown(button: Button): boolean {
  const { input } = useServices();
  const [down, setDown] = useState(false);
  useEffect(() => {
    const a = input.onPress((b) => b === button && setDown(true));
    const b = input.onRelease((b) => b === button && setDown(false));
    return () => {
      a();
      b();
    };
  }, [input, button]);
  return down;
}
