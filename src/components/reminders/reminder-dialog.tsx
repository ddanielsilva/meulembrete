"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/dates";
import type { Reminder } from "@/types/reminder";
import { CalendarX, Loader2, Trash2 } from "lucide-react";

interface ReminderDialogProps {
  /** O componente é montado com `key={reminder.id}`, então o estado inicia limpo. */
  reminder: Reminder;
  onOpenChange: (open: boolean) => void;
  onSave: (
    id: string,
    patch: { content: string; remind_at: string | null }
  ) => Promise<void>;
  onDelete: (reminder: Reminder) => Promise<void>;
}

export function ReminderDialog({
  reminder,
  onOpenChange,
  onSave,
  onDelete,
}: ReminderDialogProps) {
  const [content, setContent] = React.useState(reminder.content);
  const [dateValue, setDateValue] = React.useState(
    toLocalInputValue(reminder.remind_at)
  );
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (saving || deleting) return;
    const trimmed = content.trim();
    if (!trimmed) {
      setError("Escreva o lembrete.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(reminder.id, {
        content: trimmed,
        remind_at: fromLocalInputValue(dateValue),
      });
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível salvar o lembrete."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (saving || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete(reminder);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível excluir o lembrete."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar lembrete</DialogTitle>
          <DialogDescription>
            Ajuste o texto e a data. Alterar a data libera uma nova notificação.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="reminder-content">Lembrete</Label>
            <Textarea
              id="reminder-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={2000}
              rows={3}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reminder-date">Data e hora</Label>
            <Input
              id="reminder-date"
              type="datetime-local"
              value={dateValue}
              onChange={(event) => setDateValue(event.target.value)}
            />
            {dateValue ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit text-muted-foreground"
                onClick={() => setDateValue("")}
              >
                <CalendarX className="h-4 w-4" />
                Remover data
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sem data: o lembrete fica na lista “Sem data”.
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={saving || deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Excluir
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving || deleting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || deleting || !content.trim()}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
