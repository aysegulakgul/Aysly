import { describe, expect, it } from 'vitest';
import { normalizeTagName, prepareTagNames } from './tag';

describe('BR-TAG-001: etiket adı', () => {
  it('büyük/küçük harf ve Türkçe karakter farkına duyarsız', () => {
    expect(normalizeTagName('İş')).toBe(normalizeTagName('iş'));
    expect(normalizeTagName('İŞ')).toBe('is');
    expect(normalizeTagName('Işık')).toBe(normalizeTagName('ışık'));
    expect(normalizeTagName('Çalışma')).toBe('calisma');
  });

  it('boşlar atılır, uzun ad reddedilir', () => {
    expect(prepareTagNames(['  ', 'a  b'])).toEqual({ names: ['a b'], issues: [] });
    expect(prepareTagNames(['x'.repeat(51)]).issues).toEqual([
      { field: 'tagNames', reason: 'too_long' },
    ]);
  });
});
