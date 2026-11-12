import { OVH_LOGO_PATHS, OVH_LOGO_TRANSFORM, OVH_LOGO_VIEWBOX } from './ovhLogo.ts';

/** Symbole et lettres « OVH » du logo officiel OVHcloud, à la couleur du texte. */
export function OvhLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox={OVH_LOGO_VIEWBOX} role="img" aria-label="OVH">
      {OVH_LOGO_PATHS.map((d, i) => (
        <path key={i} d={d} fill="currentColor" transform={OVH_LOGO_TRANSFORM} />
      ))}
    </svg>
  );
}
