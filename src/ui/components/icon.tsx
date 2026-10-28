/* eslint-disable @next/next/no-img-element -- Figma'dan indirilen SVG'ler değiştirilmeden, kendi boyutlarıyla kullanılır. */

/** Figma'dan indirilen ikonlar (public/icons). Boyutlar Figma'daki kök width/height değerleridir. */
const ICONS = {
  check: 20,
  'wifi-off': 20,
  plus: 18,
  inbox: 32,
  moon: 24,
  'chevron-down': 16,
  'sliders-horizontal': 18,
} as const;

export type IconName = keyof typeof ICONS;

/**
 * `tone="primary"`: Figma'da ikon rengi `action/primary` değişkenine bağlıysa SVG dosyası maske olarak kullanılır;
 * böylece açık ve koyu temada token rengini alır (dosya değiştirilmez).
 */
export function Icon({ name, tone }: { name: IconName; tone?: 'primary' }) {
  const size = ICONS[name];
  if (tone === 'primary') {
    return (
      <span
        aria-hidden="true"
        className="shrink-0 bg-primary"
        style={{
          width: size,
          height: size,
          mask: `url(/icons/${name}.svg) center / contain no-repeat`,
        }}
      />
    );
  }
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
