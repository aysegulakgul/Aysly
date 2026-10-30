import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

/**
 * Kullanıcı Markdown'ının tek görüntüleme yolu (SECURITY §5, D-090). HTML hiçbir zaman ham olarak eklenmez:
 * `react-markdown` React öğeleri üretir, `rehype-sanitize` izinli listesi script, iframe, style, `on*`
 * özniteliklerini ve `javascript:` gibi tehlikeli URL'leri atar. Bağlantılar yeni sekmede, `noopener noreferrer
 * nofollow` ile açılır. Yapılacak listesi kutuları yalnızca görüntüdür.
 */
const schema = {
  ...defaultSchema,
  protocols: { ...defaultSchema.protocols, href: ['http', 'https', 'mailto'] },
};

export function SafeMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={className ?? 'prose-aysly'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        components={{
          a: ({ href, children: label }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-primary underline"
            >
              {label}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
