'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { TaskView } from '@/modules/tasks';
import type { TaskFilter, ViewSettings, ViewType } from '@/modules/views/domain/task-filter';
import { Banner } from '@/ui/components/feedback';
import { Calendar } from '../calendar/calendar';
import type { TaskUiContext } from '../tasks/task-context';
import { Board } from './board';
import { BulkBar, SelectionToggle, useSelection } from './bulk-bar';
import { FilterBar, ViewTabs, type FilterOptions } from './filter-bar';
import { TaskList } from './task-list';

/**
 * Görev görünümü bölümü (BR-VIEW-002): sekmeler, filtre çubuğu, liste veya pano ve toplu işlem çubuğu. Proje sayfası,
 * kayıtlı görünüm ve yeni görünüm sayfası aynı bileşeni ve aynı sorguyu kullanır.
 */
export function TaskViewSection({
  tasks,
  ignored,
  filter,
  settings,
  viewType,
  task,
  context,
  options,
  projectId,
  readOnly = false,
  saveSlot,
}: {
  tasks: TaskView[];
  ignored: string[];
  filter: TaskFilter;
  settings: ViewSettings;
  viewType: ViewType;
  task?: string | undefined;
  context: TaskUiContext;
  options: FilterOptions;
  projectId?: string | undefined;
  readOnly?: boolean;
  saveSlot?: ReactNode;
}) {
  const t = useTranslations('views');
  const selection = useSelection();
  const params = useSearchParams();
  const cal = params.get('cal');
  const date = params.get('date');
  return (
    <>
      <ViewTabs filter={filter} settings={settings} viewType={viewType} task={task} />
      <div className="flex w-full flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <FilterBar
            key={JSON.stringify([filter, settings, viewType])}
            filter={filter}
            settings={settings}
            viewType={viewType}
            options={options}
            saveSlot={saveSlot}
          />
        </div>
        {viewType === 'list' && !readOnly ? (
          <SelectionToggle selection={selection} all={tasks.map((x) => x.id)} />
        ) : null}
      </div>
      {ignored.length ? <Banner>{t('invalid')}</Banner> : null}
      <p className="sr-only" role="status">
        {t('count', { count: tasks.length })}
      </p>
      {viewType === 'calendar' ? (
        <Calendar
          tasks={tasks}
          context={context}
          mode={cal === 'month' || cal === 'week' || cal === 'day' ? cal : null}
          date={date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : context.today}
        />
      ) : viewType === 'board' ? (
        <Board
          tasks={tasks}
          context={context}
          projectId={projectId}
          filter={filter}
          settings={settings}
          readOnly={readOnly}
        />
      ) : (
        <TaskList
          tasks={tasks}
          groupBy={settings.groupBy}
          context={context}
          selection={selection}
          readOnly={readOnly}
        />
      )}
      <BulkBar selection={selection} context={context} />
    </>
  );
}
