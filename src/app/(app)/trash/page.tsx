import { getTranslations } from 'next-intl/server';
import { findTrash } from '@/modules/tasks';
import { getPersonalScope, getViewer } from '../../viewer';
import { PageFrame } from '../page-frame';
import { TrashList } from './trash-list';

/**
 * Çöp kutusu (FR-SET-07, USER_FLOWS §2.13; Figma'da yok, D-065): silme gruplarına göre satırlar, kalan gün
 * (BR-DEL-003), "Geri yükle" (BR-DEL-004), "Kalıcı sil" ve "Çöpü boşalt" (BR-DEL-005).
 */
export default async function TrashPage() {
  const [viewer, scope, t] = await Promise.all([
    getViewer(),
    getPersonalScope(),
    getTranslations('trash'),
  ]);
  if (!viewer || !scope) return null;
  const groups = await findTrash(scope);
  return (
    <PageFrame title={t('title')}>
      <TrashList groups={groups} workspaceId={scope.workspaceId} />
    </PageFrame>
  );
}
