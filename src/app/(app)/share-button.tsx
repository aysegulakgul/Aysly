'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/ui/components/button';
import { Dialog } from '@/ui/components/dialog';
import { Avatar } from './tasks/pills';

type Person = { id: string; name: string; email: string | null; color: string };

/**
 * D-097: sağ üstteki Paylaş. Bulunulan sayfanın bağlantısını kopyalar; seçilen kişiye e-posta uygulamasında hazır
 * davet taslağı açar (`mailto:`). Uygulama e-posta göndermez (D-055, D-062). Yerel ortamda bağlantı yalnızca bu
 * bilgisayarda açılır; pencere bunu açıkça söyler.
 */
export function ShareButton({ people, title }: { people: Person[]; title: string }) {
  const t = useTranslations('share');
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const withEmail = people.filter((p) => p.email);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function invite(to: string) {
    const subject = t('mailSubject', { title });
    const body = t('mailBody', { title, link: window.location.href });
    window.location.assign(
      `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    );
  }

  return (
    <>
      <Button
        variant="primary"
        onClick={() => {
          setCopied(false);
          setOpen(true);
        }}
        className="min-h-9 px-3 py-1.5 text-sm"
      >
        {t('button')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('title', { title })}
        footnote={t('localNote')}
      >
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-text">{t('linkTitle')}</p>
            <div className="flex w-full gap-2">
              <input
                readOnly
                value={typeof window === 'undefined' ? '' : window.location.href}
                aria-label={t('linkTitle')}
                className="min-h-9 min-w-0 flex-1 rounded-sm border border-border bg-page px-2 text-sm text-text-secondary"
              />
              <Button onClick={() => void copy()}>{copied ? t('copied') : t('copy')}</Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-text">{t('inviteTitle')}</p>
            {withEmail.length ? (
              <ul className="flex flex-col gap-1">
                {withEmail.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <Avatar name={p.name} color={p.color} />
                    <span className="min-w-0 flex-1 truncate text-sm text-text">
                      {p.name}
                      <span className="block text-xs text-text-secondary">{p.email}</span>
                    </span>
                    <Button variant="ghost" onClick={() => invite(p.email!)}>
                      {t('invite')}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) invite(email.trim());
              }}
              className="flex w-full gap-2"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                aria-label={t('emailLabel')}
                className="min-h-9 min-w-0 flex-1 rounded-sm border border-border bg-page px-2 text-sm text-text placeholder:text-text-secondary"
              />
              <Button type="submit" disabled={!email.trim()}>
                {t('invite')}
              </Button>
            </form>
          </div>
        </div>
      </Dialog>
    </>
  );
}
