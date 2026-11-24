import type { Reminder } from "@/types/reminder";
import {
  GROUP_ORDER,
  getGroupForReminder,
  type ReminderGroupKey,
} from "@/lib/dates";

export interface ReminderGroup {
  key: ReminderGroupKey;
  items: Reminder[];
}

export function groupReminders(reminders: Reminder[]): ReminderGroup[] {
  const map = new Map<ReminderGroupKey, Reminder[]>();
  for (const key of GROUP_ORDER) map.set(key, []);

  for (const reminder of reminders) {
    const key = getGroupForReminder(reminder.remind_at, reminder.status);
    map.get(key)?.push(reminder);
  }

  for (const [key, items] of map) {
    if (key === "done") {
      items.sort((a, b) => {
        const aDate = a.completed_at ?? a.updated_at;
        const bDate = b.completed_at ?? b.updated_at;
        return bDate.localeCompare(aDate);
      });
    } else if (key === "no_date") {
      items.sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else {
      items.sort((a, b) => (a.remind_at ?? "").localeCompare(b.remind_at ?? ""));
    }
  }

  return GROUP_ORDER.map((key) => ({ key, items: map.get(key) ?? [] })).filter(
    (group) => group.items.length > 0
  );
}

export function reminderStats(reminders: Reminder[]) {
  const pending = reminders.filter((r) => r.status === "pending");
  const overdue = pending.filter(
    (r) => getGroupForReminder(r.remind_at, r.status) === "overdue"
  ).length;
  const today = pending.filter(
    (r) => getGroupForReminder(r.remind_at, r.status) === "today"
  ).length;
  return { pending: pending.length, overdue, today };
}
