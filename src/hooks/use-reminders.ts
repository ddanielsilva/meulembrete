"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Reminder, ReminderInput } from "@/types/reminder";

type ReminderPatch = Partial<
  Pick<Reminder, "content" | "remind_at" | "status" | "notified_at">
>;

/** Busca sem chamar setState de forma síncrona (compatível com a regra do React 19). */
async function fetchReminders(
  supabase: ReturnType<typeof createClient>
): Promise<{ data: Reminder[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[reminders] load", error);
    return { data: null, error: "Não foi possível carregar seus lembretes." };
  }

  return { data: (data ?? []) as Reminder[], error: null };
}

export function useReminders(userId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const remindersRef = useRef<Reminder[]>([]);

  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);

  const load = useCallback(async () => {
    const result = await fetchReminders(supabase);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setError(null);
    setReminders(result.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    let active = true;
    void fetchReminders(supabase).then((result) => {
      if (!active) return;
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setError(null);
      setReminders(result.data ?? []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`reminders-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reminders",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Reminder;
          setReminders((prev) => {
            if (prev.some((r) => r.id === row.id)) {
              return prev.map((r) => (r.id === row.id ? row : r));
            }
            return [row, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reminders",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Reminder;
          setReminders((prev) => prev.map((r) => (r.id === row.id ? row : r)));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "reminders",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const old = payload.old as Partial<Reminder>;
          if (!old.id) return;
          setReminders((prev) => prev.filter((r) => r.id !== old.id));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const add = useCallback(
    async (input: ReminderInput): Promise<Reminder> => {
      const now = new Date().toISOString();
      const tempId = `temp-${crypto.randomUUID()}`;
      const optimistic: Reminder = {
        id: tempId,
        user_id: userId,
        content: input.content,
        remind_at: input.remind_at ?? null,
        status: "pending",
        source: input.source ?? "text",
        transcript: input.transcript ?? null,
        notified_at: null,
        completed_at: null,
        created_at: now,
        updated_at: now,
      };

      setReminders((prev) => [optimistic, ...prev]);

      const { data, error: insertError } = await supabase
        .from("reminders")
        .insert({
          user_id: userId,
          content: input.content,
          remind_at: input.remind_at ?? null,
          source: input.source ?? "text",
          transcript: input.transcript ?? null,
        })
        .select()
        .single();

      if (insertError) {
        setReminders((prev) => prev.filter((r) => r.id !== tempId));
        console.error("[reminders] insert", insertError);
        throw new Error("Não foi possível salvar o lembrete.");
      }

      const saved = data as Reminder;
      setReminders((prev) => {
        const next = prev.map((r) => (r.id === tempId ? saved : r));
        const seen = new Set<string>();
        return next.filter((r) => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        });
      });

      return saved;
    },
    [supabase, userId]
  );

  const update = useCallback(
    async (id: string, patch: ReminderPatch) => {
      const previous = remindersRef.current.find((r) => r.id === id);
      if (!previous) return;

      const cleanPatch: ReminderPatch = { ...patch };
      // Ao mudar a data, o lembrete deve poder notificar de novo.
      if (patch.remind_at !== undefined) cleanPatch.notified_at = null;

      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...cleanPatch } : r))
      );

      const { error: updateError } = await supabase
        .from("reminders")
        .update(cleanPatch)
        .eq("id", id);

      if (updateError) {
        console.error("[reminders] update", updateError);
        setReminders((prev) => prev.map((r) => (r.id === id ? previous : r)));
        throw new Error("Não foi possível atualizar o lembrete.");
      }
    },
    [supabase]
  );

  const remove = useCallback(
    async (id: string) => {
      const previous = remindersRef.current.find((r) => r.id === id);
      setReminders((prev) => prev.filter((r) => r.id !== id));

      const { error: deleteError } = await supabase
        .from("reminders")
        .delete()
        .eq("id", id);

      if (deleteError) {
        console.error("[reminders] delete", deleteError);
        if (previous) {
          setReminders((prev) =>
            prev.some((r) => r.id === previous.id) ? prev : [previous, ...prev]
          );
        }
        throw new Error("Não foi possível excluir o lembrete.");
      }

      return previous ?? null;
    },
    [supabase]
  );

  const restore = useCallback(
    async (reminder: Reminder) => {
      const { data, error: insertError } = await supabase
        .from("reminders")
        .insert({
          id: reminder.id,
          user_id: reminder.user_id,
          content: reminder.content,
          remind_at: reminder.remind_at,
          status: reminder.status,
          source: reminder.source,
          transcript: reminder.transcript,
          notified_at: reminder.notified_at,
          completed_at: reminder.completed_at,
          created_at: reminder.created_at,
          updated_at: reminder.updated_at,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[reminders] restore", insertError);
        throw new Error("Não foi possível desfazer a exclusão.");
      }

      const row = data as Reminder;
      setReminders((prev) =>
        prev.some((r) => r.id === row.id) ? prev : [row, ...prev]
      );
    },
    [supabase]
  );

  const toggle = useCallback(
    async (reminder: Reminder) => {
      await update(reminder.id, {
        status: reminder.status === "done" ? "pending" : "done",
      });
    },
    [update]
  );

  return {
    reminders,
    loading,
    error,
    reload: load,
    add,
    update,
    remove,
    restore,
    toggle,
  };
}
