import { redirect } from 'next/navigation';

/** D-100: Yaklaşanlar sayfası kaldırıldı; yaklaşan görevler Bugün sayfasının altında. */
export default function UpcomingPage() {
  redirect('/#upcoming');
}
