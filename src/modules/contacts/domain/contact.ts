import type { FieldIssue } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';

/** D-097: kişi avatar renkleri (proje paletiyle aynı 12 renk, UI_UX token'ları). */
export const CONTACT_COLORS = [
  'slate',
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'pink',
  'brown',
] as const;
export type ContactColor = (typeof CONTACT_COLORS)[number];

export type Contact = {
  id: string;
  workspaceId: string;
  name: string;
  email: string | null;
  color: ContactColor;
  createdAt: Date;
  updatedAt: Date;
};

/** BR-CONTACT-001: ad kırpılır, 1–100 karakter. */
export function normalizeContactName(raw: string): Result<string, FieldIssue> {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length === 0) return err({ field: 'name', reason: 'required' });
  if (name.length > 100) return err({ field: 'name', reason: 'too_long' });
  return ok(name);
}

/** BR-CONTACT-001: e-posta isteğe bağlı; boş değer "yok" sayılır; biçim temel olarak denetlenir. */
export function normalizeContactEmail(
  raw: string | null | undefined,
): Result<string | null, FieldIssue> {
  const email = raw?.trim().toLowerCase() ?? '';
  if (email === '') return ok(null);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return err({ field: 'email', reason: 'invalid' });
  }
  return ok(email);
}

/** Avatarda gösterilen baş harfler: ilk iki kelimenin ilk harfleri (Türkçe büyük harf kuralıyla). */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toLocaleUpperCase('tr'))
    .join('');
}
