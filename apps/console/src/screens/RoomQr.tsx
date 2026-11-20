import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/** Adresse qui ouvre la console directement dans une salle (lue au démarrage par App). */
export function roomLink(code: string, gameId: string): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('salle', code);
  url.searchParams.set('jeu', gameId);
  return url.toString();
}

/** Lit un lien de salle dans l'adresse de la page, puis l'efface de la barre d'adresse. */
export function takeRoomLink(): { code: string; gameId: string } | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('salle');
  const gameId = params.get('jeu');
  if (!code || !gameId) return null;
  params.delete('salle');
  params.delete('jeu');
  const rest = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
  return { code, gameId };
}

/** QR code dessiné en SVG (net à toutes les tailles), avec sa marge blanche. */
export function RoomQr({ text, label }: { text: string; label: string }) {
  const path = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 2} ${r + 2}h1v1h-1z`;
    return { d, size: n + 4 };
  }, [text]);
  return (
    <div className="room-qr">
      <svg viewBox={`0 0 ${path.size} ${path.size}`} role="img" aria-label={label} shapeRendering="crispEdges">
        <rect width={path.size} height={path.size} fill="#ffffff" />
        <path d={path.d} fill="#0b1e3f" />
      </svg>
      <span>{label}</span>
    </div>
  );
}
