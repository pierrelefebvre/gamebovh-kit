/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOCKET_URL?: string;
  readonly VITE_ONLY_GAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
