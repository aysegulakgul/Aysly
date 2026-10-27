/** Koşullu sınıf adlarını birleştirir (ek bağımlılık olmadan). */
export const cn = (...classes: (string | false | null | undefined)[]): string =>
  classes.filter(Boolean).join(' ');
