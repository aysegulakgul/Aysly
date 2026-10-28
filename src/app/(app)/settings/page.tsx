import { redirect } from 'next/navigation';

/** Ayarlar ilk olarak Görünüm kategorisiyle açılır (Figma 4:67693). */
export default function SettingsPage() {
  redirect('/settings/appearance');
}
