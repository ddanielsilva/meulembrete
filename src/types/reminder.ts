export type ReminderStatus = "pending" | "done";
export type ReminderSource = "text" | "audio";

export interface Reminder {
  id: string;
  user_id: string;
  content: string;
  remind_at: string | null;
  status: ReminderStatus;
  source: ReminderSource;
  transcript: string | null;
  notified_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReminderInput {
  content: string;
  remind_at?: string | null;
  source?: ReminderSource;
  transcript?: string | null;
}
