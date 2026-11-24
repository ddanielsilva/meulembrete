"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  fromLocalInputValue,
  formatReminderDate,
  toLocalInputValue,
} from "@/lib/dates";
import { CalendarClock, CalendarPlus, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

interface QuickCaptureProps {
  onAdd: (input: {
    content: string;
    remind_at: string | null;
  }) => Promise<void>;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-primary/40 bg-primary/15 font-medium text-primary"
          : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function QuickCapture({ onAdd }: QuickCaptureProps) {
  const [text, setText] = React.useState("");
  const [remindAt, setRemindAt] = React.useState<string | null>(null);
  const [showCustom, setShowCustom] = React.useState(false);
  const [customValue, setCustomValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function selectInOneHour() {
    setRemindAt(new Date(Date.now() + 60 * 60 * 1000).toISOString());
    setShowCustom(false);
  }

  function selectTomorrowNine() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    setRemindAt(date.toISOString());
    setShowCustom(false);
  }

  function applyCustom() {
    const iso = fromLocalInputValue(customValue);
    if (!iso) return;
    setRemindAt(iso);
    setShowCustom(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const content = text.trim();
    if (!content || saving) return;

    setSaving(true);
    try {
      await onAdd({ content, remind_at: remindAt });
      setText("");
      setRemindAt(null);
      setShowCustom(false);
      setCustomValue("");
      inputRef.current?.focus();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível salvar o lembrete."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-3 shadow-sm">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="O que você precisa lembrar?"
            maxLength={2000}
            enterKeyHint="done"
            autoComplete="off"
            className="h-11 border-0 bg-transparent px-1 text-base shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full"
            disabled={!text.trim() || saving}
            aria-label="Adicionar lembrete"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t pt-2">
          <Chip active={!remindAt} onClick={() => setRemindAt(null)}>
            Sem data
          </Chip>
          <Chip active={false} onClick={selectInOneHour}>
            Em 1 hora
          </Chip>
          <Chip active={false} onClick={selectTomorrowNine}>
            Amanhã 9h
          </Chip>
          <Chip
            active={showCustom}
            onClick={() => {
              setShowCustom((value) => !value);
              if (!customValue && remindAt) {
                setCustomValue(toLocalInputValue(remindAt));
              }
            }}
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            Escolher
          </Chip>

          {remindAt && !showCustom && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              <CalendarClock className="h-3.5 w-3.5" />
              {formatReminderDate(remindAt)}
              <button
                type="button"
                onClick={() => setRemindAt(null)}
                aria-label="Remover data"
                className="rounded-full p-0.5 hover:bg-primary/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>

        {showCustom && (
          <div className="mt-2 flex items-center gap-2">
            <Input
              type="datetime-local"
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
              className="h-10"
              aria-label="Data e hora do lembrete"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={applyCustom}
              disabled={!customValue}
            >
              OK
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
