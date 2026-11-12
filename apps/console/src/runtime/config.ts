declare global {
  interface Window {
    GAMEBOVH_CONFIG?: { socketUrl?: string };
  }
}

/**
 * URL du serveur WebSocket, par ordre de priorité :
 * 1. public/config.js (modifiable après le build)
 * 2. VITE_SOCKET_URL (au moment du build)
 * 3. en dev : ws://<hôte>:8787, en prod : wss://<même hôte>/ws
 */
export function resolveSocketUrl(): string {
  const runtime = window.GAMEBOVH_CONFIG?.socketUrl?.trim();
  if (runtime) return runtime;
  const built = import.meta.env.VITE_SOCKET_URL?.trim();
  if (built) return built;
  if (import.meta.env.DEV) return `ws://${location.hostname}:8787`;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

/** Id de cartouche à charger seul (pnpm dev:game <id>). */
export const ONLY_GAME: string | undefined = import.meta.env.VITE_ONLY_GAME?.trim() || undefined;
