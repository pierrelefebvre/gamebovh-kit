import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

/**
 * Service des fichiers statiques de la console (mode "tout-en-un").
 * Activé par STATIC_DIR : un seul conteneur sert la console et le WebSocket.
 */
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

export function createStaticHandler(dir: string) {
  const root = resolve(dir);

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = normalize(join(root, pathname));
    if (!file.startsWith(root)) return false;

    try {
      const info = await stat(file).catch(() => null);
      // Fichier demandé introuvable (ancien script après un déploiement, image...) : vraie 404.
      // Seules les adresses sans extension retombent sur la page de la console.
      if (!info && extname(pathname) !== '') return false;
      if (!info || info.isDirectory()) file = join(info ? file : root, 'index.html');
      const final = await stat(file);
      const ext = extname(file);
      // Fichiers avec empreinte (assets/) : cache long. index.html et config.js : jamais en cache.
      const immutable = pathname.startsWith('/assets/');
      res.writeHead(200, {
        'content-type': TYPES[ext] ?? 'application/octet-stream',
        'content-length': final.size,
        'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
        'x-content-type-options': 'nosniff',
      });
      if (req.method === 'HEAD') res.end();
      else createReadStream(file).pipe(res);
      return true;
    } catch {
      return false;
    }
  };
}
