import { addDays, differenceInCalendarDays, format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export type ReminderGroupKey =
  | "overdue"
  | "today"
  | "tomorrow"
  | "next7"
  | "later"
  | "no_date"
  | "done";

export const GROUP_LABELS: Record<ReminderGroupKey, string> = {
  overdue: "Atrasados",
  today: "Hoje",
  tomorrow: "Amanhã",
  next7: "Próximos 7 dias",
  later: "Depois",
  no_date: "Sem data",
  done: "Concluídos",
};

export const GROUP_ORDER: ReminderGroupKey[] = [
  "overdue",
  "today",
  "tomorrow",
  "next7",
  "later",
  "no_date",
  "done",
];

export function formatReminderDate(iso: string | null): string {
  if (!iso) return "Sem data";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Sem data";

  const now = new Date();
  const time = format(date, "HH:mm");

  if (isSameDay(date, now)) return `Hoje, ${time}`;
  if (isSameDay(date, addDays(now, 1))) return `Amanhã, ${time}`;
  if (date.getFullYear() === now.getFullYear()) {
    return format(date, "dd 'de' MMM', 'HH:mm", { locale: ptBR });
  }
  return format(date, "dd/MM/yyyy', 'HH:mm");
}

export function formatFullDate(iso: string | null): string {
  if (!iso) return "Sem data";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return format(date, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
}

export function getGroupForReminder(remindAt: string | null, status: string): ReminderGroupKey {
  if (status === "done") return "done";
  if (!remindAt) return "no_date";

  const date = new Date(remindAt);
  if (Number.isNaN(date.getTime())) return "no_date";

  const now = new Date();
  if (date.getTime() < now.getTime()) return "overdue";
  if (isSameDay(date, now)) return "today";

  const diff = differenceInCalendarDays(date, now);
  if (diff === 1) return "tomorrow";
  if (diff > 1 && diff <= 7) return "next7";
  return "later";
}

export function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Data/hora local do dispositivo, pronta para enviar à IA. */
export function localNowContext(): { nowIso: string; timeZone: string; localLabel: string } {
  const now = new Date();
  let timeZone = "America/Sao_Paulo";
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || timeZone;
  } catch {
    // mantém o padrão
  }
  let localLabel = "";
  try {
    localLabel = new Intl.DateTimeFormat("pt-BR", {
      timeZone,
      dateStyle: "full",
      timeStyle: "short",
    }).format(now);
  } catch {
    localLabel = now.toLocaleString("pt-BR");
  }
  return { nowIso: now.toISOString(), timeZone, localLabel };
}
