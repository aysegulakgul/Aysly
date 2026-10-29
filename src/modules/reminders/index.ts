/** reminders modülünün dışa açık yüzü (ARCHITECTURE §4.2). Kurallar tasks modülündeki kullanım senaryolarındadır. */
export {
  LATE_MS,
  MAX_OFFSET_MINUTES,
  MIN_LEAD_MS,
  REMINDERS_PER_TASK,
  REMINDER_KINDS,
  STALE_MS,
  dispatchOutcome,
  relativeRemindAt,
  type Reminder,
  type ReminderKind,
  type ReminderStatus,
} from './domain/reminder';
export {
  cancelPendingReminders,
  countReminders,
  deleteRelativeReminders,
  deleteReminder,
  findDueReminders,
  findRemindersForTasks,
  insertReminder,
  reactivateReminders,
  transitionReminder,
  updateReminderTime,
} from './infrastructure/reminder-store';
