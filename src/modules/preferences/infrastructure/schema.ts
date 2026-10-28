import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from '@/modules/identity/infrastructure/schema';

/** Kullanıcı tercihleri (DATA_MODEL §3.5, BR-PREF-001..003). JSONB alanlar sürümlü Zod şemasıyla okunur. */
export const userPreferences = pgTable(
  'user_preferences',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    timezone: text('timezone').notNull(),
    theme: text('theme').notNull().default('system'),
    density: text('density').notNull().default('comfortable'),
    dateFormat: text('date_format').notNull(),
    timeFormat: text('time_format').notNull(),
    weekStart: smallint('week_start').notNull(),
    defaultTaskView: text('default_task_view').notNull().default('list'),
    startPage: text('start_page').notNull().default('dashboard'),
    allDayReminderTime: time('all_day_reminder_time').notNull().default('09:00'),
    dashboardLayout: jsonb('dashboard_layout').notNull(),
    notificationSettings: jsonb('notification_settings').notNull(),
    onboarding: jsonb('onboarding').notNull(),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('prefs_locale', sql`${t.locale} in ('tr','en')`),
    check('prefs_theme', sql`${t.theme} in ('light','dark','system')`),
    check('prefs_density', sql`${t.density} in ('comfortable','compact')`),
    check('prefs_date_format', sql`${t.dateFormat} in ('DD.MM.YYYY','YYYY-MM-DD','MM/DD/YYYY')`),
    check('prefs_time_format', sql`${t.timeFormat} in ('24h','12h')`),
    check('prefs_week_start', sql`${t.weekStart} in (0,1,6)`),
    check('prefs_default_view', sql`${t.defaultTaskView} in ('list','board','calendar')`),
    check('prefs_start_page', sql`${t.startPage} in ('dashboard','inbox','my-tasks')`),
  ],
);
