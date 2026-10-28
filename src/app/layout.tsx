import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { getViewer } from './viewer';
import './globals.css';

// Figma tipografisi: Inter (4:69578). latin-ext Türkçe karakterleri içerir; yazı tipi uygulamayla birlikte sunulur.
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app');
  return { title: t('name'), description: t('tagline') };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [locale, viewer] = await Promise.all([getLocale(), getViewer()]);
  // BR-PREF-001: oturum yokken ve varsayılan olarak tema sistem ayarını izler.
  const theme = viewer?.preferences.theme ?? 'system';
  const density = viewer?.preferences.density ?? 'comfortable';
  return (
    <html lang={locale} data-theme={theme} data-density={density} className={inter.variable}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
