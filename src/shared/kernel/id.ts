import { randomBytes } from 'node:crypto';

/**
 * UUIDv7 (RFC 9562) üretir: ilk 48 bit milisaniye zaman damgası, kalanı rastgele (D-015).
 * Zaman sıralı olduğu için indeks dostudur; tahmin edilemez kısmı 74 bit rastgeledir.
 */
export function uuidv7(nowMs: number = Date.now()): string {
  const bytes = randomBytes(16);
  const ts = BigInt(nowMs);
  for (let i = 0; i < 6; i++) {
    bytes[i] = Number((ts >> BigInt(8 * (5 - i))) & 0xffn);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // sürüm 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 varyantı
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value: string): boolean => UUID_RE.test(value);
