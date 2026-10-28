import en from './messages/en.json';
import tr from './messages/tr.json';
import type { Locale } from './config';

const MESSAGES = { tr, en } as const;

/** React dışı sunucu kodu (ör. e-posta) için çeviri: "email.verify.subject" gibi noktalı anahtar. */
export function serverText(locale: Locale): (key: string) => string {
  return (key) => {
    const value = key
      .split('.')
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        MESSAGES[locale],
      );
    return typeof value === 'string' ? value : key;
  };
}
