import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { detectLang, type Button, type Lang } from '@gamebovh/sdk';
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
import { watchKeyboardLayout, type KeyboardLayout } from '../input/layout.ts';
import { resolveSocketUrl } from './config.ts';

/** Langue choisie : 'auto' suit le navigateur. */
export type LangSetting = 'auto' | 'fr' | 'en';

export interface Settings {
  nickname: string;
  muted: boolean;
  vibration: boolean;
  language: LangSetting;
  /** Disposition du clavier pour l'affichage des touches : 'auto' la devine. */
  keyboard: 'auto' | KeyboardLayout;
}

const SETTINGS_KEY = 'gamebovh:settings';
const PLAYER_ID_KEY = 'gamebovh:playerId';

function readSettings(): Settings {
  const defaults: Settings = { nickname: '', muted: true, vibration: true, language: 'auto', keyboard: 'auto' };
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
    this.net = new NetClient(resolveSocketUrl(), () => this.settings.nickname || (this.lang === 'fr' ? 'Joueur' : 'Player'));
    this.applyLang();
    watchKeyboardLayout((layout) => {
      if (layout === this.detectedLayout) return;
      this.detectedLayout = layout;
      this.notify();
    });
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  /** Langue effective : celle des réglages, sinon celle du navigateur. */
  get lang(): Lang {
    return this.settings.language === 'auto' ? detectLang() : this.settings.language;
  }

  /** Disposition devinée (null tant qu'on ne sait pas). */
  detectedLayout: KeyboardLayout | null = null;

  /** Disposition effective : réglage, sinon devinée, sinon d'après la langue. */
  get layout(): KeyboardLayout {
    if (this.settings.keyboard !== 'auto') return this.settings.keyboard;
    return this.detectedLayout ?? (this.lang === 'fr' ? 'azerty' : 'qwerty');
  }

  private applyLang(): void {
    document.documentElement.lang = this.lang;
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
    if (patch.language !== undefined) this.applyLang();
    this.notify();
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

/** Disposition du clavier effective, à jour en temps réel. */
export function useKeyboardLayout(): KeyboardLayout {
  const services = useServices();
  const [layout, setLayout] = useState(services.layout);
  useEffect(() => services.subscribe(() => setLayout(services.layout)), [services]);
  return layout;
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
