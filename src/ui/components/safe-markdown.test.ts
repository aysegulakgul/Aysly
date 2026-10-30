import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SafeMarkdown } from './safe-markdown';

const render = (markdown: string) =>
  renderToStaticMarkup(createElement(SafeMarkdown, null, markdown));

/** SECURITY §5 / Faz 7 kabulü: XSS yük testleri. Notlar Markdown olarak saklanır ve yalnızca bu bileşenle gösterilir. */
describe('SafeMarkdown — XSS yükleri', () => {
  const payloads = [
    '<script>alert(1)</script>',
    '<img src=x onerror="alert(1)">',
    '<iframe src="https://kotu.example"></iframe>',
    '[tıkla](javascript:alert(1))',
    '[tıkla](JaVaScRiPt:alert(1))',
    '[veri](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    '<a href="javascript:alert(1)">x</a>',
    '<div style="background:url(javascript:alert(1))" onclick="alert(1)">x</div>',
    '<svg onload="alert(1)"></svg>',
    '![x](x" onerror="alert(1))',
  ];
  for (const payload of payloads) {
    it(`zararsızlaştırılır: ${payload.slice(0, 40)}`, () => {
      const html = render(payload).toLowerCase();
      expect(html).not.toContain('<script');
      expect(html).not.toContain('<iframe');
      // Tehlikeli öznitelik ve adresler yalnızca etiket içinde etkilidir; düz metne kaçırılmış hâli zararsızdır.
      expect(html).not.toMatch(/<[^>]*\son[a-z]+=/);
      expect(html).not.toMatch(/<[^>]*href="\s*javascript:/);
      expect(html).not.toMatch(/<[^>]*(href|src)="\s*data:text\/html/);
      expect(html).not.toMatch(/<[^>]*style=/);
    });
  }

  it('temel Markdown biçimleri korunur; bağlantılar güvenli özniteliklerle açılır (D-042)', () => {
    const html = render(
      '## Başlık\n\n- madde\n- [x] yapıldı\n\n`kod`\n\n[site](https://ornek.test)',
    );
    expect(html).toContain('<h2>Başlık</h2>');
    expect(html).toContain('<li>madde</li>');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('<code>kod</code>');
    expect(html).toContain('href="https://ornek.test"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('target="_blank"');
  });
});
