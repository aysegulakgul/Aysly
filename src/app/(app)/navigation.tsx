'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from '@/ui/components/icon';
import { BottomNav, BottomNavItem, NavItem } from '@/ui/components/nav';
import { badge } from './badge';
import { ProjectDot } from './projects/project-color';
import { SearchButton } from './search/command-palette';
import { SignOutButton } from './sign-out-button';

function useSection() {
  const pathname = usePathname();
  return {
    today: pathname === '/',
    myTasks: pathname === '/my-tasks',
    calendar: pathname === '/calendar',
    goals: pathname === '/goals',
    notes: pathname === '/notes',
    projects: pathname === '/projects',
    project: (id: string) => pathname === `/projects/${id}`,
    view: (id: string) => pathname === `/views/${id}`,
    archive: pathname === '/archive',
    trash: pathname === '/trash',
    settings: pathname.startsWith('/settings'),
    menu: pathname === '/menu',
  };
}

const Divider = () => <div className="h-px w-full shrink-0 bg-border" />;

export type SidebarProject = { id: string; name: string; color: string; percent: number | null };
export type SidebarView = { id: string; name: string };

const sectionLink = (active: boolean) =>
  `flex h-row w-full items-center gap-2 rounded-sm px-3 text-sm ${
    active ? 'bg-support-1 text-primary' : 'text-text-secondary'
  }`;

/**
 * Figma UI/Sidebar (4:66491): 232 px, surface-muted zemin, 16 px iç boşluk, 12 px aralık. Faz 5: Projeler girişi,
 * "PROJELER" (renk ve ilerleme yüzdesiyle) ve "KAYITLI GÖRÜNÜMLER" bölümleri, Arşiv ve Çöp kutusu (Figma 4:67037).
 * Faz 7: Ara (Ctrl/⌘+K), Hedefler ve Notlar. Faz 9 (D-098, D-100): Inbox ve Yaklaşanlar sayfaları, "Görev ekle"
 * düğmesi ve zil kenar çubuğundan kalktı; zil ve Paylaş sağ üst başlıkta.
 */
export function Sidebar({
  userName,
  counts,
  projects,
  views,
}: {
  userName: string;
  counts: { myTasks: number; today: number };
  projects: SidebarProject[];
  views: SidebarView[];
}) {
  const t = useTranslations('shell');
  const section = useSection();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-border bg-[linear-gradient(180deg,var(--surface-muted),var(--bg-page))] p-4 lg:flex">
      <div className="flex h-11 w-full items-center gap-2.5">
        <Icon name="moon" tone="primary" />
        <p className="flex-1 bg-gradient-to-r from-[#7a7ff0] via-[#9a6ee6] to-[#e05f9e] bg-clip-text text-xl font-bold text-transparent">
          aysly
        </p>
      </div>
      <SearchButton />
      <nav aria-label={t('mainNav')} className="flex w-full flex-col gap-3">
        <NavItem
          href="/"
          glyph="☼"
          active={section.today}
          count={badge(counts.today)}
          countLabel={t('todayCount', { count: counts.today })}
        >
          {t('today')}
        </NavItem>
        <NavItem
          href="/my-tasks"
          glyph="✓"
          active={section.myTasks}
          count={badge(counts.myTasks)}
          countLabel={t('myTasksCount', { count: counts.myTasks })}
        >
          {t('myTasks')}
        </NavItem>
        <NavItem
          href="/projects"
          glyph="▭"
          active={section.projects}
          count={badge(projects.length)}
          countLabel={t('projectsCount', { count: projects.length })}
        >
          {t('projects')}
        </NavItem>
        <NavItem href="/calendar" glyph="▦" active={section.calendar}>
          {t('calendar')}
        </NavItem>
        <NavItem href="/goals" glyph="◎" active={section.goals}>
          {t('goals')}
        </NavItem>
        <NavItem href="/notes" glyph="≡" active={section.notes}>
          {t('notes')}
        </NavItem>
        <Divider />
        <div className="flex items-center gap-2 px-1">
          <h2 className="flex-1 text-xs font-medium tracking-wide text-text-secondary uppercase">
            {t('projectsSection')}
          </h2>
          <Link
            href="/projects"
            aria-label={t('newProject')}
            className="flex size-8 items-center justify-center rounded-sm text-text-secondary"
          >
            +
          </Link>
        </div>
        <ul className="flex flex-col">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}` as Route}
                aria-current={section.project(p.id) ? 'page' : undefined}
                className={sectionLink(section.project(p.id))}
              >
                <ProjectDot color={p.color} />
                <span className="min-w-0 flex-1 truncate">
                  {p.percent === null
                    ? p.name
                    : t('projectProgress', { name: p.name, percent: p.percent })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Divider />
        <div className="flex items-center gap-2 px-1">
          <h2 className="flex-1 text-xs font-medium tracking-wide text-text-secondary uppercase">
            {t('savedViews')}
          </h2>
          <Link
            href="/views/new"
            aria-label={t('newView')}
            className="flex size-8 items-center justify-center rounded-sm text-text-secondary"
          >
            +
          </Link>
        </div>
        <ul className="flex flex-col">
          {views.map((v) => (
            <li key={v.id}>
              <Link
                href={`/views/${v.id}` as Route}
                aria-current={section.view(v.id) ? 'page' : undefined}
                className={sectionLink(section.view(v.id))}
              >
                <span aria-hidden="true">☆</span>
                <span className="min-w-0 flex-1 truncate">{v.name}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Divider />
        <Link
          href="/archive"
          aria-current={section.archive ? 'page' : undefined}
          className={sectionLink(section.archive)}
        >
          {t('archive')}
        </Link>
        <Link
          href="/trash"
          aria-current={section.trash ? 'page' : undefined}
          className={sectionLink(section.trash)}
        >
          {t('trash')}
        </Link>
        <NavItem href="/settings" glyph="⚙" active={section.settings}>
          {t('settings')}
        </NavItem>
      </nav>
      <Divider />
      <p className="w-full text-sm whitespace-pre-wrap text-text-secondary">
        <span aria-hidden="true">{'◉  '}</span>
        {`${userName} · ${t('personal')}`}
      </p>
      <SignOutButton />
    </aside>
  );
}

/** Figma UI/BottomNav (4:69074): Bugün, Görevlerim, Ekle, Takvim, Menü (D-098: Inbox yerine Görevlerim). */
export function MobileNavigation() {
  const t = useTranslations('shell');
  const section = useSection();
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 lg:hidden">
      <BottomNav label={t('bottomNav')}>
        <BottomNavItem href="/" glyph="☼" active={section.today}>
          {t('today')}
        </BottomNavItem>
        <BottomNavItem href="/my-tasks" glyph="✓" active={section.myTasks}>
          {t('myTasks')}
        </BottomNavItem>
        <BottomNavItem href="/my-tasks?add=1" glyph="⊕" accent>
          {t('add')}
        </BottomNavItem>
        <BottomNavItem href="/calendar" glyph="▦" active={section.calendar}>
          {t('calendar')}
        </BottomNavItem>
        <BottomNavItem href="/menu" glyph="☰" active={section.menu}>
          {t('menu')}
        </BottomNavItem>
      </BottomNav>
    </div>
  );
}
