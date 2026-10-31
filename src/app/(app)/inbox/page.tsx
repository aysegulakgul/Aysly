import { redirect } from 'next/navigation';

/** D-098: Inbox sayfası kaldırıldı; eski bağlantılar Görevlerim'e yönlenir (görev ve ekleme parametreleri korunur). */
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string; task?: string }>;
}) {
  const { add, task } = await searchParams;
  const query = new URLSearchParams({ ...(add ? { add } : {}), ...(task ? { task } : {}) });
  redirect(query.size ? `/my-tasks?${query}` : '/my-tasks');
}
