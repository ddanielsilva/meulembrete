"use client";

import * as React from "react";
import {
  AlarmClock,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  Circle,
  Mic,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatReminderDate, getGroupForReminder } from "@/lib/dates";
import type { Reminder } from "@/types/reminder";

interface ReminderItemProps {
  reminder: Reminder;
  highlight?: boolean;
  onToggle: (reminder: Reminder) => void;
  onEdit: (reminder: Reminder) => void;
  onDelete: (reminder: Reminder) => void;
  onSnooze: (reminder: Reminder, until: string | null) => void;
}

function tomorrowAtNine(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

export function ReminderItem({
  reminder,
  highlight,
  onToggle,
  onEdit,
  onDelete,
  onSnooze,
}: ReminderItemProps) {
  const isDone = reminder.status === "done";
  const isOverdue =
    !isDone && getGroupForReminder(reminder.remind_at, reminder.status) === "overdue";

  return (
    <li
      id={`reminder-${reminder.id}`}
      className={cn(
        "flex items-start gap-2 rounded-xl border bg-card p-3 transition-all",
        isDone && "opacity-60",
        highlight && "border-primary/50 ring-2 ring-primary/30"
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(reminder)}
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary"
        aria-label={isDone ? "Reabrir lembrete" : "Concluir lembrete"}
      >
        {isDone ? (
          <CheckCircle2 className="h-6 w-6 text-primary" />
        ) : (
          <Circle className="h-6 w-6" />
        )}
      </button>

      <button
        type="button"
        onClick={() => onEdit(reminder)}
        className="min-w-0 flex-1 text-left"
      >
        <p
          className={cn(
            "break-words text-[15px] leading-snug",
            isDone && "text-muted-foreground line-through"
          )}
        >
          {reminder.content}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span
            className={cn(
              "inline-flex items-center gap-1",
              isOverdue && "font-medium text-destructive"
            )}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            {formatReminderDate(reminder.remind_at)}
          </span>
          {reminder.source === "audio" && (
            <span className="inline-flex items-center gap-1">
              <Mic className="h-3.5 w-3.5" />
              por voz
            </span>
          )}
        </div>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            aria-label="Opções do lembrete"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onEdit(reminder)}>
            <Pencil className="h-4 w-4" />
            Editar
          </DropdownMenuItem>

          {!isDone && (
            <>
              <DropdownMenuItem
                onClick={() =>
                  onSnooze(reminder, new Date(Date.now() + 60 * 60 * 1000).toISOString())
                }
              >
                <AlarmClock className="h-4 w-4" />
                Adiar 1 hora
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSnooze(reminder, tomorrowAtNine())}>
                <CalendarClock className="h-4 w-4" />
                Amanhã 9h
              </DropdownMenuItem>
              {reminder.remind_at && (
                <DropdownMenuItem onClick={() => onSnooze(reminder, null)}>
                  <CalendarX className="h-4 w-4" />
                  Remover data
                </DropdownMenuItem>
              )}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(reminder)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
