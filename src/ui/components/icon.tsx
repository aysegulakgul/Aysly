/* eslint-disable @next/next/no-img-element -- Figma'dan indirilen SVG'ler değiştirilmeden, kendi boyutlarıyla kullanılır. */

/** Figma'dan indirilen ikonlar (public/icons). Boyutlar Figma'daki kök width/height değerleridir. */
const ICONS = {
  check: 20,
  'wifi-off': 20,
  plus: 18,
  inbox: 32,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name }: { name: IconName }) {
  const size = ICONS[name];
  return (
    <img
      src={`/icons/${name}.svg`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className="shrink-0"
    />
  );
}
