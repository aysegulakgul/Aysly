import { getTranslations } from 'next-intl/server';
import { findContacts } from '@/modules/contacts';
import { getPersonalScope } from '../../../viewer';
import { ContactsForm } from './contacts-form';

/** Ayarlar · Kişiler (D-097; Figma'da yok, D-100): ekip arkadaşı ekleme, düzenleme ve silme. */
export default async function ContactsSettingsPage() {
  const [scope, t] = await Promise.all([getPersonalScope(), getTranslations('contacts')]);
  if (!scope) return null;
  const contacts = await findContacts(scope);
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
        <p className="text-sm text-text-secondary">{t('description')}</p>
      </div>
      <ContactsForm contacts={contacts} workspaceId={scope.workspaceId} />
    </div>
  );
}
