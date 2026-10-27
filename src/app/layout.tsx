import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import './globals.css';

// Figma tipografisi: Inter (4:69578). latin-ext Türkçe karakterleri içerir; yazı tipi uygulamayla birlikte sunulur.
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app');
  return { title: t('name'), description: t('tagline') };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  // Faz 2: yalnızca koyu tema (açık temada iki Figma token'ı eksik; bkz. src/ui/tokens.css). Tema tercihi Faz 3'te.
  return (
    <html lang={locale} data-theme="dark" className={inter.variable}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
