import { describe, expect, it } from 'vitest';
import { describeDevice } from './device';

describe('oturum cihaz adı', () => {
  it('yaygın tarayıcı ve sistemler tanınır', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
      ),
    ).toBe('Chrome · Windows');
    expect(
      describeDevice(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0',
      ),
    ).toBe('Edge · Windows');
    expect(
      describeDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari · iOS');
    expect(
      describeDevice(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0',
      ),
    ).toBe('Firefox · macOS');
  });

  it('bilinmeyen veya boş değer için null', () => {
    expect(describeDevice(null)).toBeNull();
    expect(describeDevice('curl/8.0')).toBeNull();
  });
});
