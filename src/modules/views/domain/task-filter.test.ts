import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTER,
  TaskFilterSchema,
  activeConditionCount,
  parseTaskFilter,
  taskFilterToParams,
} from './task-filter';

const P = '01900000-0000-7000-8000-000000000001';

describe('TaskFilter v1 (BR-VIEW-001/002, API_CONTRACTS §6.2)', () => {
  it('BR-VIEW-002: URL ↔ filtre dönüşümü kayıpsızdır (görünüm geçişinde filtre korunur)', () => {
    const params = new URLSearchParams(
      `projectId=${P}&status=todo&status=in_progress&priority=3&due=next7&q=fatura&sort=due&groupBy=priority&view=board&task=x`,
    );
    const { filter, settings } = parseTaskFilter(params);
    expect(filter.success && settings.success).toBe(true);
    expect(filter.data).toMatchObject({
      projectId: [P],
      status: ['todo', 'in_progress'],
      priority: [3],
      due: 'next7',
      q: 'fatura',
    });
    expect(settings.data).toEqual({ sort: 'due', groupBy: 'priority' });
    const back = taskFilterToParams(filter.data!, settings.data);
    expect(parseTaskFilter(back).filter.data).toEqual(filter.data);
  });

  it('varsayılanlar yazılmaz; boş filtre boş adres üretir', () => {
    expect(taskFilterToParams(EMPTY_FILTER, { sort: 'manual', groupBy: 'none' }).toString()).toBe(
      '',
    );
    expect(activeConditionCount(EMPTY_FILTER)).toBe(0);
  });

  it('geçersiz değerler reddedilir (bilinmeyen durum, UUID olmayan proje)', () => {
    expect(parseTaskFilter(new URLSearchParams('status=archived')).filter.success).toBe(false);
    expect(parseTaskFilter(new URLSearchParams('projectId=abc')).filter.success).toBe(false);
    expect(TaskFilterSchema.safeParse({ extra: 1 }).success).toBe(false);
  });
});
