import { describe, expect, it } from 'vitest';
import { normalizeEmail, validateEmail, validateName, validatePassword } from './credentials';

describe('BR-ACC-001: e-posta normalleştirme', () => {
  it('BR-ACC-001: kırpar ve küçük harfe çevirir', () => {
    expect(normalizeEmail('  Ali@Example.COM ')).toBe('ali@example.com');
  });

  it('BR-ACC-001: Türkçe büyük İ/I harfleri yerel ayardan bağımsız çevrilir', () => {
    expect(normalizeEmail('IRMAK@ORNEK.COM')).toBe('irmak@ornek.com');
  });

  it('BR-ACC-001: geçersiz biçimi reddeder', () => {
    expect(validateEmail('kullanici').ok).toBe(false);
    expect(validateEmail('a b@c.com').ok).toBe(false);
    expect(validateEmail('kisi@ornek.com')).toEqual({ ok: true, value: 'kisi@ornek.com' });
  });
});

describe('BR-ACC-002: şifre politikası', () => {
  it('BR-ACC-002: 9 karakterlik şifre reddedilir, gerekçe gösterilir', () => {
    expect(validatePassword('123456789')).toEqual({
      ok: false,
      error: { field: 'password', reason: 'too_short' },
    });
  });

  it('BR-ACC-002: 10 karakter yeterlidir, karakter türü zorunlu değildir', () => {
    expect(validatePassword('ayisigi ve').ok).toBe(true);
  });

  it('BR-ACC-002: 128 karakteri aşan şifre reddedilir', () => {
    expect(validatePassword('a'.repeat(129))).toMatchObject({ error: { reason: 'too_long' } });
  });

  it('BR-ACC-002: sık kullanılan şifre büyük/küçük harf farkı gözetmeden reddedilir', () => {
    expect(validatePassword('Password123')).toMatchObject({ error: { reason: 'too_common' } });
    expect(validatePassword('galatasaray')).toMatchObject({ error: { reason: 'too_common' } });
  });
});

describe('ad doğrulama', () => {
  it('boşlukları sadeleştirir ve boş adı reddeder', () => {
    expect(validateName('  Elif   Yılmaz ')).toEqual({ ok: true, value: 'Elif Yılmaz' });
    expect(validateName('   ').ok).toBe(false);
  });
});
