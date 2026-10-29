import { getTranslations } from 'next-intl/server';
import { findManagedTags } from '@/modules/tags';
import { getPersonalScope } from '../../../viewer';
import { TagsForm } from './tags-form';

/** Ayarlar · Etiketler (D-085, BR-TAG-001/002; Figma'da yok, D-065): ad, renk, kullanım sayısıyla silme. */
export default async function TagsSettingsPage() {
  const [scope, t] = await Promise.all([getPersonalScope(), getTranslations('tags')]);
  if (!scope) return null;
  const tags = await findManagedTags(scope);
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
        <p className="text-sm text-text-secondary">{t('description')}</p>
      </div>
      <TagsForm tags={tags} workspaceId={scope.workspaceId} />
    </div>
  );
}
