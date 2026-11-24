"use client";

import * as React from "react";
import { Mic, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useReminders } from "@/hooks/use-reminders";
import { useRecorder } from "@/hooks/use-recorder";
import { groupReminders, reminderStats } from "@/lib/reminders";
import { GROUP_LABELS, formatReminderDate } from "@/lib/dates";
import { QuickCapture } from "@/components/reminders/quick-capture";
import { VoiceSheet, type VoiceSaveStage } from "@/components/reminders/voice-sheet";
import { ReminderItem } from "@/components/reminders/reminder-item";
import { ReminderDialog } from "@/components/reminders/reminder-dialog";
import { NotificationsCard } from "@/components/reminders/notifications-card";
import { Button } from "@/components/ui/button";
import type { Reminder } from "@/types/reminder";

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg")) return "mp3";
  return "webm";
}

export function RemindersClient({ userId }: { userId: string }) {
  const { reminders, loading, error, reload, add, update, remove, restore, toggle } =
    useReminders(userId);

  const {
    phase,
    seconds,
    error: recorderError,
    maxSeconds,
    start,
    stop,
    cancel,
  } = useRecorder({ maxSeconds: 120 });

  const [voiceOpen, setVoiceOpen] = React.useState(false);
  const [voiceStage, setVoiceStage] = React.useState<VoiceSaveStage | null>(null);
  const [voiceError, setVoiceError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Reminder | null>(null);
  const [highlight, setHighlight] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("highlight");
  });
  const stoppingRef = React.useRef(false);

  React.useEffect(() => {
    if (!highlight) return;
    const timeout = window.setTimeout(() => setHighlight(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [highlight]);

  const handleVoiceSave = React.useCallback(
    async (blob: Blob, onStage: (stage: VoiceSaveStage) => void) => {
      onStage("uploading");

      const timeZone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
      const form = new FormData();
      form.append("audio", blob, `lembrete.${extensionForMime(blob.type)}`);
      form.append("timezone", timeZone);

      const response = await fetch("/api/ai/reminder", {
        method: "POST",
        body: form,
      });
      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
        content?: string;
        remind_at?: string | null;
        transcript?: string;
      };

      if (!response.ok || !json.content) {
        throw new Error(
          json.error ?? "Não foi possível transcrever o áudio. Tente de novo."
        );
      }

      onStage("saving");
      const saved = await add({
        content: json.content,
        remind_at: json.remind_at ?? null,
        source: "audio",
        transcript: json.transcript ?? null,
      });

      toast.success("Lembrete salvo", {
        description: json.remind_at
          ? `${saved.content} · ${formatReminderDate(json.remind_at)}`
          : saved.content,
        action: {
          label: "Editar",
          onClick: () => setEditing(saved),
        },
      });

      setHighlight(saved.id);
    },
    [add]
  );

  const stopAndSave = React.useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      const blob = await stop();
      if (!blob) return;

      setVoiceError(null);
      setVoiceStage("uploading");

      try {
        await handleVoiceSave(blob, setVoiceStage);
        setVoiceOpen(false);
      } catch (err) {
        setVoiceError(
          err instanceof Error ? err.message : "Não foi possível salvar o lembrete."
        );
      } finally {
        setVoiceStage(null);
      }
    } finally {
      stoppingRef.current = false;
    }
  }, [handleVoiceSave, stop]);

  React.useEffect(() => {
    if (phase === "recording" && seconds >= maxSeconds && !voiceStage) {
      void stopAndSave();
    }
  }, [phase, seconds, maxSeconds, voiceStage, stopAndSave]);

  function openVoice() {
    setVoiceError(null);
    setVoiceStage(null);
    setVoiceOpen(true);
    void start();
  }

  function closeVoice() {
    if (voiceStage) return;
    cancel();
    setVoiceOpen(false);
    setVoiceError(null);
  }

  async function handleAdd(input: { content: string; remind_at: string | null }) {
    await add({ content: input.content, remind_at: input.remind_at, source: "text" });
  }

  async function handleToggle(reminder: Reminder) {
    try {
      await toggle(reminder);
    } catch {
      toast.error("Não foi possível atualizar o lembrete.");
    }
  }

  async function handleSnooze(reminder: Reminder, until: string | null) {
    try {
      await update(reminder.id, { remind_at: until });
      toast.success(
        until ? `Adiado para ${formatReminderDate(until)}` : "Data removida"
      );
    } catch {
      toast.error("Não foi possível adiar o lembrete.");
    }
  }

  async function handleSaveEdit(
    id: string,
    patch: { content: string; remind_at: string | null }
  ) {
    await update(id, patch);
    toast.success("Lembrete atualizado");
  }

  async function handleDelete(reminder: Reminder) {
    const removed = await remove(reminder.id);
    if (!removed) return;

    toast("Lembrete excluído", {
      description: removed.content,
      action: {
        label: "Desfazer",
        onClick: () => {
          void restore(removed)
            .then(() => toast.success("Lembrete restaurado"))
            .catch(() => toast.error("Não foi possível desfazer a exclusão."));
        },
      },
    });
  }

  const groups = React.useMemo(() => groupReminders(reminders), [reminders]);
  const stats = React.useMemo(() => reminderStats(reminders), [reminders]);
  const isEmpty = !loading && reminders.length === 0;
  const displayVoiceError = voiceError ?? recorderError;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Seus lembretes</h1>
        <p className="text-xs text-muted-foreground">
          Tudo o que você não quer esquecer, em um só lugar.
        </p>
      </div>

      <NotificationsCard userId={userId} />

      <QuickCapture onAdd={handleAdd} />

      {(stats.overdue > 0 || stats.today > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {stats.overdue > 0 && (
            <span className="rounded-full bg-destructive/10 px-2.5 py-1 font-medium text-destructive">
              {stats.overdue} atrasado{stats.overdue > 1 ? "s" : ""}
            </span>
          )}
          {stats.today > 0 && (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
              {stats.today} para hoje
            </span>
          )}
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-[74px] animate-pulse rounded-xl border bg-card"
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void reload()}
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      )}

      {isEmpty && (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mic className="h-7 w-7" />
          </div>
          <h2 className="font-semibold">Nenhum lembrete por aqui</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            Toque em <span className="font-medium text-foreground">Falar</span> e
            diga o que precisa lembrar. A IA transcreve, entende a data e salva
            para você.
          </p>
          <Button className="mt-4" onClick={openVoice}>
            <Mic className="h-4 w-4" />
            Gravar o primeiro lembrete
          </Button>
        </div>
      )}

      {!loading && !error && groups.length > 0 && (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {GROUP_LABELS[group.key]}
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {group.items.length}
                </span>
              </h2>
              <ul className="space-y-2">
                {group.items.map((reminder) => (
                  <ReminderItem
                    key={reminder.id}
                    reminder={reminder}
                    highlight={highlight === reminder.id}
                    onToggle={handleToggle}
                    onEdit={setEditing}
                    onDelete={handleDelete}
                    onSnooze={handleSnooze}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={openVoice}
        className="fixed left-1/2 z-40 flex h-14 -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-6 font-medium text-primary-foreground shadow-xl shadow-primary/25 transition-transform active:scale-95"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
        aria-label="Gravar lembrete por voz"
      >
        <Mic className="h-5 w-5" />
        Falar
      </button>

      <VoiceSheet
        open={voiceOpen}
        onOpenChange={(open) => {
          if (!open) closeVoice();
        }}
        phase={phase}
        seconds={seconds}
        maxSeconds={maxSeconds}
        error={displayVoiceError}
        stage={voiceStage}
        onStop={() => void stopAndSave()}
        onRetry={() => {
          setVoiceError(null);
          void start();
        }}
      />

      {editing && (
        <ReminderDialog
          key={editing.id}
          reminder={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onSave={handleSaveEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
