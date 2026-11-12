import { useMemo } from 'react';

const BULB_COLORS = ['#ffc83d', '#4fb3ff', '#ff4d5e', '#ffffff'];

/** Fond de soirée : guirlande lumineuse et flocons qui tombent doucement. */
export function Backdrop() {
  const bulbs = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const x = (i + 0.5) * (1600 / 22);
        // Même courbe que le fil : deux vagues sur la largeur
        const y = 70 + Math.sin((x / 1600) * Math.PI * 4 + 0.6) * 26;
        return { x, y: y + 12, color: BULB_COLORS[i % BULB_COLORS.length], delay: (i * 0.37) % 2.4 };
      }),
    [],
  );
  const wire = useMemo(() => {
    let d = 'M0 ';
    for (let x = 0; x <= 1600; x += 20) {
      const y = 70 + Math.sin((x / 1600) * Math.PI * 4 + 0.6) * 26;
      d += `${x === 0 ? '' : 'L'}${x} ${y.toFixed(1)} `;
    }
    return d;
  }, []);
  const flakes = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: (i * 61) % 100,
        size: i % 4 === 0 ? 16 : i % 3 === 0 ? 10 : 4,
        glyph: i % 4 === 0 || i % 3 === 0,
        delay: -((i * 2.3) % 20),
        duration: 16 + ((i * 7) % 14),
        opacity: 0.25 + ((i * 13) % 50) / 100,
      })),
    [],
  );

  return (
    <div className="backdrop" aria-hidden="true">
      <svg className="garland" viewBox="0 0 1600 140" preserveAspectRatio="xMidYMin slice">
        <path d={wire} fill="none" stroke="#0a114a" strokeWidth="3" />
        {bulbs.map((b, i) => (
          <g key={i} className="bulb" style={{ animationDelay: `${b.delay}s` }}>
            <rect x={b.x - 4} y={b.y - 16} width="8" height="7" rx="1.5" fill="#26306a" />
            <circle cx={b.x} cy={b.y} r="13" fill={b.color} className="bulb-glow" />
            <circle cx={b.x} cy={b.y} r="9.5" fill={b.color} />
            <circle cx={b.x - 3} cy={b.y - 3} r="2.5" fill="#fff" opacity="0.55" />
          </g>
        ))}
      </svg>
      {flakes.map((f, i) => (
        <span
          key={i}
          className={f.glyph ? 'bg-flake glyph' : 'bg-flake'}
          style={{
            left: `${f.left}%`,
            fontSize: f.size,
            width: f.glyph ? undefined : f.size,
            height: f.glyph ? undefined : f.size,
            opacity: f.opacity,
            animationDelay: `${f.delay}s`,
            animationDuration: `${f.duration}s`,
          }}
        >
          {f.glyph ? '❄' : ''}
        </span>
      ))}
    </div>
  );
}

/** Neige posée sur le dessus de la console. */
export function SnowCap() {
  return (
    <svg className="snow-cap" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 40 V22 C6 8 22 4 40 10 C56 0 84 0 100 10 C112 4 128 6 136 14 C150 2 180 0 196 10 C208 4 226 4 236 12
           C252 0 286 0 300 10 C312 4 330 6 338 12 C352 2 382 2 392 10 C396 12 400 16 400 22 V40 Z"
        fill="#ffffff"
      />
    </svg>
  );
}
